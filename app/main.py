import streamlit as st
import pandas as pd
import numpy as np
import os
from PIL import Image

# Page configuration
st.set_page_config(
    page_title="ALCheMy | Experimental Mass Verification",
    page_icon="🧪",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
    <style>
    .main { background-color: #0E1117; }
    .stMetric { background-color: #1E222D; padding: 12px; border-radius: 8px; }
    .stButton>button { border-radius: 8px; font-weight: bold; background-color: #2E6EEF; color: white; }
    </style>
""", unsafe_allow_html=True)

st.title("🧪 ALCheMy: Experimental Mass Verification Dashboard")
st.caption("Automated PDF Notebook Extraction & Verification (`exp_metal_mass_mg`, `exp_linker_mass_mg`, `exp_mof_yield_mg`) | APMU")

staging_csv = "methodology/lab_notes/lab_notes_digitized.csv"
img_dir = "data/processed/lab_notes_images"
backup_excel = "backups/df_final_backup.xlsx"

if not os.path.exists(staging_csv):
    st.error("Staging CSV dataset not found.")
    st.stop()

df_stage = pd.read_csv(staging_csv)


# Top Metrics Row
c1, c2, c3, c4 = st.columns(4)
c1.metric("Total Syntheses Evaluated", f"{len(df_stage):,}")
c2.metric("Extracted Samples (Non-NULL)", f"{len(df_stage[df_stage['veracity_percent'].notna()]):,}")
c3.metric("Unextracted / NULL Count", f"{len(df_stage[df_stage['veracity_percent'].isna()]):,}")
c4.metric("Scanned Notebook Pages", "118 Pages")

st.divider()

# Filter Controls
col_f1, col_f2 = st.columns([2, 1])

with col_f1:
    search_q = st.text_input("🔍 Search Sample Code (e.g. RS61, RS102):", "")
with col_f2:
    status_filter = st.selectbox(
        "Filter Extraction Status:", 
        ["SHOW ALL", "EXTRACTED ONLY (NON-NULL)", "UNEXTRACTED ONLY (NULL)"],
        index=0
    )

# Apply filters
df_view = df_stage.copy()

if search_q:
    df_view = df_view[df_view['sample_code'].astype(str).str.contains(search_q, case=False, na=False)]

if status_filter == "EXTRACTED ONLY (NON-NULL)":
    df_view = df_view[df_view['veracity_percent'].notna()]
elif status_filter == "UNEXTRACTED ONLY (NULL)":
    df_view = df_view[df_view['veracity_percent'].isna()]

st.subheader(f"📋 Verification Table ({len(df_view)} samples match filters)")

# Display Interactive Table
st.dataframe(
    df_view[[
        'sample_code', 'metal_mass_mg', 'linker_mass_mg', 
        'exp_metal_mass_mg', 'exp_linker_mass_mg', 'mof_exp_mass_mg',
        'veracity_percent', 'source_image_page'
    ]],
    use_container_width=True,
    height=280
)

st.divider()

# Individual Inspection Card
st.subheader("🔎 Individual Sample Verification Card")

if not df_view.empty:
    selected_sample = st.selectbox("Select Sample Code to Inspect/Edit:", options=df_view['sample_code'].tolist())
    sample_row = df_stage[df_stage['sample_code'] == selected_sample].iloc[0]
    
    col_img, col_form = st.columns([1, 1])
    
    with col_img:
        source_pg = str(sample_row.get('source_image_page', 'pdf1_page_1.png'))
        st.markdown(f"**📷 Scanned Lab Note Image (`{source_pg}`)**")
        
        img_path = os.path.join(img_dir, source_pg)
        
        if os.path.exists(img_path):
            st.image(Image.open(img_path), caption=f"Page: {source_pg}", use_container_width=True)
        else:
            st.warning(f"Image '{source_pg}' not found on disk.")

            
    with col_form:
        st.markdown(f"### 📝 Verification Form: `{selected_sample}`")
        st.caption(f"**Metal:** {sample_row.get('metal_center', '')} | **Linker:** {sample_row.get('linker', '')}")
        
        with st.form(key=f"edit_form_{selected_sample}"):
            c_m1, c_m2 = st.columns(2)
            
            with c_m1:
                theo_m = float(sample_row.get('theo_metal_mass_mg', 10.63))
                val_m = float(sample_row['exp_metal_mass_mg']) if pd.notna(sample_row['exp_metal_mass_mg']) else theo_m
                exp_metal_input = st.number_input("Experimental Metal Mass (mg):", value=val_m, step=0.1, format="%.2f")
                st.caption(f"Theoretical Mass: `{theo_m} mg`")
                
            with c_m2:
                theo_l = float(sample_row.get('theo_linker_mass_mg', 0.0))
                val_l = float(sample_row['exp_linker_mass_mg']) if pd.notna(sample_row['exp_linker_mass_mg']) else theo_l
                exp_linker_input = st.number_input("Experimental Linker Mass (mg):", value=val_l, step=0.1, format="%.2f")
                st.caption(f"Theoretical Mass: `{theo_l} mg`")
                
            val_y = float(sample_row['exp_mof_yield_mg']) if pd.notna(sample_row['exp_mof_yield_mg']) else 0.0
            exp_yield_input = st.number_input("Experimental MOF Yield Mass (mg):", value=val_y, step=0.1, format="%.2f")
            
            status_curr = sample_row.get('verification_status', 'NEEDS_HUMAN_VERIFICATION')
            if status_curr == 'AUTO_APPROVED':
                st.success(f"Status: {status_curr}")
            else:
                st.warning(f"Status: {status_curr}")
                
            save_btn = st.form_submit_button("💾 Save Verified Experimental Masses")
            
            if save_btn:
                # Update staging DataFrame
                mask = df_stage['sample_code'] == selected_sample
                df_stage.loc[mask, 'exp_metal_mass_mg'] = exp_metal_input
                df_stage.loc[mask, 'exp_linker_mass_mg'] = exp_linker_input
                df_stage.loc[mask, 'exp_mof_yield_mg'] = exp_yield_input
                df_stage.loc[mask, 'verification_status'] = 'AUTO_APPROVED'
                
                # Recalculate deviation
                dev_m_new = abs(exp_metal_input - theo_m)/theo_m if theo_m > 0 else 0.0
                dev_l_new = abs(exp_linker_input - theo_l)/theo_l if theo_l > 0 else 0.0
                df_stage.loc[mask, 'metal_dev_percent'] = round(dev_m_new * 100, 2)
                df_stage.loc[mask, 'linker_dev_percent'] = round(dev_l_new * 100, 2)
                
                # Save staging CSV
                df_stage.to_csv(staging_csv, index=False)
                
                # Also update backup master Excel
                if os.path.exists(backup_excel):
                    df_b = pd.read_excel(backup_excel)
                    if selected_sample in df_b['sample_code'].values:
                        mask_b = df_b['sample_code'] == selected_sample
                        df_b.loc[mask_b, 'exp_metal_mass_mg'] = exp_metal_input
                        df_b.loc[mask_b, 'exp_linker_mass_mg'] = exp_linker_input
                        df_b.loc[mask_b, 'exp_mof_yield_mg'] = exp_yield_input
                        df_b.to_excel(backup_excel, index=False)
                        
                st.success(f"🎉 Experimental masses for '{selected_sample}' saved successfully!")
                st.rerun()
else:
    st.info("No records match the current filter selection.")
