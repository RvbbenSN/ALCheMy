#!/usr/bin/env python3
"""Precalcula las predicciones del modelo real sobre una rejilla de condiciones.

Que problema resuelve
---------------------
El simulador de la web tiene que dar predicciones del modelo de verdad, pero sin
servidor y sin exponer el modelo. La solucion es congelar: se calcula de antemano
la respuesta para cada combinacion que el usuario puede elegir, y la web se
limita a buscar en esa tabla.

Que se gana y que se pierde, dicho claro
----------------------------------------
Se gana: predicciones reales sin backend, y **nadie puede sondear el modelo**.
Sirviendo respuestas precalculadas no hay forma de hacerle miles de consultas
para reconstruir la quimica que aprendio.

Se pierde: la rejilla **cuantiza**. El usuario elige entre los pasos que haya,
no una temperatura cualquiera. Con los cinco controles a resolucion fina saldrian
decenas de millones de combinaciones, asi que los pasos son gruesos a proposito.

Lo que NO sustituye
-------------------
El bucle de laboratorio. Pedir 24 condiciones para la proxima placa, registrar la
prediccion y comparar con el resultado real necesita modelo vivo y base de datos:
depende de datos que todavia no existen. La web es una demostracion del sistema,
no el sistema.

Dos decisiones de honestidad
----------------------------
1. **La rejilla no sale del rango observado.** Temperatura 25-160 C, ratio L/M
   0,1-1,0: son los limites reales del historico. Dejar pedir 200 C seria invitar
   al modelo a extrapolar y presentar el resultado como si valiera lo mismo.
2. **Cada metal parte de su propia sintesis mediana.** Las variables que no se
   exponen (ligando, disolventes, volumenes) se fijan en la mediana de las
   sintesis reales de ese metal, no en una media global: asi cada punto de la
   rejilla es una receta quimicamente plausible y no una mezcla imposible.

El ligando queda oculto por decision D4: es donde esta la quimica propietaria.

Uso
---
    python scripts/build_simulator_grid.py
"""

from __future__ import annotations

import base64
import datetime as _dt
import json
import os
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Se escribe en public/ y no en src/: importarlo desde el codigo lo empaquetaria
# dentro del bundle principal, que pasaria de 460 a 617 KB para todo el que
# entre a la web aunque no abra el simulador. Sirviendolo como fichero suelto,
# se descarga solo cuando hace falta.
OUT = ROOT / "web" / "public" / "data" / "simulator_grid.json"

# El modelo NO se nombra aqui. Se pregunta a la base cual ocupa la ranura de
# despliegue 'primary' (ml_models.deployment_slot). Escribirlo a mano fue un
# fallo real y silencioso: este fichero llevaba dentro 'crystallinity_v3_hts_full',
# se entreno el v4 --que corrige un error de unidades de factor 1000-- y la web
# siguio sirviendo predicciones del v3 sin que nada avisara. Un modelo obsoleto
# no da error: da respuestas.
MODEL_SLOT = "primary"
MIN_SYNTHESES = 25  # metales con menos historico no entran: su mediana no es fiable

# Los ejes que el usuario puede mover.
#
# Tres de ellos NO se escriben aqui: se leen del conjunto con el que se entreno
# el modelo desplegado (ver ejes_observados). Temperatura, tiempo y ratio son
# discretos en la practica --el laboratorio usa 9, 3 y 8 valores respectivamente,
# no un continuo-- y ofrecer al usuario un valor que nunca se probo es pedirle al
# modelo una extrapolacion disfrazada de prediccion. Estuvieron escritos a mano y
# ofrecian 25 grados, 1 hora y ratio 0,4, ninguno de los cuales existe en el
# registro, mientras la web afirmaba lo contrario tres centimetros mas abajo.
#
# El modulador si es continuo (71 valores distintos en el historico), asi que su
# escalera se elige a mano; va de 0 a 16 mmol, dentro del maximo observado.
AXES_FIJOS = {
    "mod_carboxylic_mmol": [0.0, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0],
}

AXES_OBSERVADOS = ["temp_target_c", "time_hours", "lm_ratio"]


def ejes_observados(cur, dataset_slug):
    """Devuelve los valores que el laboratorio uso de verdad, en orden.

    Se ejecuta la propia `source_query` que el registro guarda para el conjunto,
    en vez de reescribir sus filtros aqui: dos copias de la misma definicion
    acaban divergiendo, y la que manda es la registrada.
    """
    cur.execute("SELECT source_query FROM ml_datasets WHERE dataset_slug = %s", (dataset_slug,))
    fila = cur.fetchone()
    if not fila:
        raise SystemExit("no encuentro el conjunto %s en ml_datasets" % dataset_slug)
    consulta = fila[0]

    ejes = {}
    for col in AXES_OBSERVADOS:
        cur.execute(
            "SELECT DISTINCT %s FROM (%s) AS d WHERE %s IS NOT NULL ORDER BY 1"
            % (col, consulta, col)
        )
        ejes[col] = [float(r[0]) for r in cur.fetchall()]
    return ejes


CLASSES_ORDER = ["AMORFO", "INCIPIENTE", "CRISTALINO"]


def connect():
    import psycopg2
    from dotenv import load_dotenv

    # Sube por los directorios padre buscando el .env: dentro de un worktree de
    # git el fichero no esta, porque esta ignorado.
    for base in [ROOT, *ROOT.parents]:
        if (base / ".env").exists():
            load_dotenv(base / ".env")
            break
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        dbname=os.getenv("POSTGRES_DB", "alchemy_db"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
    )


def main() -> int:
    import pandas as pd
    from src.ml_model_registry import cargar_modelo, columnas_de_entrada, modelo_desplegado

    conn = connect()
    cur = conn.cursor()

    model_slug = modelo_desplegado(conn, MODEL_SLOT)
    # El contrato viene ORDENADO por feature_position, no en el orden en que la
    # base devuelva las filas. Sin ORDER BY el orden no esta garantizado, y un
    # pipeline con las columnas cruzadas no siempre falla: puede predecir con el
    # radio ionico entrando por la casilla de la temperatura y devolver algo
    # perfectamente plausible y perfectamente falso.
    features = columnas_de_entrada(conn, model_slug)
    print("ranura %r -> modelo %s (%d variables de entrada)"
          % (MODEL_SLOT, model_slug, len(features)))

    # Los ejes discretos salen del conjunto con el que se entreno ESE modelo, no
    # de una lista escrita aqui: asi el simulador no puede ofrecer una condicion
    # que el laboratorio nunca probo.
    cur.execute(
        "SELECT d.dataset_slug FROM ml_datasets d "
        "JOIN ml_models m ON m.dataset_id = d.dataset_id WHERE m.model_slug = %s",
        (model_slug,),
    )
    dataset_slug = cur.fetchone()[0]
    AXES = dict(ejes_observados(cur, dataset_slug))
    AXES.update(AXES_FIJOS)
    print("conjunto %s -> ejes observados:" % dataset_slug)
    for nombre in AXES_OBSERVADOS:
        valores = AXES[nombre]
        print("   %-22s %d valores  %s" % (nombre, len(valores), valores))

    df = pd.read_sql("SELECT * FROM v_ml_features WHERE synthesis_type = 'HTS'", conn)
    modelo = cargar_modelo(conn, model_slug)

    # Orden de clases tal como lo aprendio el modelo, para no reordenar a ciegas.
    classes = list(getattr(modelo, "classes_", CLASSES_ORDER))
    print("clases del modelo:", classes)

    counts = df["metal_center"].value_counts()
    metals = [m for m in counts.index if counts[m] >= MIN_SYNTHESES]
    metals.sort()
    print("metales con >= %d sintesis: %s" % (MIN_SYNTHESES, ", ".join(metals)))

    # Plantilla por metal: la sintesis mediana de ese metal. Numericas por
    # mediana, categoricas por moda.
    templates = {}
    for m in metals:
        sub = df[df["metal_center"] == m]
        row = {}
        for f in features:
            col = sub[f]
            if col.dtype.kind in "ifb":
                row[f] = col.median()
            else:
                mode = col.mode()
                row[f] = mode.iloc[0] if len(mode) else None
        templates[m] = row

    axis_names = list(AXES)
    shape = [len(metals)] + [len(AXES[a]) for a in axis_names]
    total = int(np.prod(shape))
    print("rejilla: %s = %d combinaciones" % (" x ".join(str(s) for s in shape), total))

    rows = []
    for m in metals:
        base = templates[m]
        for t in AXES["temp_target_c"]:
            for h in AXES["time_hours"]:
                for r in AXES["lm_ratio"]:
                    for mod in AXES["mod_carboxylic_mmol"]:
                        row = dict(base)
                        row["temp_target_c"] = t
                        row["time_hours"] = h
                        row["lm_ratio"] = r
                        # Al mover el modulador carboxilico hay que mover tambien
                        # el total, o el vector queda internamente incoherente.
                        delta = mod - base["mod_carboxylic_mmol"]
                        row["mod_carboxylic_mmol"] = mod
                        row["mod_total_mmol"] = max(0.0, base["mod_total_mmol"] + delta)
                        rows.append(row)

    X = pd.DataFrame(rows)[features]
    print("prediciendo %d filas..." % len(X))
    proba = modelo.predict_proba(X)

    # Reordenar a AMORFO / INCIPIENTE / CRISTALINO, pase lo que pase en classes_.
    idx = [list(classes).index(c) for c in CLASSES_ORDER]
    proba = proba[:, idx]

    # Cuantizar a un byte por clase: 1/255 de resolucion sobra para una barra de
    # confianza, y baja el fichero de varios MB a poco mas de cien KB.
    q = np.clip(np.round(proba * 255), 0, 255).astype(np.uint8)

    payload = {
        # Se sella con QUE modelo se calculo y cuando. Una rejilla sin esa marca
        # es indistinguible de una generada con el modelo anterior.
        "model": model_slug,
        "generatedAt": _dt.date.today().isoformat(),
        "classes": CLASSES_ORDER,
        "metals": metals,
        "axes": {a: AXES[a] for a in axis_names},
        "axisOrder": ["metal"] + axis_names,
        "shape": shape,
        "encoding": "uint8 probabilities, 3 per cell, base64, C order",
        "data": base64.b64encode(q.tobytes()).decode("ascii"),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print("escrito %s (%.0f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))

    # Comprobacion de cordura: el reparto de clases predichas sobre la rejilla.
    pred = proba.argmax(axis=1)
    for i, c in enumerate(CLASSES_ORDER):
        print("  %-11s %5.1f %% de la rejilla" % (c, 100 * (pred == i).mean()))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
