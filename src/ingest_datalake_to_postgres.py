"""
ALCheMy Master Data Lake Ingestion Script
Iterates through data/raw_datalake/ across all techniques,
parses files using src/characterization_parser.py, and upserts
records directly into PostgreSQL alchemy_db.
"""

import os
import sys
import json
import psycopg2
from psycopg2.extras import Json

# Ensure workspace root in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.characterization_parser import (
    parse_pxrd_xrdml,
    parse_bruker_brml,
    parse_tga_txt,
    parse_ftir_csv,
    parse_bet_xls,
    parse_uvvis_asc,
    parse_hitachi_sem
)

# Database Connection Parameters (Docker / Host fallback)
DB_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
DB_PORT = int(os.environ.get('POSTGRES_PORT', 5432))
DB_NAME = os.environ.get('POSTGRES_DB', 'alchemy_db')
DB_USER = os.environ.get('POSTGRES_USER', 'alchemy_user')
DB_PASS = os.environ.get('POSTGRES_PASSWORD', 'alchemy_pass_2026')

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

def run_mass_ingestion(datalake_dir='data/raw_datalake', limit_per_tech=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Ensure UNKNOWN sample code exists in synthesis_experiments
    cursor.execute("""
        INSERT INTO synthesis_experiments (sample_code, synthesis_date, synthesis_type, researcher_name, metal_center, metal_source, linker, total_volume_ml, temp_target_c, time_hours)
        VALUES ('UNKNOWN', CURRENT_DATE, 'HTS', 'Rubén S.N.', 'Ni', 'Ni(NO3)2·6H2O', 'Pyrene', 2.5, 120.0, 24.0)
        ON CONFLICT (sample_code) DO NOTHING;
    """)
    conn.commit()
    
    # Fetch valid sample codes from synthesis_experiments
    cursor.execute("SELECT sample_code FROM synthesis_experiments;")
    db_samples = set(row[0].upper() for row in cursor.fetchall())
    db_samples.add('UNKNOWN')
    print(f"Loaded {len(db_samples)} valid sample codes from PostgreSQL synthesis_experiments.")
        
    inserted_count = 0
    skipped_count = 0
    error_count = 0
    
    upsert_query = """
        INSERT INTO characterization_measurements (
            sample_code, technique, measurement_tag, operator_name, instrument_name, file_name, raw_file_path, file_hash, data_json
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s
        ) ON CONFLICT DO NOTHING;
    """
    
    import hashlib
    
    for root, dirs, files in os.walk(datalake_dir):
        tech_files = [f for f in files if f != '.gitkeep']
        if limit_per_tech:
            tech_files = tech_files[:limit_per_tech]
            
        for f in tech_files:
            fpath = os.path.join(root, f)
            ext = os.path.splitext(f)[1].lower()
            
            # Compute MD5 checksum for binary anti-duplication
            try:
                with open(fpath, 'rb') as fp:
                    file_hash = hashlib.md5(fp.read()).hexdigest()
            except Exception:
                file_hash = None
            
            parsed_data = None
            try:
                if ext == '.xrdml':
                    parsed_data = parse_pxrd_xrdml(fpath)
                elif ext == '.brml':
                    parsed_data = parse_bruker_brml(fpath)
                elif ext == '.txt' and 'TGA' in fpath:
                    parsed_data = parse_tga_txt(fpath)
                elif ext == '.csv' and 'FTIR' in fpath:
                    parsed_data = parse_ftir_csv(fpath)
                elif ext == '.xls' and 'ADSORPTION' in fpath:
                    parsed_data = parse_bet_xls(fpath)
                elif ext in ['.asc', '.csv'] and 'UV_Vis' in fpath:
                    parsed_data = parse_uvvis_asc(fpath)
                elif ext in ['.jpg', '.jpeg'] and 'SEM' in fpath:
                    parsed_data = parse_hitachi_sem(fpath)
            except Exception as e:
                error_count += 1
                print(f"Error parsing {fpath}: {e}")
                continue
                
            if parsed_data:
                sample_code = parsed_data['sample_code']
                # Ensure sample code exists in synthesis_experiments
                if sample_code not in db_samples:
                    try:
                        cursor.execute("""
                            INSERT INTO synthesis_experiments (sample_code, synthesis_date, synthesis_type, researcher_name, metal_center, metal_source, linker, total_volume_ml, temp_target_c, time_hours)
                            VALUES (%s, CURRENT_DATE, 'HTS', 'Rubén S.N.', 'Ni', 'Ni(NO3)2·6H2O', 'Pyrene', 2.5, 120.0, 24.0)
                            ON CONFLICT (sample_code) DO NOTHING;
                        """, (sample_code,))
                        conn.commit()
                        db_samples.add(sample_code)
                    except Exception as e:
                        conn.rollback()
                        sample_code = 'UNKNOWN'
                            
                try:
                    cursor.execute(upsert_query, (
                        sample_code,
                        parsed_data['technique'],
                        parsed_data['measurement_tag'],
                        parsed_data['operator_name'],
                        parsed_data['instrument_name'],
                        parsed_data['file_name'],
                        parsed_data['raw_file_path'],
                        file_hash,
                        Json(parsed_data['data_json'])
                    ))
                    inserted_count += 1
                except Exception as e:
                    error_count += 1
                    print(f"Database insertion error for {fpath}: {e}")
                    conn.rollback()
                    continue
                    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("\n=== MASS DATA LAKE INGESTION SUMMARY ===")
    print(f"Total Characterization Records Processed: {inserted_count}")
    print(f"Total Errors / Failures: {error_count}")
    return inserted_count

if __name__ == '__main__':
    run_mass_ingestion()
