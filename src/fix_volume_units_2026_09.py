# -*- coding: utf-8 -*-
"""
fix_volume_units_2026_09.py -- corrige las unidades de volumen de la ingesta.

EL PROBLEMA
-----------
El Excel maestro dosifica los aditivos en DOS unidades distintas, y la formula
de su propia columna "V total" lo dice sin ambiguedad:

    V total = SUM(Q:AB) + SUM(AE:AU)/1000

Ese "/1000" aplicado solo al segundo bloque es la prueba: el primero esta en mL
y el segundo en uL. Verificado reproduciendo V total en 2.162 de 2.172 filas
(99,54 %); las 10 restantes usan una variante de la formula que arranca en R.

    BLOQUE mL  (col 17-28): HCl (0,6M), H2O, MeOH, EtOH, 1-PrOH, DMF, DEF,
                            HCl (3M), HF (3M), AcOH gl, H2PO4, NH4OH
    BLOQUE uL  (col 31-47): Formic, Acetic, Propionic, (C2H5)3N, CF3SO3H, TFA,
                            HCl (1M), HCl (5M), HCl (12M), KOH (10M),
                            HF (3M) [2a columna], DAM, NaOH, Ac. PhP,
                            TFA [2a columna], MeO3S, PhCOOH

Tiene sentido de laboratorio: las disoluciones DILUIDAS (HCl 0,6M, HCl 3M,
HF 3M) se dosifican en mililitros y hacen de disolvente; las concentradas y los
liquidos puros van en microlitros.

El cuaderno 01 trataba TODA columna de aditivo como uL. Consecuencias:

  1. El agua que aportan las disoluciones diluidas se dividia entre 1000 y
     desaparecia. RS1633: 10 mL de HCl 0,6M quedaron en 0,010 mL, y por eso el
     volumen de esa sintesis "no cuadraba". No faltaba un disolvente: se habia
     evaporado el agua de la dilucion.
  2. hcl_active_mmol y hf_active_mmol quedaban 1000 veces por debajo en las
     filas que usan esas tres columnas.
  3. Tres columnas del bloque mL (AcOH gl, H2PO4, NH4OH) se mapeaban en el
     cuaderno 01 pero nunca se crearon en la tabla: ese volumen se perdia.
  4. La segunda columna "HF (3M)" (uL, 70 filas) y la segunda "TFA" (uL, 6) no
     se mapeaban en absoluto, porque pandas las renombra a ".1" al haber nombre
     repetido.

Lo que NO estaba mal: los moduladores organicos puros (formico, acetico,
propionico, TFA, triflico, trietilamina, metanosulfonico) SI estan en uL, asi
que la correccion de src/fix_modulator_units_2026_08.py sigue siendo valida.

QUE HACE ESTE SCRIPT
--------------------
Recalcula desde el Excel, POR INDICE DE COLUMNA (para no confundir las columnas
de nombre repetido), y actualiza en synthesis_experiments unicamente:

    h2o_total_ml, acoh_gl_ml, h2po4_ml, nh4oh_ml,
    hcl_active_mmol, hf_active_mmol, koh_active_mmol, tfa_mmol

Deliberadamente NO se re-ejecuta la ingesta completa del cuaderno 01: eso
sobrescribiria las correcciones quimicas hechas a mano (metal_source de RS253,
las 6 discrepancias metal/precursor), que no estan en el Excel.

    python src/fix_volume_units_2026_09.py --dry-run    (por defecto)
    python src/fix_volume_units_2026_09.py --apply
"""
import os
import sys

import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv

EXCEL = r'C:\Users\rubbe\Documents\ALCheMy\data\raw\RSN - Recopilación todas las síntesis_v3.xlsx'
HOJA = 'ALL SYNTHESIS'
FILA_CABECERA = 3          # 1-indexada, como la ve openpyxl

# Indices de columna en el Excel (1-indexados). Se usan indices y no nombres
# porque hay nombres repetidos: "HF (3M)" y "TFA" aparecen dos veces, en
# bloques de unidades distintas.
COL = {
    'sample': 7, 'type': 3,
    'hcl_06m_mL': 17, 'h2o_mL': 18, 'meoh': 19, 'etoh': 20, 'proh': 21,
    'dmf': 22, 'def': 23, 'hcl_3m_mL': 24, 'hf_3m_mL': 25,
    'acoh_gl': 26, 'h2po4': 27, 'nh4oh': 28, 'v_total': 29,
    'tfa_uL': 36, 'hcl_1m_uL': 37, 'hcl_5m_uL': 38, 'hcl_12m_uL': 39,
    'koh_10m_uL': 40, 'hf_3m_uL': 41, 'naoh_uL': 43, 'tfa2_uL': 45,
    'linker': 10,
}
# Densidad, pureza y peso molecular del TFA, iguales que en el cuaderno 01.
TFA_RHO, TFA_PUR, TFA_MW = 1.49, 99.0, 114.02


def leer_excel():
    import openpyxl
    wb = openpyxl.load_workbook(EXCEL, data_only=True)
    ws = wb[HOJA]

    def v(r, c):
        x = ws.cell(row=r, column=c).value
        return float(x) if isinstance(x, (int, float)) else 0.0

    filas = []
    for r in range(FILA_CABECERA + 1, ws.max_row + 1):
        s = ws.cell(row=r, column=COL['sample']).value
        if s is None or not str(s).strip():
            continue
        d = {k: v(r, c) for k, c in COL.items() if k not in ('sample', 'type', 'linker')}
        d['sample'] = str(s).strip()
        t = ws.cell(row=r, column=COL['type']).value
        d['type'] = str(t).strip() if t is not None else 'ST'
        lk = ws.cell(row=r, column=COL['linker']).value
        d['linker'] = str(lk).strip() if lk is not None else ''
        filas.append(d)
    return pd.DataFrame(filas)


def desambiguar(df):
    """Reproduce exactamente la logica del cuaderno 01, para que los codigos
    coincidan con los que hay en la base."""
    df = df.copy()
    df['type'] = df['type'].replace({'': 'ST', 'nan': 'ST', 'None': 'ST'}).fillna('ST')
    # el cuaderno 01 descarta PPV y BTBSH3 antes de desambiguar
    df = df[~df['linker'].str.upper().isin(['PPV', 'BTBSH3', 'PPV?', 'PPV ?'])].copy()
    dup = df.duplicated(subset=['sample'], keep=False)
    cuenta, nuevos = {}, []
    for idx, fila in df.iterrows():
        code = fila['sample']
        if dup.loc[idx]:
            cuenta[code] = cuenta.get(code, 0) + 1
            if cuenta[code] == 1:
                nuevos.append(code)
            else:
                t = fila['type']
                nuevos.append('%s_%s' % (code, t) if t and t not in ('nan', 'None', 'ST')
                              else '%s_v%d' % (code, cuenta[code]))
        else:
            nuevos.append(code)
    df['sample_code'] = nuevos
    return df


def calcular(df):
    """Las columnas corregidas, con la unidad correcta de cada bloque."""
    out = pd.DataFrame({'sample_code': df['sample_code']})

    # --- agua total: agua pura + el agua que aportan las disoluciones acuosas ---
    # Diluidas, ya en mL. Son las que el cuaderno 01 dividia entre 1000.
    acuosas_mL = df['hcl_06m_mL'] + df['hcl_3m_mL'] + df['hf_3m_mL']
    # Concentradas y la segunda columna de HF, en uL.
    acuosas_uL = (df['hcl_1m_uL'] + df['hcl_5m_uL'] + df['hcl_12m_uL']
                  + df['koh_10m_uL'] + df['hf_3m_uL'] + df['naoh_uL'])
    out['h2o_total_ml'] = df['h2o_mL'] + acuosas_mL + acuosas_uL / 1000.0

    # --- columnas del bloque mL que nunca llegaron a la tabla ---
    out['acoh_gl_ml'] = df['acoh_gl']
    out['h2po4_ml'] = df['h2po4']
    out['nh4oh_ml'] = df['nh4oh']

    # --- moduladores acuosos: mmol = V(mL) * molaridad ---
    out['hcl_active_mmol'] = (df['hcl_06m_mL'] * 0.6 + df['hcl_3m_mL'] * 3.0
                              + df['hcl_1m_uL'] / 1000.0 * 1.0
                              + df['hcl_5m_uL'] / 1000.0 * 5.0
                              + df['hcl_12m_uL'] / 1000.0 * 12.0)
    out['hf_active_mmol'] = (df['hf_3m_mL'] + df['hf_3m_uL'] / 1000.0) * 3.0
    out['koh_active_mmol'] = df['koh_10m_uL'] / 1000.0 * 10.0

    # --- TFA: hay dos columnas, ambas en uL; se suman ---
    tfa_uL = df['tfa_uL'] + df['tfa2_uL']
    out['tfa_mmol'] = tfa_uL * TFA_RHO * TFA_PUR / (100.0 * TFA_MW)

    out['v_total_excel'] = df['v_total']
    return out


def main():
    aplicar = '--apply' in sys.argv
    load_dotenv(r'C:\Users\rubbe\Documents\ALCheMy\.env')
    conn = psycopg2.connect(host='localhost', port=5432, dbname='alchemy_db',
                            user=os.getenv('POSTGRES_USER'),
                            password=os.getenv('POSTGRES_PASSWORD'))
    conn.autocommit = False
    cur = conn.cursor()

    print('leyendo el Excel...')
    df = desambiguar(leer_excel())
    nuevo = calcular(df)
    print('filas del Excel tras desambiguar: %d' % len(nuevo))

    en_bd = pd.read_sql('SELECT sample_code FROM synthesis_experiments', conn)
    cruza = nuevo[nuevo.sample_code.isin(en_bd.sample_code)]
    print('cruzan con synthesis_experiments : %d' % len(cruza))
    huerfanas = set(nuevo.sample_code) - set(en_bd.sample_code)
    if huerfanas:
        print('en el Excel pero no en la base   : %d  (ejemplos: %s)'
              % (len(huerfanas), sorted(huerfanas)[:5]))

    antes = pd.read_sql("""
        SELECT sample_code, h2o_total_ml, hcl_active_mmol, hf_active_mmol,
               koh_active_mmol, tfa_mmol, total_volume_ml
          FROM synthesis_experiments""", conn)
    comp = antes.merge(cruza, on='sample_code', suffixes=('_antes', '_nuevo'))
    for c in ['h2o_total_ml', 'hcl_active_mmol', 'hf_active_mmol', 'koh_active_mmol', 'tfa_mmol']:
        a = pd.to_numeric(comp[c + '_antes'], errors='coerce').fillna(0)
        b = pd.to_numeric(comp[c + '_nuevo'], errors='coerce').fillna(0)
        cambian = (a - b).abs() > 1e-9
        print('   %-18s cambian %4d filas  |  mediana antes %.5f -> despues %.5f'
              % (c, cambian.sum(),
                 a[cambian].median() if cambian.any() else 0,
                 b[cambian].median() if cambian.any() else 0))

    if not aplicar:
        print('\n[DRY-RUN] no se ha escrito nada. Relanza con --apply para aplicar.')
        return

    cur.execute("""ALTER TABLE synthesis_experiments
                     ADD COLUMN IF NOT EXISTS acoh_gl_ml NUMERIC(12,4),
                     ADD COLUMN IF NOT EXISTS h2po4_ml   NUMERIC(12,4),
                     ADD COLUMN IF NOT EXISTS nh4oh_ml   NUMERIC(12,4)""")

    datos = [(float(r.h2o_total_ml), float(r.acoh_gl_ml), float(r.h2po4_ml),
              float(r.nh4oh_ml), float(r.hcl_active_mmol), float(r.hf_active_mmol),
              float(r.koh_active_mmol), float(r.tfa_mmol), r.sample_code)
             for r in cruza.itertuples()]
    cur.executemany("""
        UPDATE synthesis_experiments SET
            h2o_total_ml = %s, acoh_gl_ml = %s, h2po4_ml = %s, nh4oh_ml = %s,
            hcl_active_mmol = %s, hf_active_mmol = %s, koh_active_mmol = %s,
            tfa_mmol = %s
        WHERE sample_code = %s""", datos)
    print('\nfilas actualizadas: %d' % cur.rowcount if cur.rowcount >= 0 else len(datos))

    cur.execute("""INSERT INTO audit_log (agent, action, verdict, cause, result)
                   VALUES (%s,%s,%s,%s,%s)""",
                ('claude_code/fix_volume_units',
                 'UPDATE synthesis_experiments: unidades de volumen mL/uL',
                 'CORRECTED',
                 'El cuaderno 01 dividia entre 1000 las tres disoluciones diluidas del '
                 'bloque en mL del Excel (HCl 0,6M, HCl 3M, HF 3M). El agua de la dilucion '
                 'desaparecia y hcl/hf_active_mmol quedaban 1000 veces por debajo. '
                 'La formula de V total del propio Excel fija las unidades: '
                 'SUM(Q:AB) + SUM(AE:AU)/1000.',
                 '%d filas; se anaden acoh_gl_ml, h2po4_ml, nh4oh_ml' % len(datos)))
    conn.commit()
    print('[COMMIT] correccion aplicada y registrada en audit_log')


if __name__ == '__main__':
    main()
