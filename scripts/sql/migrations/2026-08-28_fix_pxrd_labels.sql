-- =============================================================================
-- ALCheMy - correccion de etiquetas revisadas a mano (2026-08-28)
-- =============================================================================
--
-- Ruben, revisando el etiquetado, encontro cuatro patrones marcados AMORFO que en
-- realidad estan a medio cristalizar:
--
--   SMP-0001, SMP-0002, SMP-0003  ->  INCIPIENTE / PICOS_ANCHOS
--   SMP-0004                   ->  INCIPIENTE / HALO_DOMINANTE
--
-- Los descriptores respaldan la correccion. Mediana de la clase AMORFO:
-- amorphous_fraction_blank 0,882 con 0 picos. Estas cuatro:
--
--   muestra   picos   frac. amorfa   fwhm
--   SMP-0001      10        0,044      0,415   <- por debajo incluso de CRISTALINO
--   SMP-0002      16        0,430      0,203
--   SMP-0003      18        0,262      0,160
--   SMP-0004        4        0,786      0,287   <- la mas difusa: halo dominante
--
-- Ninguna se parece a un patron amorfo. SMP-0001 tiene ademas la FWHM mas ancha de
-- las cuatro, que es literalmente lo que dice su subtipo.
--
-- POR QUE ESTE FICHERO NO ESCRIBE NINGUN IDENTIFICADOR A MANO
-- -----------------------------------------------------------
-- La clave primaria de pxrd_labels es (file_hash, label_type). Teclear un hash MD5
-- copiado de una consulta es la clase de error que no da fallo: insertaria una fila
-- huerfana con un hash que no corresponde a ningun fichero, y nadie se enteraria.
-- Asi que las filas de subtipo se derivan con INSERT ... SELECT de la fila de
-- crystallinity_class que ya existe para esa muestra, y el hash, el measurement_id
-- y el nombre de fichero salen de la base, no de este texto.
--
-- Idempotente: el UPDATE deja el mismo valor si se repite, y el INSERT lleva
-- ON CONFLICT DO UPDATE.
--
-- SEGURIDAD
-- ---------
-- Toca 4 filas existentes y crea 4 nuevas, todas en pxrd_labels. `labeled_at` se
-- conserva (cuando se juzgo por primera vez) y `updated_at` avanza, para que la
-- revision quede visible sin perder el original. Backup posterior obligatorio.
-- =============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. La clase: AMORFO -> INCIPIENTE
-- --------------------------------------------------------------------------
UPDATE pxrd_labels
   SET label_value = 'INCIPIENTE',
       notes = COALESCE(NULLIF(notes, '') || ' | ', '')
               || 'Corregida 2026-08-28 en revision: estaba AMORFO.',
       updated_at = now()
 WHERE label_type = 'crystallinity_class'
   AND sample_code IN ('SMP-0001', 'SMP-0002', 'SMP-0003', 'SMP-0004')
   AND label_value = 'AMORFO';

-- --------------------------------------------------------------------------
-- 2. El subtipo, derivado de la fila de clase para no teclear ningun hash
-- --------------------------------------------------------------------------
INSERT INTO pxrd_labels (file_hash, label_type, sample_code, file_name,
                         measurement_id, label_value, confidence, notes,
                         labeled_by, labeled_at, updated_at)
SELECT c.file_hash,
       'incipient_subtype',
       c.sample_code,
       c.file_name,
       c.measurement_id,
       s.subtype,
       'alta',
       'Asignado 2026-08-28 al corregir la clase.',
       c.labeled_by,
       now(),
       now()
  FROM pxrd_labels c
  JOIN (VALUES ('SMP-0001', 'PICOS_ANCHOS'),
               ('SMP-0002', 'PICOS_ANCHOS'),
               ('SMP-0003', 'PICOS_ANCHOS'),
               ('SMP-0004',  'HALO_DOMINANTE')) AS s(code, subtype)
    ON s.code = c.sample_code
 WHERE c.label_type = 'crystallinity_class'
ON CONFLICT (file_hash, label_type) DO UPDATE SET
       label_value = EXCLUDED.label_value,
       notes       = EXCLUDED.notes,
       updated_at  = now();

COMMIT;
