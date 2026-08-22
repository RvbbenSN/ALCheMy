import json
import os

wf_path = 'workflows/01_master_characterization_ingestion.json'

nodes = [
  {
    "parameters": {},
    "id": "node-trigger-manual",
    "name": "1. Manual Trigger (Run Pipeline)",
    "type": "n8n-nodes-base.manualTrigger",
    "typeVersion": 1,
    "position": [180, 300]
  },
  {
    "parameters": {
      "rule": {
        "interval": [
          {
            "field": "hours",
            "hoursInterval": 24
          }
        ]
      }
    },
    "id": "node-trigger-schedule",
    "name": "2. Daily Cron Schedule (24h)",
    "type": "n8n-nodes-base.scheduleTrigger",
    "typeVersion": 1.2,
    "position": [180, 480]
  },
  {
    "parameters": {
      "command": "python3 -c \"import sys, os; sys.path.insert(0, '/home/node/data/..'); from src.ingest_datalake_to_postgres import run_mass_ingestion; run_mass_ingestion(datalake_dir='/home/node/data/raw_datalake')\""
    },
    "id": "node-exec-python-ingest",
    "name": "3. Execute Deterministic Python Parsers (0€ Cost)",
    "type": "n8n-nodes-base.executeCommand",
    "typeVersion": 1,
    "position": [440, 390]
  },
  {
    "parameters": {
      "operation": "executeQuery",
      "query": "SELECT technique, COUNT(*) as record_count FROM characterization_measurements GROUP BY technique ORDER BY record_count DESC;"
    },
    "id": "node-postgres-summary",
    "name": "4. Query Ingestion Inventory (PostgreSQL)",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.4,
    "position": [700, 390],
    "credentials": {
      "postgres": {
        "id": "alchemy_postgres_cred",
        "name": "ALCheMy PostgreSQL Container"
      }
    }
  }
]

connections = {
  "1. Manual Trigger (Run Pipeline)": {
    "main": [
      [
        {
          "node": "3. Execute Deterministic Python Parsers (0€ Cost)",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "2. Daily Cron Schedule (24h)": {
    "main": [
      [
        {
          "node": "3. Execute Deterministic Python Parsers (0€ Cost)",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "3. Execute Deterministic Python Parsers (0€ Cost)": {
    "main": [
      [
        {
          "node": "4. Query Ingestion Inventory (PostgreSQL)",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}

workflow = {
  "name": "ALCheMy - Master Multimodal Characterization Ingestion Pipeline",
  "nodes": nodes,
  "connections": connections,
  "settings": {
    "executionOrder": "v1"
  },
  "tags": [
    {
      "name": "ALCheMy"
    },
    {
      "name": "DataLake"
    },
    {
      "name": "Ingestion"
    }
  ]
}

os.makedirs('workflows', exist_ok=True)
with open(wf_path, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print(f"Generated n8n master workflow JSON file at: {wf_path}")
