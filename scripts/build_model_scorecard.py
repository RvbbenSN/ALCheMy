#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Exporta a la web las cifras del modelo desplegado, leidas de la base.

Que problema resuelve
---------------------
Las metricas del modelo estaban escritas a mano dentro de un componente de React
(`web/src/components/ModelScorecard.jsx`): F1 macro 0,522, acierto por clase
0,50 / 0,71 / 0,50... Son las cifras del v3. Cuando se entreno el v4 --que
corrige un error de unidades de factor 1000-- la pagina siguio ensenando las
viejas, porque un numero escrito a mano no se entera de que el modelo ha
cambiado. No hay error posible que avise de eso: la web se ve perfecta.

Este script cierra el circulo. Lee de `ml_models` que modelo ocupa cada ranura
de despliegue, saca sus metricas de `ml_model_metrics` y escribe un JSON que el
componente importa. Sacar un modelo nuevo pasa a ser: mover la ranura, ejecutar
esto, ejecutar `build_simulator_grid.py`, reconstruir la web.

Por que el JSON lleva solo NUMEROS y no textos
----------------------------------------------
Los rotulos, las explicaciones y el idioma de la pagina son contenido, y viven
en el componente. Aqui viaja lo que la base sabe y el frontal no puede inventar:
cifras, tamanos de muestra y el nombre del modelo del que salen. Mezclar ambas
cosas obligaria a tocar Python para corregir una frase.

El clasificador trivial
-----------------------
Se calcula, no se copia. Un F1 de 0,52 no significa nada suelto: hay que saber
que da el modelo tonto que responde siempre la clase mayoritaria. Con esa
estrategia, sobre la distribucion real del conjunto, sale exacto y sin entrenar
nada: la exactitud es la fraccion de la clase mayoritaria, la exactitud
equilibrada es 1/k, el MCC es 0 por definicion (no hay correlacion posible si la
prediccion es constante) y el F1 macro es el de la clase mayoritaria dividido
entre k, porque las otras dos clases puntuan cero.

Uso
---
    python scripts/build_model_scorecard.py

Codigo de salida 1 si una ranura esta vacia o si al modelo desplegado le faltan
metricas por clase (se registran con `scripts/register_class_metrics.py`).
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

OUT = ROOT / "web" / "src" / "data" / "model_scorecard.json"

# Las que la pagina ensena. Pedirlas explicitamente hace que falte una se note
# aqui y no en forma de hueco en la tabla.
AGREGADAS = ["f1_macro", "matthews_corrcoef", "balanced_accuracy", "accuracy"]
POR_CLASE = ["recall", "precision", "f1", "support"]


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


def leer_ranura(cur, slot):
    """Los datos del modelo que ocupa esa ranura, o None si esta vacia."""
    cur.execute(
        """SELECT m.model_id, m.model_slug, m.display_name, m.algorithm, m.git_commit,
                  d.dataset_slug, d.n_rows, d.n_groups, d.class_distribution
             FROM ml_models m
             LEFT JOIN ml_datasets d ON d.dataset_id = m.dataset_id
            WHERE m.deployment_slot = %s""",
        (slot,),
    )
    fila = cur.fetchone()
    if fila is None:
        return None
    model_id, slug, nombre, algoritmo, commit, ds, n_rows, n_groups, dist = fila

    cur.execute(
        """SELECT metric_name, class_name, metric_value, metric_std, n_folds
             FROM ml_model_metrics
            WHERE model_id = %s AND split = 'cv'""",
        (model_id,),
    )
    agregadas, por_clase = {}, {}
    for nombre_m, clase, valor, desv, pliegues in cur.fetchall():
        if clase == "":
            agregadas[nombre_m] = {"value": round(valor, 4)}
            if desv is not None:
                agregadas[nombre_m]["std"] = round(desv, 4)
            if pliegues is not None:
                agregadas[nombre_m]["folds"] = pliegues
        else:
            por_clase.setdefault(clase, {})[nombre_m] = (
                int(valor) if nombre_m == "support" else round(valor, 4)
            )

    return {
        "slug": slug,
        "displayName": nombre,
        "algorithm": algoritmo,
        "gitCommit": (commit or "")[:12],
        "dataset": {
            "slug": ds,
            "nRows": n_rows,
            "nGroups": n_groups,
            "classDistribution": dist,
        },
        "metrics": agregadas,
        "perClass": por_clase,
    }


def baseline(dist):
    """El clasificador trivial: responder siempre la clase mayoritaria.

    Se deriva de la distribucion, sin entrenar nada. Sirve de suelo: sin el, una
    cifra de acierto no se puede interpretar.
    """
    n = sum(dist.values())
    k = len(dist)
    mayor = max(dist.values())
    acc = mayor / n
    # La mayoritaria acierta todos sus casos (recall 1) con precision = acc; las
    # otras clases no se predicen nunca, asi que su F1 es 0.
    f1_mayoritaria = 2 * acc / (acc + 1)
    return {
        "strategy": "most_frequent",
        "accuracy": round(acc, 4),
        "balanced_accuracy": round(1 / k, 4),
        "matthews_corrcoef": 0.0,
        "f1_macro": round(f1_mayoritaria / k, 4),
    }


def leer_registro(cur):
    """Todos los modelos entrenados, para la tabla de gobernanza de la 05.

    Se publican todos, tambien los retirados: el argumento de esa pantalla es
    que un modelo invalido se marca en vez de borrarse, y esconderlo aqui seria
    contradecirlo en el mismo sitio donde se cuenta.
    """
    cur.execute(
        """
        SELECT m.model_slug, m.algorithm, m.status,
               d.n_rows, d.n_groups,
               (SELECT metric_value FROM ml_model_metrics k
                 WHERE k.model_id = m.model_id AND k.metric_name = 'f1_macro'
                   AND k.class_name = '' AND k.split = 'cv') AS f1_macro,
               (SELECT artifact_size_bytes FROM ml_model_artifacts a
                 WHERE a.model_id = m.model_id) AS tam,
               m.model_slug
          FROM ml_models m
          LEFT JOIN ml_datasets d ON d.dataset_id = m.dataset_id
         ORDER BY m.status <> 'active', m.model_slug
        """
    )
    filas = []
    for slug, algo, estado, n_rows, n_groups, f1, tam, _ in cur.fetchall():
        filas.append({
            "name": slug,
            "algo": algo,
            "f1": ("%.3f" % f1) if f1 is not None else "\u2014",
            "size": ("%.1f MB" % (tam / 1e6)) if tam else "\u2014",
            "status": (estado or "").upper(),
            # La nota que guarda la base esta en espanol y el sitio esta en
            # ingles, asi que aqui se publica el tamano del conjunto, que es un
            # hecho y no hay que traducirlo.
            "note": ("%s rows across %d groups." % ("{:,}".format(n_rows), n_groups)
                     if n_rows and n_groups else ""),
        })
    return filas


def main() -> int:
    conn = connect()
    cur = conn.cursor()

    salida = {"generatedAt": dt.date.today().isoformat()}
    for slot in ("primary", "actionable"):
        datos = leer_ranura(cur, slot)
        if datos is None:
            print(
                "[ERROR] La ranura %r no tiene ningun modelo desplegado. Asignela con:\n"
                "    UPDATE ml_models SET deployment_slot = '%s' WHERE model_slug = '<slug>';"
                % (slot, slot)
            )
            return 1
        faltan = [m for m in AGREGADAS if m not in datos["metrics"]]
        if faltan:
            print("[ERROR] A %s le faltan metricas agregadas: %s"
                  % (datos["slug"], ", ".join(faltan)))
            return 1
        if not datos["perClass"]:
            print("[ERROR] A %s le faltan las metricas por clase. Registrelas con:\n"
                  "    python scripts/register_class_metrics.py --slot %s --registrar"
                  % (datos["slug"], slot))
            return 1
        for clase, met in datos["perClass"].items():
            ausentes = [m for m in POR_CLASE if m not in met]
            if ausentes:
                print("[ERROR] A %s, clase %s, le faltan: %s"
                      % (datos["slug"], clase, ", ".join(ausentes)))
                return 1
        salida[slot] = datos
        print("%-11s %-32s F1 macro %.3f" % (slot, datos["slug"],
                                             datos["metrics"]["f1_macro"]["value"]))

    salida["registry"] = leer_registro(cur)
    print("registro    %d modelos (%d activos)"
          % (len(salida["registry"]),
             sum(1 for m in salida["registry"] if m["status"] == "ACTIVE")))

    salida["baseline"] = baseline(salida["primary"]["dataset"]["classDistribution"])
    print("trivial     %-32s F1 macro %.3f"
          % ("(clase mayoritaria)", salida["baseline"]["f1_macro"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(salida, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("escrito %s (%.1f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
