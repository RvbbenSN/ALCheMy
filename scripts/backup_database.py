"""
ALCheMy PostgreSQL Backup CLI Script

The whole database lives inside a single Docker named volume (`postgres_data`).
That volume is the ONLY copy: `docker compose down -v`, a Docker reinstall or a
corrupted volume takes every row with it. Most of the content is reproducible by
re-running the ingestion scripts over `data/raw_datalake/`, but two things are not:
the human labels in `pxrd_labels` (hours of expert judgement, not derivable from
any file) and any manual reconciliation done directly in pgAdmin. This script
exists so those are never one command away from being lost.

`pg_dump` does not copy files off the disk - it regenerates the SQL statements
needed to rebuild the database from nothing, taken against a single consistent
snapshot while the database keeps serving other clients. That is why the output is
portable across machines, across PostgreSQL versions, and into a cloud instance.

The dump is written INSIDE the container (that is where `pg_dump` lives - it is not
installed on the Windows host) and then copied out to `backups/`, because a backup
that stays inside the container protects against nothing.

Usage:
    python scripts/backup_database.py                 # create a backup, keep 7 newest
    python scripts/backup_database.py --keep 30       # keep the 30 newest instead
    python scripts/backup_database.py --list          # show existing backups
    python scripts/backup_database.py --restore-help  # print restore instructions

Privacy: the dump contains raw synthesis parameters and ligand names, i.e. the
project's intellectual property. `backups/` is gitignored. Do not move a dump out
of that folder and never upload one to an external service.
"""

import os
import sys
import json
import glob
import argparse
import subprocess
from datetime import datetime

# The container name is fixed in docker-compose.yml. pg_dump runs in here.
CONTAINER_NAME = 'alchemy_postgres'

# Paths are resolved from this file so the script works from the repo root or from
# anywhere else, matching the fallback behaviour the notebooks already use.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
BACKUP_DIR = os.path.join(REPO_ROOT, 'backups')
ENV_PATH = os.path.join(REPO_ROOT, '.env')

# Tables whose row counts are recorded next to every dump. If a restore ever has to
# be trusted, these are the numbers to check it against.
MANIFEST_TABLES = [
    'synthesis_experiments',
    'characterization_measurements',
    'pxrd_descriptors',
    'pxrd_labels',
    'data_dictionary',
    'audit_log',
]

# How many backups to keep by default. Old ones are deleted newest-first beyond this.
DEFAULT_KEEP = 7


def read_env(path=ENV_PATH):
    """Parse the gitignored .env into a plain dict.

    Deliberately hand-rolled instead of using python-dotenv: the project has no
    requirements.txt, so every avoidable dependency is one more thing that can be
    missing on a fresh machine.
    """
    if not os.path.exists(path):
        print(f"[ERROR] .env not found at {path}")
        print("        Credentials come from .env; it is gitignored and must exist locally.")
        return None

    env = {}
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            line = line.strip()
            # Skip blanks and comments; everything else is KEY=VALUE.
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip()
    return env


def container_running(name=CONTAINER_NAME):
    """True if the Postgres container is up. Checked first so the failure message is
    'the database is not running' instead of an opaque docker error."""
    try:
        result = subprocess.run(
            ['docker', 'ps', '--filter', f'name={name}', '--format', '{{.Names}}'],
            capture_output=True, text=True, timeout=30,
        )
    except FileNotFoundError:
        print("[ERROR] `docker` was not found on PATH. Is Docker Desktop installed and running?")
        return False
    except subprocess.TimeoutExpired:
        print("[ERROR] `docker ps` timed out. Docker Desktop may be starting up.")
        return False
    return name in result.stdout.split()


def collect_manifest(env):
    """Row counts for the tables that matter, taken just before the dump.

    This is what turns 'there is a file' into 'the file holds what I think it holds'.
    A count that reads 0 for pxrd_labels is a louder warning than any exit code.
    """
    user = env.get('POSTGRES_USER')
    database = env.get('POSTGRES_DB')
    counts = {}

    for table in MANIFEST_TABLES:
        query = f'SELECT COUNT(*) FROM {table};'
        result = subprocess.run(
            ['docker', 'exec', '-e', f"PGPASSWORD={env.get('POSTGRES_PASSWORD')}",
             CONTAINER_NAME, 'psql', '-U', user, '-d', database, '-t', '-A', '-c', query],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            counts[table] = int(result.stdout.strip() or 0)
        else:
            # A missing table is information, not a crash: schemas drift between machines.
            counts[table] = None
    return counts


def create_backup(env, keep=DEFAULT_KEEP):
    """Dump the database, copy it out of the container, verify it and rotate old files."""
    user = env.get('POSTGRES_USER')
    database = env.get('POSTGRES_DB')
    password = env.get('POSTGRES_PASSWORD')

    if not all([user, database, password]):
        print("[ERROR] POSTGRES_USER, POSTGRES_DB and POSTGRES_PASSWORD must all be set in .env")
        return False

    os.makedirs(BACKUP_DIR, exist_ok=True)

    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'alchemy_{stamp}.dump'
    container_path = f'/tmp/{filename}'
    host_path = os.path.join(BACKUP_DIR, filename)

    print(f"\n[BACKUP] ALCheMy database -> {filename}")
    print(f" |-- container: {CONTAINER_NAME}")
    print(f" |-- database:  {database}")

    # --- 1. Row counts BEFORE the dump, so the manifest describes what went in -------
    manifest = collect_manifest(env)
    print(" |-- contents:")
    for table, count in manifest.items():
        shown = f'{count:,}' if count is not None else 'MISSING'
        print(f" |     {table:<32} {shown:>10}")

    # --- 2. The dump itself -----------------------------------------------------------
    # -F c  = custom format: compressed, and pg_restore can pull single tables out of it.
    # PGPASSWORD is passed as a container env var so it never appears in the process list
    # on the host, and is never printed.
    print(" |-- running pg_dump...")
    dump = subprocess.run(
        ['docker', 'exec', '-e', f'PGPASSWORD={password}', CONTAINER_NAME,
         'pg_dump', '-U', user, '-d', database, '-F', 'c', '-f', container_path],
        capture_output=True, text=True,
    )
    if dump.returncode != 0:
        print(f"[ERROR] pg_dump failed:\n{dump.stderr.strip()}")
        return False

    # --- 3. Copy it out ----------------------------------------------------------------
    # A dump left inside the container dies with the container, which is the exact
    # scenario being defended against.
    copy = subprocess.run(
        ['docker', 'cp', f'{CONTAINER_NAME}:{container_path}', host_path],
        capture_output=True, text=True,
    )
    if copy.returncode != 0:
        print(f"[ERROR] docker cp failed:\n{copy.stderr.strip()}")
        return False

    # Tidy up inside the container so /tmp does not accumulate copies.
    subprocess.run(['docker', 'exec', CONTAINER_NAME, 'rm', '-f', container_path],
                   capture_output=True, text=True)

    size_mb = os.path.getsize(host_path) / (1024 * 1024)
    print(f" |-- written:   {size_mb:,.1f} MB")

    # --- 4. Verify ---------------------------------------------------------------------
    # An unverified backup is a guess. `pg_restore --list` reads the archive's table of
    # contents: if the file is truncated or corrupt it fails here, now, rather than on
    # the day it is actually needed.
    entries = None
    copy_back = subprocess.run(
        ['docker', 'cp', host_path, f'{CONTAINER_NAME}:{container_path}'],
        capture_output=True, text=True,
    )
    if copy_back.returncode == 0:
        listing = subprocess.run(
            ['docker', 'exec', CONTAINER_NAME, 'pg_restore', '--list', container_path],
            capture_output=True, text=True,
        )
        subprocess.run(['docker', 'exec', CONTAINER_NAME, 'rm', '-f', container_path],
                       capture_output=True, text=True)
        if listing.returncode == 0:
            entries = len([ln for ln in listing.stdout.splitlines()
                           if ln.strip() and not ln.startswith(';')])
            print(f" |-- verified:  archive readable, {entries:,} objects")
        else:
            print(f"[ERROR] the dump was written but pg_restore cannot read it:\n{listing.stderr.strip()}")
            return False

    # --- 5. Manifest alongside the dump -------------------------------------------------
    manifest_path = host_path.replace('.dump', '.manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as handle:
        json.dump({
            'created_at': datetime.now().isoformat(timespec='seconds'),
            'database': database,
            'dump_file': filename,
            'size_bytes': os.path.getsize(host_path),
            'archive_objects': entries,
            'row_counts': manifest,
        }, handle, indent=2)

    # --- 6. Rotation ---------------------------------------------------------------------
    removed = rotate(keep)
    print(f" |-- rotation:  keeping {keep} newest" + (f", deleted {removed} old" if removed else ""))

    # Each dump is large (the JSONB curves in characterization_measurements dominate it),
    # so the retention setting has a real cost on disk. Show it rather than let it creep.
    total_gb = sum(os.path.getsize(p) for p in list_backups()) / (1024 ** 3)
    print(f" `-- on disk:   {total_gb:,.1f} GB across {len(list_backups())} backup(s)")
    print(f"\n[OK] {host_path}")
    return True


def list_backups():
    """Newest-first list of dumps on disk, with their manifest row counts."""
    pattern = os.path.join(BACKUP_DIR, 'alchemy_*.dump')
    files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    return files


def rotate(keep=DEFAULT_KEEP):
    """Delete all but the `keep` newest dumps (and their manifests).

    Rotation is by count rather than by age on purpose: 'keep the last 7' still leaves
    something behind after a month of not touching the project, whereas 'delete older
    than 7 days' would quietly leave zero backups.
    """
    files = list_backups()
    removed = 0
    for path in files[keep:]:
        try:
            os.remove(path)
            manifest = path.replace('.dump', '.manifest.json')
            if os.path.exists(manifest):
                os.remove(manifest)
            removed += 1
        except OSError as exc:
            print(f"[WARN] could not delete {os.path.basename(path)}: {exc}")
    return removed


def show_list():
    files = list_backups()
    if not files:
        print(f"\nNo backups found in {BACKUP_DIR}")
        print("Create one with: python scripts/backup_database.py")
        return

    print(f"\n[BACKUPS] {len(files)} in {BACKUP_DIR}\n")
    for index, path in enumerate(files):
        stamp = datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d %H:%M')
        size_mb = os.path.getsize(path) / (1024 * 1024)
        marker = ' <- newest' if index == 0 else ''
        print(f"  {os.path.basename(path):<32} {stamp}  {size_mb:>7,.1f} MB{marker}")

        manifest_path = path.replace('.dump', '.manifest.json')
        if os.path.exists(manifest_path):
            with open(manifest_path, encoding='utf-8') as handle:
                counts = json.load(handle).get('row_counts', {})
            # Truncate rather than take the first word: 'pxrd_descriptors' and 'pxrd_labels'
            # both start with 'pxrd', so a first-word label would show two identical keys.
            summary = '  '.join(
                f'{table[:12]}={value:,}'
                for table, value in counts.items() if value
            )
            print(f"  {'':<32} {summary}")


def restore_help():
    """Restoring is destructive, so this prints the commands instead of running them.

    A restore overwrites live tables. Whoever runs it should read the command first
    and know which dump they picked - that is a decision, not a script step.
    """
    files = list_backups()
    newest = os.path.basename(files[0]) if files else 'alchemy_YYYYMMDD_HHMMSS.dump'

    print(f"""
[RESTORE] How to bring a dump back

Restoring OVERWRITES the live database. Read these before running them, and check
`--list` first to be sure which dump you want.

  1. Copy the dump into the container:
       docker cp backups/{newest} {CONTAINER_NAME}:/tmp/restore.dump

  2. Restore over the existing database:
       docker exec -e PGPASSWORD=<POSTGRES_PASSWORD> {CONTAINER_NAME} \\
           pg_restore -U <POSTGRES_USER> -d <POSTGRES_DB> --clean --if-exists /tmp/restore.dump

     --clean --if-exists drops each object before recreating it, so the result is the
     dump's state exactly, not the dump merged on top of whatever is there now.

  3. Check the row counts against the .manifest.json saved next to the dump.

Restoring onto a FRESH machine: bring the stack up first (`docker compose up -d`) so
the volume and the database exist. The image is pgvector/pgvector:pg16 - the pgvector
extension must be present before restoring, or the RAG embedding columns fail to
create. Using the same image handles that automatically.

To restore a SINGLE table instead of everything (e.g. only the human labels):
       pg_restore -U <user> -d <db> --data-only --table=pxrd_labels /tmp/restore.dump
""")


def main():
    parser = argparse.ArgumentParser(
        description='Back up the ALCheMy PostgreSQL database to backups/ via pg_dump.',
    )
    parser.add_argument('--keep', type=int, default=DEFAULT_KEEP,
                        help=f'how many backups to retain (default: {DEFAULT_KEEP})')
    parser.add_argument('--list', action='store_true',
                        help='list existing backups and exit')
    parser.add_argument('--restore-help', action='store_true',
                        help='print restore instructions and exit')
    parser.add_argument('--env-file', default=ENV_PATH,
                        help='path to the .env holding the credentials (default: repo root)')
    args = parser.parse_args()

    if args.list:
        show_list()
        return 0

    if args.restore_help:
        restore_help()
        return 0

    if not container_running():
        print(f"[ERROR] container '{CONTAINER_NAME}' is not running.")
        print("        Start the stack first:  docker compose up -d")
        return 1

    env = read_env(args.env_file)
    if env is None:
        return 1

    return 0 if create_backup(env, keep=args.keep) else 1


if __name__ == '__main__':
    sys.exit(main())
