# 📖 Diario de Proyecto & Registro de Aprendizaje: ALCheMy

---

## 📌 Propósito de este Diario
Este documento es la **bitácora viva de tu proyecto**. En él registraremos en lenguaje sencillo cada conversación, cada decisión tomada, cada concepto aprendido y cada cambio realizado. 

Si en algún momento te sientes perdido o quieres recordar *por qué* hicimos algo, este es tu punto de referencia.

---

## 🗓️ Registro de Sesiones y Avances

### 🟢 Sesión 1: Carga de Contexto, Infraestructura Base y Organización Privada
- **Conceptos Teóricos Leídos:**
  - Se leyeron y asimilaron tus apuntes de la *Certificación de Data Science por IBM* (protocolo de 9 fases), el *Máster de IA Aplicada* (RAG, n8n, Agentes) y la *Certificación de AI Engineering* (Keras, CNNs, RNNs).
  - Se revisó la idea del **Proyecto 2 (Smart Lab de Química de Materiales)**: un predictor de síntesis *in-silico*, tratamiento espectroscópico (DRX, FTIR, UV-Vis Band Gap) y asistente RAG.

- **Decisión de Arquitectura e Infraestructura:**
  - Acordamos usar **Docker Compose** para tener tu entorno aislado en tu ordenador (n8n + PostgreSQL + pgAdmin) preparado para que en el futuro sea súper fácil desplegarlo en la nube (Google Cloud Platform - GCP).
  - Acordamos un **Protocolo de Respaldo Anti-Pérdida**: los flujos visuales que crees en n8n se exportarán a la carpeta `n8n_workflows/` para que estén siempre a salvo en Git.

- **Organización de Recursos Privados vs Código Público:**
  - Creamos la carpeta privada en inglés **[`protocols_and_methodology/`](file:///c:/Users/rubbe/Documents/ALCheMy/protocols_and_methodology)** donde hemos reunido toda la documentación teórica, el **`DIARIO_DE_PROYECTO.md`** y el **`PLAN_DE_TRABAJO.md`**.
  - Se homogeneizaron los 4 documentos de n8n/RAG en el manual maestro: **[`protocols_and_methodology/GUIA_MAESTRA_N8N_Y_RAG.md`](file:///c:/Users/rubbe/Documents/ALCheMy/protocols_and_methodology/GUIA_MAESTRA_N8N_Y_RAG.md)**.
  - Se configuró la estructura física de la carpeta `data/`:
    - `data/raw/` y `data/processed/` (Tus experimentos reales) -> **100% OCULTOS en [`.gitignore`](file:///c:/Users/rubbe/Documents/ALCheMy/.gitignore)** por Propiedad Intelectual.
    - `data/sample_demo/` (Dataset sintético anonimizado de 20 muestras) -> **PÚBLICO en GitHub** para que reclutadores o empleadores puedan probar la app.
  - Toda la carpeta `protocols_and_methodology/` está excluida en **[`.gitignore`](file:///c:/Users/rubbe/Documents/ALCheMy/.gitignore)**.

### 🟢 Sesión 2: Construcción de Infraestructura Docker & Protocolo de Ingesta Inteligente
- **Paso 1 (Contenedor n8n):**
  - Creado el archivo **[`.env`](file:///c:/Users/rubbe/Documents/ALCheMy/.env)** y el servicio `alchemy_n8n` en **[`docker-compose.yml`](file:///c:/Users/rubbe/Documents/ALCheMy/docker-compose.yml)**.
  - Probado y verificado el arranque de n8n en `http://localhost:5678`.

- **Diseño del Protocolo de Calidad e Integridad de Ingesta (*Data Quality Gate*):**
  - **Deduplicación por Hash MD5:** n8n calcula la huella dactilar de cada archivo. Si el Hash ya existe en la BD, la muestra duplicada exacta se bloquea.
  - **Deduplicación Semántica por `sample_code` (UPSERT):** Si se sube la misma muestra en otro formato (`.csv` vs `.xlsx`) o editada, n8n detecta la matrícula del material y actualiza (`UPSERT`) el registro existente.
  - **Control de Re-mediciones (`status = active / superseded`):** Si un aparato midió mal y se vuelve a medir, la medición antigua se archiva (`superseded`) y la nueva se marca como activa (`active`), garantizando que el Machine Learning no se contamine.
  - **Estructura por Carpetas de Técnica:** Subcarpetas físicas `data/raw/drx/`, `data/raw/ftir/`, `data/raw/uv_vis/`, `data/raw/bet/`.

- **Decisión de Secuencia de Construcción:**
  - Acordamos **empezar primero por la Base de Datos (PostgreSQL)**, ya que es la "casa" donde n8n necesita realizar las consultas de verificación y guardar la información antes de crear los nodos.

---

## 🗺️ Estado Actual y Próximos Pasos
- [x] Crear el `DIARIO_DE_PROYECTO.md` en `protocols_and_methodology/` para seguimiento continuo.
- [x] Crear el servicio `alchemy_n8n` en Docker Compose y probar el acceso web.
- [x] Registrar el diseño del Protocolo de Calidad de Ingesta (Hash MD5, UPSERT, status active/superseded).
- [ ] **Siguiente paso prioritario:** Diseñar juntos la primera tabla en `scripts/init_db.sql` (Base de Datos) campo a campo.
- [ ] Añadir el servicio de la Base de Datos PostgreSQL + pgvector a `docker-compose.yml` y arrancarlo.
- [ ] Diseñar el flujo de nodos en n8n conectado a la Base de Datos.
