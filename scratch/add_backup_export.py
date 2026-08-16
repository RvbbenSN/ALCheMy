import json

path = 'notebooks/01_Ingesta_y_Transformacion_Excel.ipynb'
with open(path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Export Markdown Cell
export_md = {
    "cell_type": "markdown",
    "metadata": {},
    "source": [
        "## 💾 Step 7: Export Local Clean Excel Backup (`backups/`)\n",
        "Saves a local copy of `df_final` as an Excel file inside the private `backups/` directory (protected by `.gitignore`)."
    ]
}

# Export Code Cell
export_code = {
    "cell_type": "code",
    "execution_count": None,
    "metadata": {},
    "outputs": [],
    "source": [
        "import os\n",
        "# Create backups directory if it does not exist\n",
        "os.makedirs('../backups', exist_ok=True)\n",
        "\n",
        "# Export df_final to Excel\n",
        "backup_path = '../backups/df_final_limpio_backup.xlsx'\n",
        "df_final.to_excel(backup_path, index=False)\n",
        "print(f\"💾 Clean Excel Backup successfully saved to '{backup_path}'!\")"
    ]
}

nb['cells'].insert(-1, export_md)
nb['cells'].insert(-1, export_code)

with open(path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Export cell added successfully!")
