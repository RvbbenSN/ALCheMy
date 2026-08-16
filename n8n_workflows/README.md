# 📦 Directorio de Respaldo de Flujos n8n (ALCheMy Workflows)

---

## 📌 Propósito de esta Carpeta
En este directorio se almacenan los archivos `.json` exportados de los flujos de trabajo creados en **n8n**. Esto garantiza que todos tus flujos de automatización, parsing de caracterización, RAG e ingesta estén versionados en Git y **nunca se pierdan**.

---

## 🚀 Cómo Exportar e Importar Flujos

### Exportar un Flujo desde n8n
1. Abre n8n en el navegador (`http://localhost:5678`).
2. Abre el flujo que deseas guardar.
3. En la esquina superior derecha, haz clic en los **3 puntos (...)** -> **Export**.
4. Guarda el archivo `.json` en esta carpeta (`n8n_workflows/`).
5. Realiza un `git commit` para registrar los cambios.

### Importar un Flujo en n8n
1. Abre n8n.
2. En la esquina superior derecha, haz clic en **(...)** -> **Import from File**.
3. Selecciona el archivo `.json` de este directorio.
