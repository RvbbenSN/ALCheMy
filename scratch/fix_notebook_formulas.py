import json

path = 'notebooks/01_Ingesta_y_Transformacion_Excel.ipynb'

with open(path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Step 3 Markdown Source
step3_md = [
    "## ⚗️ Step 3: Dual Stoichiometric Feature Engineering for Modulators & Solvents\n",
    "\n",
    "### 📐 Chemical Formulations (LaTeX)\n",
    "\n",
    "#### 🔹 Type A Modulators (Known Molar Aqueous Solutions: $HCl$, $HF$, $KOH$)\n",
    "For aqueous solutions with defined Molarity ($M$ in mol/L):\n",
    "$$n_{\\text{mmol}} = V_{\\text{mL}} \\times M = \\frac{V_{\\text{uL}}}{1000.0} \\times M$$\n",
    "\n",
    "#### 🔸 Type B Modulators (Pure Organic Liquids: Density $\\rho$, Purity %, Molecular Weight $MW$)\n",
    "For pure/commercial liquid organic modulators added in microliters ($V_{\\text{uL}}$):\n",
    "$$\\text{Pure Mass (g)} = \\frac{V_{\\text{uL}}}{1000.0} \\times \\rho_{\\text{g/mL}} \\times \\frac{\\text{Purity(\\%)}}{100}$$\n",
    "$$n_{\\text{mmol}} = \\frac{\\text{Pure Mass (g)}}{MW_{\\text{g/mol}}} \\times 1000 = \\frac{V_{\\text{uL}} \\times \\rho_{\\text{g/mL}} \\times \\text{Purity(\\%)} \\times 10.0}{MW_{\\text{g/mol}}}$$\n",
    "\n",
    "#### 📊 Physical Constants Database for Pure Modulators:\n",
    "- **Formic Acid ($HCOOH$):** $\\rho = 1.22 \\text{ g/mL}$, $MW = 46.03 \\text{ g/mol}$, Purity = $98\\%$\n",
    "- **Acetic Acid ($CH_3COOH$):** $\\rho = 1.05 \\text{ g/mL}$, $MW = 60.05 \\text{ g/mol}$, Purity = $99.8\\%$\n",
    "- **Propionic Acid ($C_3H_6O_2$):** $\\rho = 0.99 \\text{ g/mL}$, $MW = 74.08 \\text{ g/mol}$, Purity = $99.5\\%$\n",
    "- **Trifluoroacetic Acid ($TFA - CF_3COOH$):** $\\rho = 1.49 \\text{ g/mL}$, $MW = 114.02 \\text{ g/mol}$, Purity = $99\\%$\n",
    "- **Triflic Acid ($CF_3SO_3H$):** $\\rho = 1.70 \\text{ g/mL}$, $MW = 150.08 \\text{ g/mol}$, Purity = $99\\%$\n",
    "- **Triethylamine ($(C_2H_5)_3N$):** $\\rho = 0.726 \\text{ g/mL}$, $MW = 101.19 \\text{ g/mol}$, Purity = $99.5\\%$\n",
    "- **Methanesulfonic Acid ($CH_4O_3S$):** $\\rho = 1.48 \\text{ g/mL}$, $MW = 96.11 \\text{ g/mol}$, Purity = $99.5\\%$\n",
    "\n",
    "#### 💧 Total Homogenized Water Volume ($H_2O_{\\text{total}}$):\n",
    "$$H_2O_{\\text{total,mL}} = H_2O_{\\text{pure,mL}} + \\sum \\text{Volume of aqueous solution modulators (mL)}$$"
]

# Step 4 Markdown Source
step4_md = [
    "## 🌡️ Step 4: Comprehensive Thermal Ramp Parser (°C/min Rates)\n",
    "\n",
    "### 📐 Microwave & Instant-Cooling Parser Rules:\n",
    "1. **`asap` Cooling Duration:** Converted to **10 minutes** ($10 / 60 = 0.1667 \\text{ hours}$), representing real microwave fan cooling.\n",
    "2. **Zero Plateau Hold Duration:** Patterns like `r.t(5')-150ºC-60ºC(asap)` with no duration in the middle part set `time_hours = 0.0` hours (instant cooling upon target temp reach).\n",
    "\n",
    "### 📐 Mathematical Formulation (LaTeX)\n",
    "1. **Ramp Duration in Minutes ($t_{\\text{min}}$):\n",
    "$$t_{\\text{heating\\_min}} = t_{\\text{heating\\_hours}} \\times 60.0$$\n",
    "\n",
    "2. **Heating & Cooling Slope Rates ($\\text{°C/min}$):\n",
    "$$v_{\\text{heating\\_c\\_min}} = \\frac{T_{\\text{target}} - T_{\\text{initial}}}{t_{\\text{heating\\_min}}} = \\frac{T_{\\text{target}} - T_{\\text{initial}}}{t_{\\text{heating\\_hours}} \\times 60}$$\n",
    "$$v_{\\text{cooling\\_c\\_min}} = \\frac{T_{\\text{target}} - T_{\\text{final}}}{t_{\\text{cooling\\_min}}} = \\frac{T_{\\text{target}} - T_{\\text{final}}}{t_{\\text{cooling\\_hours}} \\times 60}$$"
]

nb['cells'][5]['source'] = step3_md
nb['cells'][7]['source'] = step4_md

with open(path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Successfully restored all double-escaped LaTeX formulas in cells 5 and 7!")
