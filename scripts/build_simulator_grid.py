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
1. **La rejilla no sale del rango observado.** Temperatura 80-160 C (9 valores
   discretos: 80, 100, 110, 120, 130, 135, 140, 150, 160 C), tiempo 24-72 h
   (24, 48, 72 h), ratio L/M 0,15-1,0 (8 valores: 0,15, 0,2, 0,3, 0,33, 0,5,
   0,6, 0,8, 1,0) y modulador carboxilico 0,0-16,0 mmol (de un maximo observado
   de 26,2 mmol en 71 niveles distintos): son los limites reales del historico.
   Dejar pedir 200 C o 25 C seria invitar al modelo a extrapolar y presentar el
   resultado como si valiera lo mismo.
2. **Cada metal parte de su propia sintesis mediana.** Las variables que no se
   exponen (ligando, disolventes, volumenes) se fijan en la mediana de las
   sintesis reales de ese metal, no en una media global: asi cada punto de la
   rejilla es una receta quimicamente plausible y no una mezcla imposible.

El ligando queda oculto por decision D4: es donde esta la quimica propietaria.

Uso
---
    python scripts/build_simulator_grid.py                    # rejilla de produccion
    python scripts/build_simulator_grid.py --compare-medoids  # comparativa mediana vs medoide
    python scripts/build_simulator_grid.py --prototype-medoid # prototipo rejilla por medoide
"""

from __future__ import annotations

import base64
import datetime as _dt
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

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

    # Sube por los directorios padre o busca en el repositorio principal el .env:
    # dentro de un worktree de git el fichero no esta, porque esta ignorado.
    for base in [ROOT, *ROOT.parents, ROOT.parent / "ALCheMy"]:
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


# Molar volume factor for pure acetic acid (density 1.050 g/mL, purity 99.8%, MW 60.05 g/mol):
# 60.05 / (1.050 * 0.998 * 1000.0) = 0.0573056 mL/mmol (~57.3 uL/mmol).
ML_PER_MMOL_ACOH = 60.05 / (1.050 * 0.998 * 1000.0)


def build_medoid_templates(df, metals, features):
    """Construye plantillas para el simulador usando la sintesis real (medoide) de cada metal.

    Para cada metal con >= MIN_SYNTHESES en HTS, selecciona la fila real cuya distancia
    euclidea estandarizada a la mediana multivariante es minima. A diferencia de la mediana
    columna a columna:
    - Las fracciones de disolvente y modulador suman 1.0 (coherencia estequiometrica).
    - No se crean mezclas sinteticas con ceros artificiales.
    - Se preserva el emparejamiento real de ligando, modulador y medio.

    Devuelve:
        templates: dict {metal: dict_features}
        metadata: dict {metal: {sample_code, distance, hts_number, linker}}
    """
    num_cols = [f for f in features if df[f].dtype.kind in "ifb"]
    templates = {}
    metadata = {}
    for m in metals:
        sub = df[df["metal_center"] == m].copy()
        X_num = sub[num_cols].copy()
        for col in num_cols:
            if X_num[col].isna().any():
                med = X_num[col].median()
                if pd.isna(med):
                    med = df[col].median()
                X_num[col] = X_num[col].fillna(med)
        medians = X_num.median()
        stds = X_num.std()
        z_diffs = []
        for col in num_cols:
            s = stds[col]
            if s > 1e-9:
                z = (X_num[col] - medians[col]) / s
            else:
                z = np.zeros(len(X_num))
            z_diffs.append(np.asarray(z))
        Z = np.column_stack(z_diffs)
        dists = np.linalg.norm(Z, axis=1)
        best_pos = int(np.argmin(dists))
        best_row = sub.iloc[best_pos]

        template_row = {f: best_row[f] for f in features}
        templates[m] = template_row
        metadata[m] = {
            "sample_code": best_row["sample_code"],
            "hts_number": best_row.get("hts_number", "N/A"),
            "distance": float(dists[best_pos]),
            "linker": best_row.get("linker", "N/A"),
        }
    return templates, metadata


def adjust_row_modulator(base_row, mod_target, acid_pka=4.76, acid_logp=-0.17):
    """Recalcula las variables derivadas al mover mod_carboxylic_mmol (hallazgo M6).

    Al variar mod_carboxylic_mmol:
    1. mod_total_mmol se actualiza sumando delta = mod_target - base_mod.
    2. frac_modulator se actualiza sumando el volumen del acido acetico anadido
       (ML_PER_MMOL_ACOH = 0.05731 mL/mmol) al volumen previo del modulador.
    3. mod_carbox_mean_pka y mod_carbox_mean_logp se calculan como promedio
       ponderado entre el modulador base y el acido acetico dosificado. Si la
       sintesis base no contenia carboxilico, se asigna pKa = 4.76 y logP = -0.17
       en vez de mantener un valor imputado previo. Si mod_target == 0, se deja NaN.
    """
    row = dict(base_row)
    base_mod = float(base_row.get("mod_carboxylic_mmol", 0.0) or 0.0)
    base_total = float(base_row.get("mod_total_mmol", 0.0) or 0.0)
    total_vol = float(base_row.get("total_volume_ml", 1.5) or 1.5)

    delta = mod_target - base_mod
    row["mod_carboxylic_mmol"] = mod_target
    row["mod_total_mmol"] = max(0.0, base_total + delta)

    # Recalculo de frac_modulator
    base_frac_mod = float(base_row.get("frac_modulator", 0.0) or 0.0)
    base_mod_vol = base_frac_mod * total_vol
    new_mod_vol = max(0.0, base_mod_vol + delta * ML_PER_MMOL_ACOH)
    row["frac_modulator"] = new_mod_vol / total_vol if total_vol > 0 else 0.0

    # Recalculo de pKa y logP medios
    if mod_target <= 1e-6:
        row["mod_carbox_mean_pka"] = np.nan
        row["mod_carbox_mean_logp"] = np.nan
    else:
        if base_mod <= 1e-6:
            row["mod_carbox_mean_pka"] = acid_pka
            row["mod_carbox_mean_logp"] = acid_logp
        else:
            base_pka = float(base_row.get("mod_carbox_mean_pka", acid_pka) or acid_pka)
            base_logp = float(base_row.get("mod_carbox_mean_logp", acid_logp) or acid_logp)
            if delta >= 0:
                weighted_pka = (base_mod * base_pka + delta * acid_pka) / mod_target
                weighted_logp = (base_mod * base_logp + delta * acid_logp) / mod_target
            else:
                weighted_pka = base_pka
                weighted_logp = base_logp
            row["mod_carbox_mean_pka"] = weighted_pka
            row["mod_carbox_mean_logp"] = weighted_logp

    return row


def compare_templates_old_vs_medoid(df, metals, features):
    """Compara cuantitativamente la plantilla de mediana frente al medoide para cada metal."""
    import pandas as pd
    solv_cols = [
        "frac_h2o", "frac_meoh", "frac_etoh", "frac_proh",
        "frac_dmf", "frac_def", "frac_acoh", "frac_h2po4",
        "frac_nh4oh", "frac_modulator"
    ]
    old_templates = {}
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
        old_templates[m] = row

    med_templates, med_meta = build_medoid_templates(df, metals, features)

    rows = []
    for m in metals:
        old = old_templates[m]
        med = med_templates[m]
        meta = med_meta[m]

        old_solv = sum(old[c] for c in solv_cols if pd.notna(old.get(c)))
        med_solv = sum(med[c] for c in solv_cols if pd.notna(med.get(c)))

        rows.append({
            "metal": m,
            "sample_medoid": meta["sample_code"],
            "dist": round(meta["distance"], 2),
            "old_solv_sum": round(old_solv, 3),
            "med_solv_sum": round(med_solv, 3),
            "old_mod_mmol": round(float(old.get("mod_carboxylic_mmol", 0.0) or 0.0), 2),
            "med_mod_mmol": round(float(med.get("mod_carboxylic_mmol", 0.0) or 0.0), 2),
            "old_frac_mod": round(float(old.get("frac_modulator", 0.0) or 0.0), 4),
            "med_frac_mod": round(float(med.get("frac_modulator", 0.0) or 0.0), 4),
            "old_pka": round(float(old.get("mod_carbox_mean_pka", np.nan)), 2) if pd.notna(old.get("mod_carbox_mean_pka")) else None,
            "med_pka": round(float(med.get("mod_carbox_mean_pka", np.nan)), 2) if pd.notna(med.get("mod_carbox_mean_pka")) else None,
            "med_linker": meta["linker"],
        })
    return pd.DataFrame(rows)


def prototype_medoid_grid(conn, model_slug, df, metals, features, AXES):
    """Prototipo de generacion de rejilla usando medoide y recalculo coherente de modulador."""
    import pandas as pd
    from src.ml_model_registry import cargar_modelo
    modelo = cargar_modelo(conn, model_slug)
    classes = list(getattr(modelo, "classes_", CLASSES_ORDER))
    templates, metadata = build_medoid_templates(df, metals, features)

    rows = []
    for m in metals:
        base = templates[m]
        for t in AXES["temp_target_c"]:
            for h in AXES["time_hours"]:
                for r in AXES["lm_ratio"]:
                    for mod in AXES["mod_carboxylic_mmol"]:
                        row = adjust_row_modulator(base, mod)
                        row["temp_target_c"] = t
                        row["time_hours"] = h
                        row["lm_ratio"] = r
                        rows.append(row)

    X = pd.DataFrame(rows)[features]
    proba = modelo.predict_proba(X)
    idx = [list(classes).index(c) for c in CLASSES_ORDER]
    proba = proba[:, idx]
    pred = proba.argmax(axis=1)

    print("Prototipo Medoide (%d combinaciones calculadas):" % len(X))
    for i, c in enumerate(CLASSES_ORDER):
        print("  %-11s %5.1f %% de la rejilla" % (c, 100 * (pred == i).mean()))
    return proba


def main(argv: list[str] | None = None) -> int:
    import argparse
    import pandas as pd
    from src.ml_model_registry import cargar_modelo, columnas_de_entrada, modelo_desplegado

    parser = argparse.ArgumentParser(description="Precalcula o analiza la rejilla del simulador.")
    parser.add_argument("--compare-medoids", action="store_true",
                        help="Compara la plantilla mediana con el medoide real por metal (sin tocar JSON).")
    parser.add_argument("--prototype-medoid", action="store_true",
                        help="Ejecuta el prototipo de rejilla por medoide (sin tocar simulator_grid.json).")
    args = parser.parse_args(argv)

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

    if args.compare_medoids:
        print("\n=== Comparativa Plantilla Mediana vs Medoide Real por Metal ===")
        comp_df = compare_templates_old_vs_medoid(df, metals, features)
        print(comp_df.to_string(index=False))
        conn.close()
        return 0

    if args.prototype_medoid:
        print("\n=== Prototipo de Rejilla con Medoide y Recalculo Coherente ===")
        prototype_medoid_grid(conn, model_slug, df, metals, features, AXES)
        conn.close()
        return 0

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
