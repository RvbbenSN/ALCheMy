"""
Export the live ALCheMy n8n workflow to n8n_workflows/ALCheMy_master.json.

The workflow itself lives inside n8n's own database, not in this repository, so
every fix made to it (node code, connections, model names, thresholds) exists in
exactly one place and disappears with the container's volume. The n8n_workflows/
folder used to hold ad-hoc browser downloads with names like "ALCheMy (2).json",
which made it impossible to tell which one was current.

This writes a single, stable, overwritable export so the workflow is recoverable
and its history is visible in git diffs.

Usage:
    python src/export_n8n_workflow.py
"""

import os
import json
import urllib.request

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SRC_DIR)

WORKFLOW_ID = '6p4lEVEe8rwUgEkO'
N8N_BASE = os.environ.get('N8N_BASE_URL', 'http://localhost:5678')
OUT_PATH = os.path.join(ROOT_DIR, 'n8n_workflows', 'ALCheMy_master.json')


def api_key():
    key = os.environ.get('N8N_API_KEY')
    if key:
        return key
    env_path = os.path.join(ROOT_DIR, '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('N8N_API_KEY='):
                    return line.split('=', 1)[1].strip()
    raise SystemExit('N8N_API_KEY not found in the environment or in .env')


def main():
    req = urllib.request.Request(
        N8N_BASE.rstrip('/') + '/api/v1/workflows/' + WORKFLOW_ID,
        headers={'X-N8N-API-KEY': api_key()})
    with urllib.request.urlopen(req) as resp:
        wf = json.loads(resp.read().decode('utf-8'))

    # Keep only what defines the workflow. The rest is instance state (share lists,
    # version counters, timestamps) that would churn the diff on every export
    # without describing any real change. Credentials are referenced by id only -
    # n8n never returns their secrets through this endpoint.
    export = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings', {}),
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(export, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print('Exported %d nodes to %s' % (len(export['nodes']), OUT_PATH))


if __name__ == '__main__':
    main()
