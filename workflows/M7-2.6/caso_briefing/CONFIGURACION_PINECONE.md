# Configuración de Pinecone para el RAG

**Módulo 7 · caso YayaFit** — lo que hay que tener listo *antes* de la clase.

---

## 1 · Crear la cuenta

1. Entra en <https://www.pinecone.io> y crea una cuenta (el plan **Starter/gratuito** sobra para la clase).
2. Confirma el correo y entra a la consola.

---

## 2 · Crear el índice

En la consola: **Indexes → Create index**.

| Campo | Valor | Por qué |
|---|---|---|
| **Name** | `yayafit` | es el nombre que usan los workflows |
| **Dimensions** | `1536` | porque usamos `text-embedding-3-small` de OpenAI |
| **Metric** | `cosine` | la métrica habitual para similitud semántica |
| **Type** | Serverless | más simple y suficiente |
| **Cloud/Region** | la que te ofrezca por defecto | irrelevante para la clase |

> ⚠️ **Las dimensiones deben coincidir con el modelo de embeddings.**
> `text-embedding-3-small` → **1536** · `text-embedding-3-large` → **3072**.
> Si no coinciden, Pinecone rechaza los vectores con un error de dimensión.

---

## 3 · Obtener la API key

**API Keys → Create API key** (o copia la que hay por defecto). Guárdala: la necesitas en n8n.

---

## 4 · Crear la credencial en n8n

1. En n8n: **Credentials → New → Pinecone API**.
2. Pega la **API key**.
3. Guarda.

Y crea también la credencial **OpenAI API** (la usan los nodos de embeddings y los chat models).

---

## 5 · Los namespaces del caso

Usamos **un índice y dos namespaces** (son como carpetas dentro del índice):

| Namespace | Qué guarda | Lo escribe | Lo lee |
|---|---|---|---|
| `documentos` | los 5 PDFs del centro | workflow **A** | herramienta `consultar_documentos` |
| `correos` | los correos del buzón | workflow **B** | herramienta `consultar_correos` |

Separarlos permite que el agente sepa **de dónde viene cada cosa** y pueda citarlo bien.

---

## 6 · Cómo quedan configurados los nodos

### Nodo `Pinecone Vector Store` en modo **Insert** (workflows A y B)

- **Operation Mode:** `Insert Documents`
- **Index:** `yayafit`
- **Namespace:** `documentos` (o `correos`)
- Cuelgan de él tres sub-nodos:
  - **Embeddings OpenAI** → modelo `text-embedding-3-small`
  - **Default Data Loader** → de dónde sale el texto **+ los metadatos**
  - **Recursive Character Text Splitter** → `chunkSize: 800`, `chunkOverlap: 120`

### Nodo `Pinecone Vector Store` en modo **Retrieve as Tool** (workflows C y F)

- **Operation Mode:** `Retrieve Documents (As Tool for AI Agent)`
- **Name:** `consultar_documentos` / `consultar_correos`
- **Description:** la que lee el modelo para decidir (¡la parte importante!)
- **Limit / topK:** `5`
- Cuelga de él su **Embeddings OpenAI** (el mismo modelo que en la ingesta).

---

## 7 · Los metadatos: sin esto no hay citas

En el **Default Data Loader**, sección *Metadata*, añadimos:

| Clave | Valor | Para qué |
|---|---|---|
| `fuente` | nombre del fichero / `correo: <asunto>` | es lo que el agente citará |
| `tipo` | `documento_interno` / `email` | permite distinguir el origen |

El System Message del agente le obliga a citar ese campo. **Si no guardas metadatos en la ingesta, el agente no puede citar nada después.**

---

## 8 · Comprobar que ha funcionado

1. Ejecuta el workflow **A** y sube los 5 PDFs.
2. En la consola de Pinecone, entra en el índice `yayafit` → pestaña **Browser** → namespace `documentos`.
3. Deberías ver varias decenas de vectores (cada PDF genera varios trozos).
4. Prueba una búsqueda desde la consola con un texto tipo *«protocolo de calor»* y mira si devuelve el trozo correcto.

---

## 9 · Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `dimension mismatch` | el índice no tiene 1536 | recrea el índice con las dimensiones del modelo |
| No devuelve nada | escribiste en un namespace y lees de otro | revisa que coincidan |
| Devuelve trozos irrelevantes | trozos demasiado grandes o pocos documentos | baja `chunkSize`, sube el solape |
| El agente no cita | faltan metadatos en la ingesta | añade `fuente` en el Data Loader y vuelve a ingerir |
| Respuestas desactualizadas | el documento cambió | vuelve a ejecutar la ingesta (el índice no se actualiza solo) |

---

## 10 · Alternativas (si no quieres Pinecone)

- **Qdrant** — se puede levantar en local con Docker; nodo propio en n8n.
- **Supabase / PGVector** — si ya usas Postgres.
- **Simple Vector Store** (en memoria de n8n) — vale para una demo, pero se pierde al reiniciar.

Los workflows se adaptan cambiando solo el nodo de vector store: el resto (loader, splitter, embeddings, agente) queda igual.
