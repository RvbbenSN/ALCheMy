import json

path = 'notebooks/01_Ingesta_y_Transformacion_Excel.ipynb'
with open(path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Define step 7 (Export Local Clean Excel Backup)
step7_md = {
    "cell_type": "markdown",
    "metadata": {},
    "source": [
        "## 💾 Step 7: Export Local Clean Excel Backup (`backups/`)\n",
        "Saves a local copy of `df_final` as an Excel file inside the private `backups/` directory (protected by `.gitignore`)."
    ]
}

step7_code = {
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

# Define step 8 (PostgreSQL Loading)
step8_md = {
    "cell_type": "markdown",
    "metadata": {},
    "source": [
        "## 🔌 Step 8: PostgreSQL Loading (PAUSED - Run Only When Fully Verified)\n",
        "Uncomment the cell below when you are 100% satisfied with `df_final` to upload all records to Docker PostgreSQL."
    ]
}

step8_code = {
    "cell_type": "code",
    "execution_count": None,
    "metadata": {},
    "outputs": [],
    "source": [
        "# ======================================================================\n",
        "# PAUSED: Uncomment lines below when ready to insert df_final into PostgreSQL\n",
        "# ======================================================================\n",
        "# db_uri = 'postgresql://alchemy_user:alchemy_pass_2026@localhost:5432/alchemy_db'\n",
        "# engine = create_engine(db_uri)\n",
        "# df_final.to_sql('synthesis_experiments', engine, if_exists='append', index=False)\n",
        "# print(f\"🚀 Successfully uploaded {len(df_final)} rows to PostgreSQL!\")"
    ]
}

# Filter out duplicate trailing steps and rebuild cleanly
new_cells = nb['cells'][:14] # Keep steps 0 to 6
new_cells.append(step7_md)
new_cells.append(step7_code)
new_cells.append(step8_md)
new_cells.append(step8_code)

nb['cells'] = new_cells

with open(path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Successfully updated notebook step structure!")
