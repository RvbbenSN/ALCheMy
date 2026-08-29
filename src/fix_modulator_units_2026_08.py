# -*- coding: utf-8 -*-
"""Corrige en la base el error de unidades x1000 de los moduladores liquidos puros.

Los siete modulares de "Tipo B" del cuaderno 01 se calcularon con un factor 1000
de mas y quedaron en umol etiquetados como mmol. Los de "Tipo A" (hcl/hf/koh
_active_mmol) se calculan desde disoluciones molares y SI son correctos: no se tocan.

Idempotencia: el cuaderno 01 ya esta corregido, asi que una re-ingesta futura
escribira los valores correctos y este UPDATE no debe repetirse. Se protege con
una comprobacion de magnitud (aborta si los valores ya parecen corregidos).
"""
import os, sys, psycopg2, pandas as pd
from dotenv import load_dotenv
load_dotenv(r'C:\Users\rubbe\Documents\ALCheMy\.env')

COLS = ['formic_acid_mmol', 'acetic_acid_mmol', 'propionic_acid_mmol',
        'tfa_mmol', 'cf3so3h_mmol', 'triethylamine_mmol', 'meo3s_mmol']

conn = psycopg2.connect(host='localhost', port=5432, dbname='alchemy_db',
                        user=os.getenv('POSTGRES_USER'), password=os.getenv('POSTGRES_PASSWORD'))
conn.autocommit = False
cur = conn.cursor()

def stats(tag):
    print('\n--- %s ---' % tag)
    rows = []
    for c in COLS:
        cur.execute('SELECT count(*), min(%s), max(%s), '
                    'percentile_cont(0.5) WITHIN GROUP (ORDER BY %s) '
                    'FROM synthesis_experiments WHERE %s > 0' % (c, c, c, c))
        n, mn, mx, med = cur.fetchone()
        rows.append({'columna': c, 'n>0': n, 'min': float(mn) if mn else None,
                     'mediana': float(med) if med else None, 'max': float(mx) if mx else None})
    df = pd.DataFrame(rows)
    print(df.to_string(index=False))
    return df

antes = stats('ANTES')

# Guardia de idempotencia: si el formico ya esta por debajo de 100 mmol de mediana,
# la correccion ya se aplico y repetirla estropearia los datos.
cur.execute("SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY formic_acid_mmol) "
            "FROM synthesis_experiments WHERE formic_acid_mmol > 0")
med_formico = float(cur.fetchone()[0])
if med_formico < 100:
    print('\n[ABORTA] La mediana de formico ya es %.3f mmol: la correccion ya estaba '
          'aplicada. No se toca nada.' % med_formico)
    conn.rollback(); sys.exit(0)

cur.execute('SELECT count(*) FROM synthesis_experiments WHERE ' +
            ' OR '.join('%s > 0' % c for c in COLS))
n_afectadas = cur.fetchone()[0]

sets = ', '.join('%s = %s / 1000.0' % (c, c) for c in COLS)
cur.execute('UPDATE synthesis_experiments SET %s WHERE %s' %
            (sets, ' OR '.join('%s > 0' % c for c in COLS)))
print('\nfilas actualizadas: %d (esperadas %d)' % (cur.rowcount, n_afectadas))

despues = stats('DESPUES')

# Comprobacion de cordura quimica: nadie mete >100 mmol de modulador en <=30 mL
cur.execute('SELECT max(GREATEST(%s)) FROM synthesis_experiments' %
            ', '.join('COALESCE(%s,0)' % c for c in COLS))
mx = float(cur.fetchone()[0])
assert mx < 100, 'El maximo tras corregir sigue siendo %.1f mmol: revisar antes de confirmar' % mx
print('\n[OK] maximo global tras corregir: %.3f mmol (quimicamente plausible)' % mx)

cur.execute("""INSERT INTO audit_log (agent, action, verdict, cause, result)
               VALUES (%s, %s, %s, %s, %s)""",
            ('claude_code/revision_06',
             'UPDATE synthesis_experiments: moduladores Tipo B / 1000',
             'CORRECTED',
             'calc_pure_modulator_mmol usaba 10/MW en vez de 1/(100*MW): valores en umol '
             'etiquetados como mmol, lo que borraba el efecto del HCl al sumarlos en '
             'v_ml_features.mod_strong_acid_mmol',
             '%d filas corregidas en 7 columnas' % n_afectadas))

conn.commit()
print('\n[COMMIT] correccion aplicada y registrada en audit_log')
