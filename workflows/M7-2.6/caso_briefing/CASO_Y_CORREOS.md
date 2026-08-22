# Caso completo · Briefing diario de YayaFit

**Módulo 7 · 4 de agosto** — material para la clase práctica.

---

## 1 · La empresa (el caso)

**YayaFit** es un gimnasio para personas mayores. Centro *Las Acacias*, unas 60 socias, cinco clases: gimnasia suave, aquagym, paseo saludable, pilates para mayores y fuerza y equilibrio.

Cada mañana, la coordinadora del centro necesita saber:

- **Qué ha pasado fuera** (previsión meteorológica, avisos, noticias) → *búsqueda web + tiempo*
- **Qué han escrito socias y familias** (correos de la noche) → *lectura de correo (IMAP)*
- **Qué sabemos nosotros** (clases, socias, protocolos, instalaciones) → *RAG*

Y con todo eso, generar un **briefing** con las fuentes citadas.

> **El hilo del caso:** una **ola de calor** obliga a suspender las clases **al aire libre** (Aquagym y Paseo saludable); a esas clases asisten socias concretas —**Carmen Ruiz (84, hipertensión)** y **Pilar Ibáñez (78, cardiopatía)**—; el protocolo exige avisar con **24 horas** y, si superan los 80 años, **por teléfono**; y además la piscina es de un **proveedor único** (Piscina Municipal El Pinar).
>
> Nadie tiene esa respuesta completa en un solo sitio. Ese es el «momento ajá» de la clase.

---

## 2 · Documentos que hay que subir al RAG

Están en `caso_briefing/documentos_rag/` (5 PDFs):

| Fichero | Qué contiene | Para qué sirve en el briefing |
|---|---|---|
| `01_catalogo_clases.pdf` | Clases, dónde, horario, aforo, monitor | Saber **qué clases son al aire libre** |
| `02_socias_y_grupos.pdf` | Socias, edad, clases, salud, familia | Saber **a quién hay que avisar** y por qué |
| `03_protocolos_seguridad.pdf` | Protocolo de calor, avisos, cancelaciones | La regla de **35 °C** y el **preaviso de 24 h** |
| `04_proveedores_instalaciones.pdf` | Piscina, parque, salas, transporte | Que la **piscina es proveedor único** |
| `05_incidencias_historico.pdf` | Incidencias del último año | El precedente: **un mareo por calor** y **una queja por no avisar** |

Súbelos con el workflow `A_ingesta_pinecone`. Son PDFs con texto real, así que se leen sin OCR.

---

## 3 · Correos que tienes que mandarte

Envíalos **a tu buzón de pruebas** (el que leerá el `Email Trigger (IMAP)`). Copia y pega tal cual.

---

### Correo 1 · Consulta de una familia

**Asunto:** `¿Habrá aquagym esta semana con el calor?`

```
Buenos días,

Soy Andrés, el hijo de Pilar Ibáñez. He visto que están dando aviso por calor
para toda la semana y quería saber si el aquagym del martes se mantiene.

Mi madre tiene una cardiopatía leve y, si hace mucho calor, prefiero que no
vaya. ¿Podéis confirmarme si hay clase o si se cambia a la sala?

Muchas gracias,
Andrés Ibáñez
```

---

### Correo 2 · Aviso de la instalación (proveedor)

**Asunto:** `Aviso: restricción de uso de la piscina El Pinar`

```
Estimados,

Les informamos de que, por las altas temperaturas previstas y las tareas de
mantenimiento del vaso, la Piscina Municipal El Pinar restringirá el uso de
calles cedidas durante la próxima semana.

Les rogamos que reprogramen las actividades previstas.

Un saludo,
Coordinación de Instalaciones Deportivas — Ayuntamiento
```

---

### Correo 3 · Reclamación

**Asunto:** `Reclamación: nadie avisó de que no había paseo`

```
Buenas tardes,

Mi tía Josefa Moreno se presentó ayer en el parque a las nueve y no había
clase ni monitora. Tiene 81 años y camina con bastón; estuvo veinte minutos
al sol esperando.

Es la segunda vez que pasa algo así. Espero una explicación.

Ana Moreno
```

---

### Correo 4 · Interno

**Asunto:** `Cuadrante de monitores — semana del 10`

```
Hola equipo,

Recordad que el jueves cerramos el cuadrante de la semana del 10. Álvaro está
de vacaciones dos días, así que hay que cubrir aquagym y fuerza.

Gracias,
Coordinación YayaFit
```

---

### Correo 5 (opcional) · Ruido

**Asunto:** `Newsletter — Novedades en actividad física para mayores`

```
Boletín mensual: agenda de jornadas, ofertas de material deportivo y
entrevistas del sector.
```

*Sirve para comprobar que el agente lo clasifica como irrelevante y no lo mete en el briefing.*

---

## 4 · Qué debe salir en el briefing

Cuando ejecutes el agente, debería ser capaz de:

1. **Relacionar** el aviso de calor (web/tiempo) con las clases **al aire libre** (RAG: catálogo) — Aquagym y Paseo saludable.
2. **Identificar a las socias afectadas** (RAG: socias) — Carmen Ruiz, Pilar Ibáñez y Josefa Moreno.
3. **Recordar el protocolo**: se suspende por encima de 35 °C y hay que avisar con **24 h**; a las mayores de 80, **por teléfono** (RAG: protocolos).
4. **Avisar del riesgo**: la piscina es **proveedor único** y además ha mandado un aviso de restricción (RAG: instalaciones + correo 2).
5. **Recordar el precedente**: ya hubo un **mareo por calor** y una **queja por no avisar** (RAG: incidencias).
6. **Citar la fuente de cada afirmación**: URL si viene de la web, nombre del documento si viene del RAG, asunto si viene de un correo.

**La pregunta estrella para probarlo:**

> «¿Cómo nos afecta la ola de calor y a qué socias hay que avisar?»

Un agente bien montado responde: clases afectadas → socias concretas (con su motivo de salud) → obligación de preaviso de 24 h y llamada telefónica a las mayores de 80 → alternativa en sala climatizada → **con las fuentes de cada dato**.

---

## 5 · Orden de ejecución en clase

1. `A_ingesta_pinecone` — subir los 5 PDFs al RAG.
2. `B_correos_a_pinecone` — leer el buzón y guardar los correos (con metadato `fuente=email`).
3. `C_agente_briefing` — el agente multi-herramienta: tiempo + web + RAG + correos → briefing con citas.
4. `D_ingesta_grafo_neo4j` — construir el grafo del caso.
5. `E_agente_grafo` — preguntar al grafo y **verlo dibujado** en Neo4j Browser.
6. `F_multiagente_briefing` — el coordinador con sus tres especialistas.

---

## 6 · Nota sobre IMAP y SMTP

- **Leer** el buzón → **IMAP** (`Email Trigger (IMAP)`), puerto 993.
- **Enviar** el briefing → **SMTP** (`Send Email`), puerto 465/587.

Son dos protocolos distintos: hacen falta las dos credenciales.

---

## 7 · Sobre el tono

Es un negocio de cuidado a personas mayores: el briefing debe ser **claro y humano**. Nada de «usuarios» ni de jerga: son **socias**, con nombre, edad y una familia detrás. Cuando el agente proponga acciones, que sean concretas: *«llamar por teléfono a Carmen Ruiz (84) antes de las 18:00»*, no *«notificar a los afectados»*.
