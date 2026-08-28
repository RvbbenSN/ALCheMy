# `app/` — las interfaces de ALCheMy

Biblioteca didáctica de las aplicaciones del proyecto, en el mismo espíritu que
`src/README.md`. Para cada una: **qué hace**, **qué problema resuelve y por qué**, y
**cómo se usa o se reutiliza**.

Todas son [Streamlit](https://streamlit.io). Streamlit vuelve a ejecutar el script
entero en cada interacción, así que cualquier cosa cara —abrir la conexión, leer una
curva, resolver un arPLS— tiene que estar cacheada o vuelve a ocurrir en cada clic. Esa
restricción explica buena parte de la forma de estos ficheros.

## Antes de arrancar cualquiera

```bash
docker compose up -d          # la base de datos tiene que estar levantada
```

Las credenciales salen de `.env` en la raíz del repositorio (no está en git).

---

## Cuál usar

| Quiero… | App |
|---|---|
| Decidir si un patrón es amorfo, incipiente o cristalino, y guardarlo | `pxrd_labeler.py` |
| Entender qué le hace cada operación del pipeline a un difractograma | `pxrd_explorer.py` |
| Ver si un cambio de parámetro aguanta en cientos de patrones | `pxrd_explorer.py`, vista de lote |
| Revisar en bloque los datos de síntesis extraídos del Excel | `main.py` |

**Cuál escribe en la base de datos:** solo `pxrd_labeler.py`, y solo en `pxrd_labels`.
Las otras dos no escriben nada.

---

## `pxrd_labeler.py` — el etiquetador

```bash
streamlit run app/pxrd_labeler.py
```

**Qué hace.** Enseña un difractograma a pantalla completa y recoge cuatro juicios
independientes sobre él: la clase de cristalinidad (obligatoria), el subtipo de
incipiente, la bandera de óxido y la sospecha de multifase. Un clic en «Accept and next»
guarda todo lo elegido y avanza.

**Qué problema resuelve.** Es la etapa E2 del roadmap: producir la **verdad de campo**
que el aprendizaje supervisado necesita. Había ~1.870 difractogramas y cero etiquetas, y
ninguna cantidad de ingeniería de características compensa eso. Hoy lleva **4.843
etiquetas** puestas a mano.

**Por qué tiene la forma que tiene.** Está afinado para etiquetar varios cientos de
patrones de una sentada, y a menudo **en el móvil con una mano**. De ahí que cada
decisión de maquetación persiga «nada de scroll en un móvil, un toque por juicio». Buena
parte de lo que parece sobreingeniería son arreglos a fallos concretos que ya
ocurrieron: subtítulos solapándose tras una regla global de espaciado, el título metido
debajo de la cabecera de Streamlit, columnas negándose a quedarse en una fila en
pantalla estrecha. **El propio fichero pide explícitamente que no se rehaga sin leer
antes por qué está así.**

**Dos decisiones de diseño que no son cosméticas:**

- **Cuatro `label_type` en vez de una categoría.** «Cuánto ha cristalizado», «hay un
  óxido» y «puede haber dos fases» son preguntas distintas que **no varían juntas**: un
  óxido puede aparecer en un patrón amorfo o en uno cristalino. Meterlas en un solo valor
  producía justo la ambigüedad que uno esperaría.
- **Las etiquetas se guardan por `file_hash`, no por `measurement_id`.** La tabla de
  medidas se borra y se vuelve a ingestar de vez en cuando, y eso regenera todos los
  `measurement_id`. Etiquetas colgadas de esos identificadores se destruirían. El hash
  del fichero no cambia, así que las etiquetas sobreviven — y son lo único del proyecto
  que **no se puede reconstruir de ningún fichero**.

**Cómo se reutiliza.** Los patrones de caché (conexión como `cache_resource`, cola y
curvas como `cache_data`, prefetch del siguiente) y el reintento ante conexión caída
—Docker Desktop tira el reenvío de puertos cuando el equipo se suspende— sirven para
cualquier app de este repositorio. `pxrd_explorer.py` los hereda.

---

## `pxrd_explorer.py` — el explorador de descriptores *(solo lectura)*

```bash
streamlit run app/pxrd_explorer.py
```

**Qué hace.** Deja mover los parámetros del pipeline de `src/pxrd_descriptors.py` —la
rigidez λ del arPLS, la ventana de la mediana móvil, el percentil del pedestal, el
umbral de picos, el escalado y suavizado del blanco— y ver en directo qué le hacen a
cualquier difractograma, con las capas dibujadas y el vector de 29 descriptores
recalculándose **al lado de los valores que darían los parámetros por defecto**.

**Qué problema resuelve.** El cuaderno 05 justifica cada elección de parámetro, pero
sobre un puñado de ejemplos. Faltaba la otra mitad: poder preguntarle al pipeline «¿y si
fuera de otra manera?» sobre el caso que uno tenga delante, y sobre muchos a la vez.

Tiene dos vistas, y la segunda es donde está el valor de verdad:

1. **Un patrón.** Qué le hace cada operación a *este* difractograma. Incluye un panel que
   enseña **por qué** se acepta o se descarta cada pico: la componente estrecha contra
   los umbrales, donde se ve que en una muestra amorfa la línea de 3σ pasa por mitad del
   ruido mientras la calibrada queda por encima.
2. **El lote.** Aplica los parámetros actuales a todos los patrones del filtro y da la
   **mediana por clase etiquetada a mano**, contra la que dan los valores por defecto,
   más la separación amorfo/cristalino de ambas. Mirar patrones de uno en uno contesta
   esto muy despacio; esto lo contesta en un clic. **Un cambio que mejora un
   difractograma y destroza la separación en 400 es un cambio malo, y solo esta vista lo
   dice.**

**No escribe en la base de datos, y no por buena voluntad.** Está impedido en tres
sitios independientes:

1. La conexión abre la sesión como `TRANSACTION READ ONLY`, así que **PostgreSQL mismo**
   rechaza cualquier `INSERT`/`UPDATE`/`DELETE`/DDL. Es el que tiene dientes: aguanta
   aunque alguien añada una sentencia descuidada más adelante.
2. `_read()` se niega a enviar nada que no empiece por `SELECT` o `WITH`.
3. No hay ninguna ruta de escritura en el fichero.

La razón de tanto cerrojo: el sentido de la app es mover parámetros. Si un valor
calculado con λ = 1e4 pudiera llegar a `pxrd_descriptors`, la tabla tendría filas que
dicen `pipeline_version = v3.3` con números venidos de otro sitio — exactamente la
contaminación silenciosa que `src/PXRD_PIPELINE_CHANGELOG.md` existe para evitar.

**Por qué está separado del etiquetador.** El etiquetador es para el móvil, sin scroll,
un toque por decisión. Esto es una herramienta de escritorio llena de sliders. Juntarlos
estropearía las dos. Sí comparten lo que merecía la pena compartir: la conexión cacheada
con reintento, la carga cacheada de curvas, el filtro por etiquetas y la paleta.

**Cómo se reutiliza.** El patrón `compute(measurement_id, params_key, ...)` cacheado
sobre la tupla de parámetros sirve para cualquier exploración interactiva de un pipeline
caro: arPLS es una resolución dispersa hasta convergencia, y sin caché la app se
arrastraría. El muestreo del lote es **determinista a propósito** (`np.linspace` sobre
las filas ordenadas, no `sample()`), para que dos configuraciones se comparen sobre
exactamente los mismos patrones y la diferencia no venga en parte de la muestra.

---

## `main.py` — el panel de verificación masiva

```bash
streamlit run app/main.py
```

**Qué hace.** Panel para revisar en bloque los datos de síntesis extraídos del Excel
maestro y de los cuadernos de laboratorio digitalizados, y exportar el resultado
verificado a CSV/Excel.

**Qué problema resuelve.** La ingesta del Excel es automática, pero hay campos que solo
un humano puede confirmar (pesadas, rendimientos, transcripciones dudosas). Esto es el
paso *human-in-the-loop* de esa vía.

**Estado — dos asperezas conocidas**, recogidas también en `CLAUDE.md`:

- Lee `data/processed/lab_notes_digitized.csv`, pero el CSV digitalizado vive hoy en
  `methodology/lab_notes/lab_notes_digitized.csv`. Hasta que se arregle una de las dos
  rutas, salta el aviso de «Staging CSV dataset not found».
- Usa `use_column_width`, retirado en las versiones recientes de Streamlit
  (`use_container_width` fue su sustituto, y este a su vez está deprecado desde finales
  de 2025 en favor de `width='stretch'`).

---

## Convenciones comunes

- **El texto en pantalla va en inglés**; los valores que se escriben en la base de datos
  **no**, y no se pueden renombrar sin una migración (ver `scripts/ddl_pxrd_labels_v2.sql`).
- **Nada se guarda en memoria a la espera de un botón de guardar.** Lo que se escribe, se
  escribe al instante, para que cerrar el navegador o un corte de luz cueste como mucho
  el patrón que estaba en pantalla.
- **La conexión se cachea con `cache_resource`, nunca con `cache_data`**: una conexión es
  un objeto vivo y no se puede copiar ni serializar.
- **Toda consulta pesada lleva reintento**, porque Docker Desktop deja caer el reenvío de
  puertos cuando el equipo se suspende.
