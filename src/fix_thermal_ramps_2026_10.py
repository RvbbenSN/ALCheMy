# -*- coding: utf-8 -*-
"""
fix_thermal_ramps_2026_10.py -- re-parsea las rampas termicas desde el Excel.

EL PROBLEMA (hallazgos A1 y A2 de la revision del 2026-10-17)
-------------------------------------------------------------
La columna "Ti (ti) - T (t) - Tf (tf)" del Excel describe cada rampa en texto
libre, p. ej. 'r.t.(8h)-150ºC(48h)-30ºC(8h)'. El parser antiguo del cuaderno 01
tenia dos defectos:

  A1. Cuando una etapa no llevaba tiempo ('150ºC(48h)-r.t.') se inventaba una
      velocidad: 0,0 °C/min al calentar y 0,0 o 12,5 °C/min al enfriar. Esos
      numeros falsos no son quimica, son la forma de escribir del cuaderno, y
      el modelo los aprendia como si lo fueran (codifican la epoca).
  A2. Partia la cadena por TODOS los guiones, tambien el de 'r.t.(-)'. Una placa
      HTS entera (24 sintesis, 'r.t.(1h)-120ºC(12h)-r.t.(-)') quedo
      guardadas a 25 °C durante 1 h en vez de a 120 °C durante 12 h.

POR QUE SE RELEE EL EXCEL Y NO SE DEDUCE DE LA BASE
---------------------------------------------------
La primera propuesta de migracion (agy-T1) adivinaba que filas eran falsas por
el valor guardado (cooling_rate = 12,5). Ensayada en una transaccion deshecha,
habria dejado 210 sintesis como "programmed" con velocidades inventadas, porque
un 12,5 tambien puede ser real y no todas las falsas valian 12,5. Releer la
cadena original es la unica forma de saber si el tiempo estaba escrito.

QUE HACE
--------
Para cada sintesis de la base que tiene cadena de rampa en el Excel, aplica
src/thermal_ramp_parser.py y escribe las 8 columnas de rampa mas dos nuevas:

    cooling_mode        'programmed' | 'fan_asap' | 'free_oven_off' | NULL
    ramp_profile_known  TRUE solo si se conocen los tiempos de subida y bajada

Decision R3 (Ruben): '-r.t.' sin tiempo = enfriamiento libre con la estufa
apagada. En la base va NULL + cooling_mode='free_oven_off'; la imputacion de un
valor tipico se hace en el pipeline de ML, nunca aqui.

Las sintesis que no estan en el Excel (las que creo n8n, los marcadores) no se
tocan. Los codigos se emparejan con la misma desambiguacion que el cuaderno 01
(reutilizada de fix_volume_units_2026_09.py).

    python src/fix_thermal_ramps_2026_10.py            (ensayo: informa y deshace)
    python src/fix_thermal_ramps_2026_10.py --apply    (confirma)

Antes de --apply: revisar recuentos y `python scripts/backup_database.py`.
"""
import os
import sys

import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from thermal_ramp_parser import parse_full_thermal_ramp_c_min  # noqa: E402
from fix_volume_units_2026_09 import EXCEL, HOJA, FILA_CABECERA, desambiguar  # noqa: E402

COL_SAMPLE, COL_TYPE, COL_LINKER, COL_RAMPA = 7, 3, 10, 30

NUM = ['temp_initial_c', 'heating_time_hours', 'heating_rate_c_min', 'temp_target_c',
       'time_hours', 'cooling_time_hours', 'cooling_rate_c_min', 'temp_final_c']

DDL = """
ALTER TABLE synthesis_experiments
    ADD COLUMN IF NOT EXISTS cooling_mode VARCHAR(20),
    ADD COLUMN IF NOT EXISTS ramp_profile_known BOOLEAN;
COMMENT ON COLUMN synthesis_experiments.cooling_mode IS
    'Cooling regime parsed from the ramp text: programmed (explicit time), fan_asap (microwave fan, 10 min), free_oven_off (ends in r.t. with no time: oven switched off, natural cooling), NULL (no cooling stage written).';
COMMENT ON COLUMN synthesis_experiments.ramp_profile_known IS
    'TRUE only when both the heating and the cooling durations were written in the notebook. FALSE means at least one rate is NULL because it was never recorded.';
COMMENT ON COLUMN synthesis_experiments.heating_rate_c_min IS
    'Heating rate in °C/min = (T - Ti) / heating time. NULL when the heating time was not written (never imputed in the database).';
COMMENT ON COLUMN synthesis_experiments.cooling_rate_c_min IS
    'Cooling rate in °C/min = (T - Tf) / cooling time. NULL when the cooling time was not written; see cooling_mode for how it cooled.';
"""

DICCIONARIO = [
    ('cooling_mode', 'Cooling mode', None, 'VARCHAR(20)',
     'programmed, fan_asap, free_oven_off, NULL',
     'How the reactor cooled, parsed from the ramp text. free_oven_off = ends in r.t. with no '
     'time written: the oven was switched off and cooled naturally.'),
    ('ramp_profile_known', 'Ramp profile known', None, 'BOOLEAN', 'TRUE, FALSE',
     'TRUE only when both heating and cooling durations were written. When FALSE, at least '
     'one rate is NULL because it was never recorded; any imputation happens in the ML pipeline.'),
]


def leer_rampas():
    import openpyxl
    wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
    ws = wb[HOJA]
    filas = []
    for row in ws.iter_rows(min_row=FILA_CABECERA + 1, values_only=True):
        s = row[COL_SAMPLE - 1]
        if s is None or not str(s).strip():
            continue
        t, lk, r = row[COL_TYPE - 1], row[COL_LINKER - 1], row[COL_RAMPA - 1]
        filas.append({'sample': str(s).strip(),
                      'type': str(t).strip() if t is not None else 'ST',
                      'linker': str(lk).strip() if lk is not None else '',
                      'rampa': str(r).strip() if r is not None else None})
    return desambiguar(pd.DataFrame(filas))


def _num(x):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), 4)


def main():
    aplicar = '--apply' in sys.argv
    load_dotenv(r'C:\Users\rubbe\Documents\ALCheMy\.env')
    conn = psycopg2.connect(host='localhost', port=5432, dbname='alchemy_db',
                            user=os.getenv('POSTGRES_USER'),
                            password=os.getenv('POSTGRES_PASSWORD'))
    conn.autocommit = False
    cur = conn.cursor()

    xl = leer_rampas()
    # 'UNK' no aporta nada que mejore lo guardado (temp_target_c es NOT NULL y ya
    # tiene valor): esas filas no se tocan.
    xl = xl[xl.rampa.notna() & ~xl.rampa.str.upper().isin(['', 'UNK', 'NAN', 'NONE'])]
    antes = pd.read_sql('SELECT sample_code, %s FROM synthesis_experiments' % ', '.join(NUM), conn)
    xl = xl[xl.sample_code.isin(antes.sample_code)].reset_index(drop=True)
    print('sintesis con cadena de rampa que cruzan con la base: %d' % len(xl))

    nuevo = xl.rampa.apply(parse_full_thermal_ramp_c_min)
    nuevo.insert(0, 'sample_code', xl.sample_code)
    nuevo['rampa'] = xl.rampa

    comp = antes.merge(nuevo, on='sample_code', suffixes=('_antes', ''))
    cambia = pd.Series(False, index=comp.index)
    for c in NUM:
        a = pd.to_numeric(comp[c + '_antes'], errors='coerce').astype(float)
        b = pd.to_numeric(comp[c], errors='coerce').astype(float)
        # 5e-3: los tiempos se guardan con 2 decimales (5' = 0,0833 h queda en 0,08),
        # y eso no es un cambio real.
        dif = ~(((a - b).abs() < 5e-3) | (a.isna() & b.isna()))
        cambia |= dif
        print('  %-20s cambia en %4d filas' % (c, dif.sum()))
    print('filas con algun cambio numerico: %d' % cambia.sum())
    print('\ncooling_mode:\n%s' % nuevo.cooling_mode.fillna('NULL').value_counts().to_string())
    print('\nramp_profile_known:\n%s' % nuevo.ramp_profile_known.value_counts().to_string())

    a2 = comp[comp.rampa.str.contains('(-)', regex=False)]
    print('\nA2 (cadenas con "(-)"): %d filas, T objetivo antes %s -> ahora %s'
          % (len(a2), sorted(a2.temp_target_c_antes.dropna().unique().tolist()),
             sorted(a2.temp_target_c.dropna().unique().tolist())))

    cur.execute(DDL)
    for col, full, unit, dtype, cats, desc in DICCIONARIO:
        cur.execute("DELETE FROM data_dictionary WHERE table_name='synthesis_experiments' AND column_name=%s", (col,))
        cur.execute("""INSERT INTO data_dictionary (table_name, column_name, full_name, section_name,
                       unit, data_type, valid_categories, description)
                       VALUES ('synthesis_experiments', %s, %s, 'THERMAL RAMP', %s, %s, %s, %s)""",
                    (col, full, unit, dtype, cats, desc))
    cur.execute("""UPDATE data_dictionary SET description = %s
                    WHERE table_name='synthesis_experiments' AND column_name='heating_rate_c_min'""",
                ('Heating ramp slope in °C per minute. NULL when the heating time was not written '
                 '(never imputed in the database).',))
    cur.execute("""UPDATE data_dictionary SET description = %s
                    WHERE table_name='synthesis_experiments' AND column_name='cooling_rate_c_min'""",
                ('Cooling ramp slope in °C per minute. NULL when the cooling time was not written; '
                 'see cooling_mode.',))

    for _, f in nuevo.iterrows():
        cur.execute("""UPDATE synthesis_experiments SET
                         temp_initial_c=%s, heating_time_hours=%s, heating_rate_c_min=%s,
                         temp_target_c=%s, time_hours=%s, cooling_time_hours=%s,
                         cooling_rate_c_min=%s, temp_final_c=%s,
                         cooling_mode=%s, ramp_profile_known=%s,
                         updated_at=CURRENT_TIMESTAMP
                       WHERE sample_code=%s""",
                    [_num(f[c]) for c in NUM] + [f.cooling_mode, bool(f.ramp_profile_known), f.sample_code])

    cur.execute("""INSERT INTO audit_log (agent, action, recipients, verdict, cause, result)
                   VALUES ('fix_thermal_ramps_2026_10', 'REPARSE_THERMAL_RAMPS', %s, 'ALLOW', %s, %s)""",
                (len(nuevo),
                 'A1/A2: ramp text re-parsed from Excel col 30 with src/thermal_ramp_parser.py; '
                 'rates NULL when time unwritten, cooling_mode + ramp_profile_known added; '
                 '%d rows changed numerically' % cambia.sum(),
                 'EXECUTED' if aplicar else 'DRY_RUN'))

    cur.execute("""SELECT count(*) FROM synthesis_experiments
                    WHERE (heating_time_hours IS NULL AND heating_rate_c_min IS NOT NULL)
                       OR (cooling_time_hours IS NULL AND cooling_rate_c_min IS NOT NULL)""")
    print('\nfilas con velocidad pero sin tiempo tras el cambio: %d' % cur.fetchone()[0])

    if aplicar:
        conn.commit()
        print('\nAPLICADO.')
    else:
        conn.rollback()
        print('\nENSAYO: todo deshecho. Usa --apply para confirmar.')
    os.makedirs(r'C:\Users\rubbe\Documents\ALCheMy\_lab\scratch\review', exist_ok=True)
    comp[cambia].to_csv(r'C:\Users\rubbe\Documents\ALCheMy\_lab\scratch\review\rampas_cambios.csv',
                        index=False, encoding='utf-8-sig')
    conn.close()


if __name__ == '__main__':
    main()
