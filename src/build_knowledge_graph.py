"""
ALCheMy - Construye la Fase 1 del grafo de conocimiento (kg_nodes/kg_edges).

100% determinista, sin ningun LLM de por medio: lee synthesis_experiments y
characterization_measurements tal como existen hoy y escribe (UPSERT, nunca
DELETE) las relaciones que ya estan en esas columnas pero que hoy solo se
pueden consultar con un JOIN especifico para cada pregunta. Ver
scripts/sql/init_db.sql, Section 22, y methodology/ROADMAP_RAG_Y_GRAFO_v2.md
seccion 5 para el diseno completo.

Nodos que crea:
    SAMPLE:<sample_code>            una fila por sintesis
    METAL:<metal_center>            un nodo por metal distinto que aparece
    LIGAND:<linker>                 un nodo por ligando distinto que aparece
    MODULATOR:<nombre>              un nodo por cada uno de los 10 moduladores
                                     del esquema, solo si alguna muestra lo usa
    MEASUREMENT:<sample_code>:<tecnica>   una por (muestra, tecnica), agregando
                                     todos los ficheros de esa tecnica para esa
                                     muestra (no un nodo por fichero: con miles
                                     de ficheros el grafo dejaria de ser legible)

Aristas que crea (todas confidence=1.0, source=DETERMINISTIC):
    SAMPLE --USES_METAL-->      METAL
    SAMPLE --USES_LIGAND-->     LIGAND
    SAMPLE --USES_MODULATOR-->  MODULATOR   (solo si la cantidad en mmol > 0)
    SAMPLE --HAS_MEASUREMENT--> MEASUREMENT

Reproducible: se puede relanzar cuantas veces se quiera (ON CONFLICT DO
NOTHING/UPDATE), siempre converge al mismo resultado. No hace DELETE de nada:
si una muestra cambia de metal en synthesis_experiments, la arista vieja queda
huerfana pero no se borra sola (limpieza manual deliberada, ver --help).

    python src/build_knowledge_graph.py              # dry run: solo cuenta
    python src/build_knowledge_graph.py --apply       # escribe de verdad
"""

import argparse
import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parent.parent

# columna en synthesis_experiments -> etiqueta legible del nodo MODULATOR
MODULATOR_COLUMNS = {
    "hcl_active_mmol": "HCl",
    "hf_active_mmol": "HF",
    "koh_active_mmol": "KOH",
    "formic_acid_mmol": "Acido formico",
    "acetic_acid_mmol": "Acido acetico",
    "propionic_acid_mmol": "Acido propionico",
    "tfa_mmol": "Acido trifluoroacetico",
    "cf3so3h_mmol": "Acido triflico",
    "triethylamine_mmol": "Trietilamina",
    "meo3s_mmol": "Acido metanosulfonico",
}


def load_env():
    path = REPO_ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def connect():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"])


class Counter:
    """Cuenta upserts intentados; no es el numero final de filas distintas
    (varias muestras comparten el mismo METAL/LIGAND/MODULATOR), asi que se
    imprime como aproximado."""
    def __init__(self):
        self.nodes = 0
        self.edges = 0


def upsert_node(cur, counter, node_id, node_type, label, source_table=None,
                 source_id=None, properties=None):
    cur.execute("""
        INSERT INTO kg_nodes (node_id, node_type, label, source_table, source_id, properties)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (node_id) DO UPDATE SET label = EXCLUDED.label, properties = EXCLUDED.properties
    """, (node_id, node_type, label, source_table, source_id,
          psycopg2.extras.Json(properties or {})))
    counter.nodes += 1


def upsert_edge(cur, counter, from_node, to_node, edge_type):
    cur.execute("""
        INSERT INTO kg_edges (from_node, to_node, edge_type, confidence, source, review_status)
        VALUES (%s, %s, %s, 1.0, 'DETERMINISTIC', 'CONFIRMED')
        ON CONFLICT (from_node, to_node, edge_type) DO NOTHING
    """, (from_node, to_node, edge_type))
    counter.edges += 1


def build_chemistry(cur, counter):
    """SAMPLE <-> METAL / LIGAND / MODULATOR, desde synthesis_experiments."""
    mod_cols = list(MODULATOR_COLUMNS.keys())
    cur.execute(
        "SELECT sample_code, metal_center, linker, {} FROM synthesis_experiments"
        .format(", ".join(mod_cols)))
    rows = cur.fetchall()

    for row in rows:
        sample_code, metal, linker = row[0], row[1], row[2]
        mod_values = row[3:]
        sample_id = "SAMPLE:{}".format(sample_code)
        upsert_node(cur, counter, sample_id, "SAMPLE", sample_code,
                    "synthesis_experiments", sample_code)

        if metal and str(metal).strip():
            metal_id = "METAL:{}".format(metal)
            upsert_node(cur, counter, metal_id, "METAL", metal)
            upsert_edge(cur, counter, sample_id, metal_id, "USES_METAL")

        if linker and str(linker).strip():
            ligand_id = "LIGAND:{}".format(linker)
            upsert_node(cur, counter, ligand_id, "LIGAND", linker)
            upsert_edge(cur, counter, sample_id, ligand_id, "USES_LIGAND")

        for col, value in zip(mod_cols, mod_values):
            if value and float(value) > 0:
                label = MODULATOR_COLUMNS[col]
                mod_id = "MODULATOR:{}".format(label)
                upsert_node(cur, counter, mod_id, "MODULATOR", label)
                upsert_edge(cur, counter, sample_id, mod_id, "USES_MODULATOR")

    return len(rows)


def build_measurements(cur, counter):
    """SAMPLE <-> MEASUREMENT, una por (muestra, tecnica), desde
    characterization_measurements. Agregada a proposito: miles de ficheros
    individuales convertirian el grafo en ilegible sin aportar nada que la
    herramienta get_characterisation ya no de mejor."""
    cur.execute("""
        SELECT sample_code, technique, count(*) AS n_files, max(created_at) AS last_measured
        FROM characterization_measurements
        GROUP BY sample_code, technique
    """)
    rows = cur.fetchall()

    for sample_code, technique, n_files, last_measured in rows:
        sample_id = "SAMPLE:{}".format(sample_code)
        meas_id = "MEASUREMENT:{}:{}".format(sample_code, technique)
        label = "{} de {}".format(technique, sample_code)
        upsert_node(cur, counter, meas_id, "MEASUREMENT", label,
                    "characterization_measurements", sample_code,
                    properties={"technique": technique, "n_files": n_files,
                                "last_measured": str(last_measured) if last_measured else None})
        upsert_edge(cur, counter, sample_id, meas_id, "HAS_MEASUREMENT")

    return len(rows)


def main():
    parser = argparse.ArgumentParser(
        description="Construye/actualiza la Fase 1 (determinista) del grafo de conocimiento")
    parser.add_argument("--apply", action="store_true",
                         help="escribe de verdad (por defecto es dry-run: cuenta y hace rollback)")
    args = parser.parse_args()

    load_env()
    conn = connect()
    cur = conn.cursor()
    counter = Counter()

    n_samples = build_chemistry(cur, counter)
    n_measurement_groups = build_measurements(cur, counter)

    if args.apply:
        conn.commit()
        modo = "APLICADO"
    else:
        conn.rollback()
        modo = "DRY RUN (nada escrito, repite con --apply)"

    print("{}".format(modo))
    print("  Muestras procesadas (synthesis_experiments): {}".format(n_samples))
    print("  Grupos muestra+tecnica procesados (characterization_measurements): {}".format(n_measurement_groups))
    print("  Upserts de nodos intentados: {} (numero de filas distintas sera menor: METAL/LIGAND/MODULATOR se comparten entre muestras)".format(counter.nodes))
    print("  Upserts de aristas intentados: {}".format(counter.edges))

    if args.apply:
        cur.execute("SELECT node_type, count(*) FROM kg_nodes GROUP BY node_type ORDER BY node_type")
        print("\nkg_nodes por tipo:")
        for node_type, n in cur.fetchall():
            print("  {:<12} {}".format(node_type, n))
        cur.execute("SELECT edge_type, count(*) FROM kg_edges GROUP BY edge_type ORDER BY edge_type")
        print("\nkg_edges por tipo:")
        for edge_type, n in cur.fetchall():
            print("  {:<18} {}".format(edge_type, n))

    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
