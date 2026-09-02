#!/usr/bin/env python3
"""Extrae los datos de la figura del difractograma para la aplicacion web.

Que problema resuelve
---------------------
La pantalla de preparacion de datos tiene que ensenar como se pasa de una curva
cruda a 29 numeros. Dibujarlo con datos inventados seria una demostracion vacia:
cualquiera puede dibujar una curva bonita. Este script saca **difractogramas
reales del laboratorio**, les aplica **el pipeline real del proyecto**
(`src/pxrd_descriptors.py`, el mismo que llenó `pxrd_descriptors`) y congela el
resultado como JSON estatico para que la web lo dibuje sin necesitar backend.

Que ejemplo elige, y por que importa
------------------------------------
El **caso mediano** de cada clase por fraccion cristalina, no el mas vistoso.
Es la misma regla que siguen los cuadernos del proyecto: un metodo se ensena
actuando sobre un ejemplo representativo, porque elegir el mas favorable
convierte la figura en publicidad en vez de en evidencia. El amorfo mediano se
ve mediocre a proposito.

Privacidad
----------
El `sample_code` se sustituye por un seudonimo antes de escribir nada, y no se
exporta ninguna condicion de sintesis: solo la curva y sus descriptores. El
metal tampoco se incluye, porque para esta figura no aporta.

Uso
---
    python scripts/build_pxrd_figure_data.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

OUT = ROOT / "web" / "src" / "data" / "pxrd_examples.json"
CLASSES = ["AMORFO", "INCIPIENTE", "CRISTALINO"]
N_POINTS_WEB = 480  # suficiente para que la curva se lea; el grid interno es mucho mas denso

PSEUDONYM = {"AMORFO": "SMP-A", "INCIPIENTE": "SMP-I", "CRISTALINO": "SMP-C"}

# Descriptores que se ensenan junto a la curva. Son los que se leen
# directamente en la figura, no los 29 completos.
SHOWN = [
    ("n_peaks", "Accepted reflections", ""),
    ("crystalline_fraction", "Crystallinity index", ""),
    ("fwhm_median_deg", "Median FWHM", "°"),
    ("scherrer_size_nm", "Scherrer size", "nm"),
    ("d_max_angstrom", "Max d-spacing", "Å"),
    ("spectral_entropy", "Spectral entropy", ""),
    ("snr_global", "Signal-to-noise", ""),
    ("amorphous_hump_center", "Halo centre", "°"),
]


def connect():
    """Mismo patron de conexion que el resto de scripts del proyecto."""
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


def median_case(cur, klass):
    """El caso mediano de la clase por fraccion cristalina.

    NO se filtra por `crystallinity_reliable`. Ese flag marca si hay senal
    suficiente para fiarse del indice de cristalinidad, y un amorfo por
    definicion casi no tiene: es falso en 460 de los 484 amorfos etiquetados.
    Filtrar por el dejaria como "amorfo mediano" un caso atipico con senal
    fuerte —mediana 0,75 en vez de 0,01— es decir, justo lo contrario de un
    ejemplo representativo.
    """
    # El join va por file_hash, NO por sample_code: 43 muestras tienen mas de
    # una medida PXRD etiquetada por separado, asi que unir por muestra empareja
    # descriptores con la etiqueta de otra medida distinta. Es el mismo problema
    # de unicidad que documenta el cuaderno 06.
    cur.execute(
        """
        SELECT d.measurement_id, d.sample_code, d.crystalline_fraction
        FROM pxrd_descriptors d
        JOIN characterization_measurements m ON m.measurement_id = d.measurement_id
        JOIN pxrd_labels l ON l.file_hash = m.file_hash
                          AND l.label_type = 'crystallinity_class'
        WHERE l.label_value = %s
          AND d.crystalline_fraction IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM pxrd_labels x
              WHERE x.file_hash = m.file_hash
                AND x.label_type = 'ml_include' AND x.label_value = 'NO')
        ORDER BY d.crystalline_fraction
        """,
        (klass,),
    )
    rows = cur.fetchall()
    if not rows:
        return None
    return rows[len(rows) // 2]


def main() -> int:
    from src.pxrd_descriptors import (
        amorphous_from_blank,
        arpls_baseline,
        decompose_profile,
        detect_peaks_poisson,
        load_instrument_blank,
        normalize_by_area,
        poisson_noise_level,
        resample_to_grid,
        GRID_2THETA,
    )

    conn = connect()
    cur = conn.cursor()
    out = []

    for klass in CLASSES:
        pick = median_case(cur, klass)
        if pick is None:
            print("aviso: sin casos para %s" % klass, file=sys.stderr)
            continue
        mid, sample, frac = pick

        cur.execute(
            "SELECT data_json->'raw_data'->'x', data_json->'raw_data'->'y' "
            "FROM characterization_measurements WHERE measurement_id = %s",
            (mid,),
        )
        xr, yr = cur.fetchone()
        x_raw = np.asarray(xr, dtype=float)
        y_raw = np.asarray(yr, dtype=float)

        # Solo la region que el instrumento visito de verdad: fuera de ella
        # resample_to_grid marca invalido en vez de extrapolar, y extrapolar
        # seria inventar cuentas en angulos que nunca se midieron.
        grid, y_grid, valid = resample_to_grid(x_raw, y_raw)
        x = grid[valid]
        y = y_grid[valid]
        layers = decompose_profile(y, x)
        noise = poisson_noise_level(y, x)
        peaks, _fw = detect_peaks_poisson(x, layers["crystalline"], noise)

        # ---- La descomposicion que de verdad hay que ensenar ---------------
        # `decompose_profile` separa el halo por ANCHURA, y el propio modulo
        # avisa de que ese numero solo sirve para ordenar: "the number to trust
        # is amorphous_fraction_blank". En un amorfo el halo es tan ancho como
        # la ventana medida, asi que la linea base arPLS lo sigue y se lo lleva
        # entero — medido, se queda con el 99,5 % del area y deja un 0,4 % de
        # halo. Dibujar eso es ensenar el error contra el que advierte el texto
        # de al lado.
        #
        # La via del blanco no tiene ese problema porque no adivina donde acaba
        # el fondo: lo MIDE, con un barrido del portamuestras vacio. Lo que la
        # linea base quito menos lo que el instrumento aporta por si solo es lo
        # que el especimen disperso de forma difusa.
        norm = normalize_by_area(y, x)
        base = arpls_baseline(norm)
        blank_full = load_instrument_blank(conn, grid=grid)
        amo_blank = frac_blank = None
        if blank_full is not None:
            blank = np.asarray(blank_full, dtype=float)[valid]
            amo_blank, frac_blank, blank_scale = amorphous_from_blank(
                x, norm, blank, baseline=base)
        if amo_blank is None:
            print("aviso: sin blanco para %s, se dibuja solo la via por anchura"
                  % klass, file=sys.stderr)
            amo_blank = layers["amorphous"]
            frac_blank = None
            blank_scale = None
            instrument = layers["instrumental"]
        else:
            # El instrumento es la parte de la linea base que el blanco explica;
            # el resto de la linea base es dispersion difusa de la muestra.
            instrument = np.maximum(base - amo_blank, 0.0)
        # Bragg medido igual que en el modulo: lo que sobresale de la linea base.
        cryst_blank = np.maximum(norm - base, 0.0)

        # Descriptores ya calculados y guardados: se leen, no se recalculan,
        # para que la figura muestre exactamente lo que hay en la base.
        cur.execute(
            "SELECT %s FROM pxrd_descriptors WHERE measurement_id = %%s"
            % ", ".join(c for c, _, _ in SHOWN),
            (mid,),
        )
        vals = cur.fetchone()
        descriptors = [
            {"label": lbl, "value": (round(v, 3) if isinstance(v, float) else v), "unit": unit}
            for (col, lbl, unit), v in zip(SHOWN, vals)
        ]

        step = max(1, len(x) // N_POINTS_WEB)
        idx = np.arange(0, len(x), step)

        out.append(
            {
                "klass": klass,
                "sample": PSEUDONYM[klass],
                "crystallineFraction": round(float(frac), 4),
                "x": [round(float(v), 3) for v in x[idx]],
                "raw": [round(float(v), 6) for v in layers["normalized"][idx]],
                "instrumental": [round(float(v), 6) for v in instrument[idx]],
                "amorphous": [round(float(v), 6) for v in amo_blank[idx]],
                "crystalline": [round(float(v), 6) for v in cryst_blank[idx]],
                "baseline": [round(float(v), 6) for v in base[idx]],
                "amorphousFractionBlank": (round(float(frac_blank), 4)
                                           if frac_blank is not None else None),
                "peaks": [
                    {"x": round(float(x[p]), 3), "y": round(float(layers["crystalline"][p]), 6)}
                    for p in peaks
                ],
                "noise3sigma": round(float(3 * noise), 8),
                "descriptors": descriptors,
            }
        )
        print("%-11s %-10s  frac %.3f  blank %s  %d picos  %d puntos"
              % (klass, PSEUDONYM[klass], frac,
                 ("%.3f" % frac_blank) if frac_blank is not None else "n/d",
                 len(peaks), len(idx)))

    cur.close()
    conn.close()

    if not out:
        print("ERROR: no se ha extraido ningun ejemplo", file=sys.stderr)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print("\nescrito %s (%.1f KB)" % (OUT.relative_to(ROOT), OUT.stat().st_size / 1024))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
