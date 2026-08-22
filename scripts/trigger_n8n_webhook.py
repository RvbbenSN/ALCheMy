"""
ALCheMy n8n Webhook Tester CLI Script
Sends characterization files and metadata to the n8n Webhook trigger.
"""

import os
import sys
import json
import argparse
import requests

# Default Webhook Endpoint
DEFAULT_WEBHOOK_URL = "http://localhost:5678/webhook/ingest-characterization"
DEFAULT_TEST_WEBHOOK_URL = "http://localhost:5678/webhook-test/ingest-characterization"

def send_webhook(file_path, technique='PXRD', sample_code='RS1883', operator_name='Rubén S.N.', use_test_mode=True):
    url = DEFAULT_TEST_WEBHOOK_URL if use_test_mode else DEFAULT_WEBHOOK_URL
    
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found at {file_path}")
        return False
        
    print(f"\n🚀 Sending HTTP POST request to n8n Webhook: {url}")
    print(f" ├── Sample Code: {sample_code}")
    print(f" ├── Technique:   {technique}")
    print(f" ├── Operator:    {operator_name}")
    print(f" └── File Path:   {file_path} ({os.path.getsize(file_path)} bytes)")
    
    payload = {
        'sample_code': sample_code,
        'technique': technique,
        'operator_name': operator_name
    }
    
    try:
        with open(file_path, 'rb') as f:
            files = {'data_file': (os.path.basename(file_path), f)}
            response = requests.post(url, data=payload, files=files, timeout=15)
            
        print(f"\n📡 Webhook Response Status Code: {response.status_code}")
        try:
            res_json = response.json()
            print("📄 Returned JSON Payload:")
            print(json.dumps(res_json, indent=2, ensure_ascii=False))
        except Exception:
            print("📄 Returned Raw Text:")
            print(response.text)
            
        if response.status_code == 200:
            print("\n✅ Webhook execution SUCCESSFUL!")
            return True
        else:
            print(f"\n⚠️ Webhook returned error code {response.status_code}")
            return False
            
    except Exception as e:
        print(f"\n❌ Connection Error: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Send characterization file to ALCheMy n8n Webhook")
    parser.add_argument('--file', '-f', default='data/sample_datalake_demo/PXRD/24DRX0180-RS1883_CoPy.xrdml', help="Path to characterization file")
    parser.add_argument('--technique', '-t', default='PXRD', help="Analytical technique (PXRD, TGA, FTIR, ADSORPTION, UV_VIS, SEM, ICP, EA)")
    parser.add_argument('--sample', '-s', default='RS1883', help="Sample code")
    parser.add_argument('--operator', '-o', default='Rubén S.N.', help="Operator name")
    parser.add_argument('--prod', action='store_true', help="Use Production Webhook URL instead of Test Webhook URL")
    
    args = parser.parse_args()
    send_webhook(
        file_path=args.file,
        technique=args.technique,
        sample_code=args.sample,
        operator_name=args.operator,
        use_test_mode=not args.prod
    )

if __name__ == '__main__':
    main()
