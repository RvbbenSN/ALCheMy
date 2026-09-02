#!/usr/bin/env python3
"""Congela un ejemplo de fila ya ingestada para el visualizador de la web.

Que problema resuelve
---------------------
La pantalla 02 explica que todo fichero de instrumento acaba en una fila con la
misma forma, y lo cuenta con una tabla de nombres de campo. Una tabla de nombres
no ensena lo que de verdad sorprende al verlo: que de un `.xrdml` de 3.580
puntos salen **cuarenta y tantos campos de cabecera** que nadie transcribio a
mano, y que estan ahi para siempre. Este script saca una fila real y la deja
lista para dibujarla como arbol desplegable.

Por que los datos son sinteticos
--------------------------------
La fila es real en su ESTRUCTURA y en la clase de valores que contiene, pero
todo lo que identifica se sustituye antes de escribir nada:

  * `sample_code` y los campos `sample_*_raw` del difractometro, que llevan el
    codigo de muestra incrustado en el nombre del fichero;
  * los nombres de personas, tanto el del investigador como el de quien preparo
    la muestra;
  * el correo, la ruta en disco y el numero de serie del equipo;
  * el hash, que es la huella del fichero real.

Los parametros instrumentales (voltaje, rendijas, longitudes de onda) se dejan
tal cual: son propiedades del difractometro, no del proyecto, y falsearlos
convertiria la figura en un dibujo.

Las curvas se recortan a unos pocos puntos con marca de elision, porque el
arbol tiene que ensenar que ahi hay 3.580 numeros, no imprimirlos.

Uso
---
    python scripts/build_ingested_example.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "src" / "data" / "ingested_example.json"

# Sustituciones de identidad. Clave: campo; valor: lo que se publica.
PSEUDONYM = {
    "sample_code": "SYN-0042",
    "researcher_name": "R. Researcher",
    "researcher_email": "researcher@institute.example",
    "operator_name": "Diffraction service",
    "file_name": "24DRX0180-SYN-0042.xrdml",
    "raw_file_path": "/home/node/data/raw_datalake/PXRD/24DRX0180-SYN-0042.xrdml",
    "file_hash": "b7e4c1a09f3d82e6a5c04bd719fe3a28",
    "measurement_id": "3f2a91c4-…-8d7e",
}

# Campos de la cabecera del instrumento que llevan identidad incrustada.
HEADER_PSEUDONYM = {
    "sample_id_raw": "24DRX0180-SYN-0042_MPy",
    "sample_name_raw": "24DRX0180-SYN-0042_MPy-Researcher",
    "prepared_by": "R. Researcher",
    "instrument_id": "00000000########",
}


def connect():
    import psycopg2
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        dbname=os.getenv("POSTGRES_DB", "alchemy_db"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
    )


def main() -> int:
    conn = connect()
    cur = conn.cursor()

    # Una medida PXRD cualquiera que tenga cabecera rica. Se ordena por numero
    # de claves para que el ejemplo sea representativo del caso bueno, no de un
    # fichero al que le faltaba media cabecera.
    cur.execute(
        """
        SELECT sample_code, technique, measurement_tag, instrument_name, data_json
        FROM characterization_measurements
        WHERE technique = 'PXRD'
          AND data_json ? 'header_metadata'
        ORDER BY jsonb_array_length(
                   COALESCE(jsonb_path_query_array(data_json->'header_metadata', '$.keyvalue().key'), '[]')
                 ) DESC NULLS LAST
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if row is None:
        print("ERROR: no hay medidas PXRD con cabecera", file=sys.stderr)
        return 2

    _sample, technique, tag, instrument, dj = row
    header = dict(dj.get("header_metadata") or {})
    raw = dict(dj.get("raw_data") or {})

    for k, v in HEADER_PSEUDONYM.items():
        if k in header:
            header[k] = v

    xs = raw.get("x") or []
    ys = raw.get("y") or []
    n = len(xs)

    def sample_curve(arr):
        if not arr:
            return []
        head = [round(float(v), 4) for v in arr[:3]]
        tail = [round(float(v), 4) for v in arr[-2:]]
        return head + ["… %d more …" % max(0, len(arr) - 5)] + tail

    payload = {
        "note": (
            "Structure and instrument settings are real. Sample code, names, e-mail, file "
            "path, hash and serial number are replaced; the curves are truncated."
        ),
        "pointCount": n,
        "headerFieldCount": len(header),
        "row": {
            "measurement_id": PSEUDONYM["measurement_id"],
            "sample_code": PSEUDONYM["sample_code"],
            "researcher_name": PSEUDONYM["researcher_name"],
            "researcher_email": PSEUDONYM["researcher_email"],
            "technique": technique,
            "operator_name": PSEUDONYM["operator_name"],
            "measurement_tag": tag,
            "instrument_name": instrument,
            "file_name": PSEUDONYM["file_name"],
            "raw_file_path": PSEUDONYM["raw_file_path"],
            "file_hash": PSEUDONYM["file_hash"],
            "data_json": {
                "header_metadata": header,
                "raw_data": {
                    "x_label": raw.get("x_label"),
                    "y_label": raw.get("y_label"),
                    "x": sample_curve(xs),
                    "y": sample_curve(ys),
                },
            },
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    print("tecnica          %s" % technique)
    print("campos cabecera  %d" % len(header))
    print("puntos de curva  %d" % n)
    print("escrito          %s (%.1f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
