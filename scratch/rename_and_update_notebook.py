import json
import os

old_path = 'notebooks/01_Ingesta_y_Transformacion_Excel.ipynb'
new_path = 'notebooks/01_Excel_Ingestion_and_Transformation.ipynb'

with open(old_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Save to new English file path
with open(new_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

# Remove old notebook file
if os.path.exists(old_path):
    os.remove(old_path)

print(f"Successfully renamed notebook from '{old_path}' to '{new_path}'!")
