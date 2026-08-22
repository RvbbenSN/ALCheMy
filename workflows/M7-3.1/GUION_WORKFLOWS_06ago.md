# Guion de montaje en n8n · clase del 6 de agosto

**Módulo 7 · Submódulo 3 · Sesión 1 (práctica) — 60 minutos**
Workflows A, B y C del caso YayaFit.

> Los tres están exportados en `n8n_workflows/`. El guion asume que **montas el A en directo** (es el que enseña el concepto) y que el B y el C los **importas ya hechos** y sólo los explicas y ejecutas. No da tiempo a montar los tres a mano.

---

## 0 · Preparación previa (antes de que entren, 5 minutos)

Crea estas Data Tables vacías en n8n. Si las creas en clase pierdes diez minutos y el hilo.

### `matriz_permisos`

| columna | tipo |
|---|---|
| `accion` | String |
| `nivel` | String |
| `max_destinos` | Number |
| `antelacion_min_h` | Number |
| `aprobador` | String |
| `activa` | Boolean |
| `motivo` | String |

Y mételes las filas de `caso_briefing/MATRIZ_PERMISOS_YAYAFIT.md`, sección 2. Con estas cinco basta para la clase:

| accion | nivel | max_destinos | antelacion_min_h | aprobador | activa |
|---|---|---|---|---|---|
| `consultar_documentos` | L4 | 0 | 0 | | true |
| `apuntar_incidencia` | L3 | 0 | 0 | | true |
| `responder_a_una_socia` | L2 | 1 | 0 | coordinacion@yayafit.es | true |
| `avisar_suspension_clase` | L2 | 60 | 24 | coordinacion@yayafit.es | true |
| `cancelar_clase` | L2 | 60 | 24 | direccion@yayafit.es | true |
| `borrar_datos_socia` | L0 | 0 | 0 | | false |

### `log_auditoria`

`cuando` (String) · `agente` (String) · `accion` (String) · `destinatarios` (Number) · `veredicto` (String) · `motivo` (String) · `resultado` (String)

### `contador_envios`

`fecha` (String) · `socia` (String) · `destinatarios` (Number) · `accion` (String)

### `simulacion`

`cuando` · `accion` · `destinatarios` · `para` · `asunto` · `texto` (todo String) · `revisado` (Boolean) · `habria_acertado` (String)

**Credencial:** OpenAI. La de SMTP sólo si vas a enseñar el envío real del workflow C (no hace falta: se queda en simulación).

---

## WORKFLOW A · La matriz de permisos
### Montaje en directo · minutos 12 a 40

La frase con la que abres: *«vamos a montar un agente que sabe decir "esto no me toca a mí"»*.

---

### Nodo 1 · `Peticion` — Form Trigger

- **Form Title:** `YayaFit · petición a la coordinación`
- **Form Description:** `Escribe lo que quieres que haga el asistente.`
- **Form Fields:** un campo, `Petición`, tipo **Textarea**, obligatorio

> **Qué decir:** «esto podría ser un chat, un correo o un schedule. Da igual: lo importante es lo que viene después».

---

### Nodo 2 · `El agente propone` — AI Agent

Aquí está el 80 % del concepto. Ve despacio.

- **Source for Prompt:** `Define below`
- **Prompt:** `{{ $json.Petición }}`
- **Require Specific Output Format:** ✅ **activado** ← *esto es lo nuevo*
- **Options → System Message:**

```
Eres el asistente de coordinación de YayaFit, un gimnasio para personas mayores
(centro Las Acacias, unas 60 socias, 5 clases).

IMPORTANTE: tú NO ejecutas nada. Tu única tarea es PROPONER una acción,
describiéndola con precisión para que el sistema decida si se puede hacer.

Acciones que puedes proponer:
- consultar_documentos, consultar_tiempo, redactar_borrador
- apuntar_incidencia
- responder_a_una_socia, avisar_suspension_clase, cancelar_clase

Devuelve SIEMPRE los campos numéricos con números reales, nunca con palabras.
Si no sabes cuántas socias hay en un grupo, di 0 y explícalo en el motivo.
```

- **Options → Max Iterations:** `6`

> **Qué decir, señalando el lienzo:** «fijaos en que **no tiene ni una sola herramienta colgada debajo**. Este agente no puede enviar un correo aunque se lo pidáis de rodillas. No es que le hayamos dicho que no lo haga: es que no puede».

---

### Nodo 3 · `Modelo` — OpenAI Chat Model

Se cuelga del conector `Chat Model` del agente.

- **Model:** `gpt-4o-mini`
- **Temperature:** `0.2`

> Temperatura baja: no queremos creatividad, queremos que rellene campos.

---

### Nodo 4 · `Formato de la intencion` — Structured Output Parser

Se cuelga del conector `Output Parser`.

- **Schema Type:** `Define below` (manual)
- **Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "accion":        { "type": "string", "description": "nombre exacto de la acción propuesta" },
    "destinatarios": { "type": "number", "description": "cuántas personas la reciben; 0 si ninguna" },
    "clase":         { "type": "string", "description": "clase afectada, o cadena vacía" },
    "antelacion_h":  { "type": "number", "description": "horas de antelación; 0 si no aplica" },
    "motivo":        { "type": "string", "description": "por qué se propone" },
    "texto":         { "type": "string", "description": "el texto literal que se enviaría" }
  },
  "required": ["accion", "destinatarios", "motivo"]
}
```

> **La frase que hay que decir aquí:** «esto es lo que convierte una charla en un sistema. Si el agente dice *"destinatarios: 12"*, tengo un número que puedo comparar. Si dice *"unas cuantas socias"*, no tengo nada».

**Ejecuta ya el flujo con estos cuatro nodos** y enseña la salida JSON. Que la vean antes de seguir.

---

### Nodo 5 · `Extraer la intencion` — Edit Fields (Set)

El agente devuelve `{ "output": { ... } }` y sólo queremos el interior.

- **Mode:** `JSON`
- **JSON Output:** `{{ JSON.stringify($json.output) }}`

> Este es el truco que ya vimos en el módulo 6. Vale la pena recordarlo en diez segundos.

---

### Nodo 6 · `Leer la matriz` — Data Table

- **Operation:** `Get Row(s)`
- **Data Table:** `matriz_permisos`
- **Return All:** ✅

> **Por qué la leemos entera y no filtramos por acción:** porque si filtramos y la acción no existe, no viene nada y el flujo no sabe distinguir «no existe» de «error». Leyéndola entera, el Code puede denegar explícitamente lo desconocido. **Ese es el caso más peligroso de todos.**

---

### Nodo 7 · `Aplicar la politica` — Code

El nodo importante. Pégalo entero (está en el JSON exportado) y **léelo en voz alta línea a línea**.

```js
const intencion = $('Extraer la intencion').first().json;
const filas = $input.all().map(i => i.json);
const regla = filas.find(f => f.accion === intencion.accion);

function veredicto(v, motivo, aprobador) {
  return [{ json: { ...intencion, veredicto: v, motivo, aprobador: aprobador || '' } }];
}

// 1 · ¿Existe la acción en la matriz? Lo desconocido se deniega.
if (!regla) return veredicto('denegar', 'La accion "' + intencion.accion + '" no esta en la matriz.');

// 2 · ¿Está activa?
if (regla.activa === false || regla.activa === 'false')
  return veredicto('denegar', 'La accion esta desactivada temporalmente.');

// 3 · Límites duros
const maxDest = Number(regla.max_destinos || 0);
if (maxDest > 0 && Number(intencion.destinatarios || 0) > maxDest)
  return veredicto('denegar', 'Alcance excedido: ' + intencion.destinatarios + ' (max ' + maxDest + ').');

const minH = Number(regla.antelacion_min_h || 0);
if (minH > 0 && Number(intencion.antelacion_h || 0) < minH)
  return veredicto('denegar', 'Antelacion insuficiente: ' + intencion.antelacion_h + ' h (min ' + minH + ' h).');

// 4 · El nivel decide
if (regla.nivel === 'L4' || regla.nivel === 'L3')
  return veredicto('permitir', 'Nivel ' + regla.nivel + ': el agente puede ejecutar solo.');
if (regla.nivel === 'L2')
  return veredicto('pedir_ok', 'Nivel L2: requiere aprobacion humana.', regla.aprobador);

// 5 · Todo lo demás
return veredicto('denegar', 'Nivel ' + regla.nivel + ': esta accion no la ejecuta el agente.');
```

> **La frase de la clase:** «contad conmigo cuántas veces le preguntamos algo al modelo en este nodo. **Cero.** Son cinco `if`. Por eso esto sí se puede defender ante un cliente».
>
> Y señala el orden: *primero se comprueba lo prohibido, después lo permitido*. Denegar por defecto es la postura segura.

---

### Nodo 8 · `Que hacemos` — Switch

- **Routing Rules**, tres salidas, comparando `{{ $json.veredicto }}`:
  - `permitir` → output key `permitir`
  - `pedir_ok` → output key `pedir_ok`
  - `denegar` → output key `denegar`

---

### Nodos 9, 10 y 11 · `PERMITIR` / `PEDIR OK` / `DENEGAR` — Edit Fields

Tres Set idénticos, con **Include Other Input Fields** activado:

| nodo | `resultado` | `detalle` |
|---|---|---|
| PERMITIR | `EJECUTADO` | `{{ $json.motivo }}` |
| PEDIR OK | `PENDIENTE DE APROBACION` | `{{ 'Debe aprobarlo: ' + $json.aprobador }}` |
| DENEGAR | `DENEGADO` | `{{ $json.motivo }}` |

> Hoy son sólo etiquetas. **Mañana, la rama `PEDIR OK` es la que se conecta al nodo Wait.** Dilo, porque engancha las dos clases.

---

### Nodo 12 · `Registrar en auditoria` — Data Table

Las **tres** ramas apuntan aquí.

- **Operation:** `Insert`
- **Data Table:** `log_auditoria`
- **Columns:**

| columna | valor |
|---|---|
| `cuando` | `{{ $now.toISO() }}` |
| `agente` | `agente_coordinacion_v1` |
| `accion` | `{{ $json.accion }}` |
| `destinatarios` | `{{ $json.destinatarios }}` |
| `veredicto` | `{{ $json.veredicto }}` |
| `motivo` | `{{ $json.motivo }}` |
| `resultado` | `{{ $json.resultado }}` |

> **La pregunta para la clase:** *«¿por qué apunto también las denegadas?»* Deja que contesten. La respuesta: porque si una acción se deniega siempre, sobra; y si se aprueba siempre, puede subir de nivel. **El log es lo que te permite calibrar la matriz con datos.**

---

### Las tres pruebas · minutos 33 a 40

Ejecútalas en este orden y abre el formulario cada vez.

**1 — «¿Qué dice el protocolo de calor?»**
→ acción `consultar_documentos`, nivel L4 → **PERMITIR**
*«Lectura pura. Reversible y sin alcance. El agente hace esto todo el día y nadie se entera.»*

**2 — «Avisa a las 12 socias del aquagym de que mañana no hay clase»**
→ acción `avisar_suspension_clase`, 12 destinatarios, ~20 h de antelación → **DENEGAR** por antelación
*Aquí para y pregunta:* «¿por qué lo ha denegado, si sólo son 12 socias?» → porque el límite duro de **24 h** manda sobre el nivel.

**3 — La misma, pero diciendo «pasado mañana»**
→ ahora sí cumple la antelación → **PEDIR OK**
*«Misma acción, mismo agente, misma frase casi. Lo que cambia es un número. Y ese número lo puso una persona en una tabla.»*

**Cierre de la hora práctica:** abre `log_auditoria` en n8n. Tres filas, tres veredictos distintos. *«Esto es lo que enseñáis en la reunión del lunes.»*

---

## WORKFLOW B · Las cuatro restricciones
### Importar y ejecutar · minutos 40 a 48

**No lo montes.** Impórtalo, abre el nodo `Comprobar restricciones` y explica que devuelve `permitido: true/false` **y la lista completa de motivos** (no se para en el primero).

El nodo `Intencion de prueba` trae un caso preparado. **Modifícalo en directo, una restricción por vez**, ejecutando entre cambio y cambio:

| Cambia esto | Salta |
|---|---|
| `destinatarios: 80` | **ALCANCE** — máximo 60 |
| `centro: "Las Rosas"` | **ALCANCE** — centro no permitido |
| mete `dosis` en el campo `texto` | **CONTENIDO** — consejo médico |
| deja `hipertension` en el texto con `destinatarios: 12` | **CONTENIDO** — patología en correo grupal |
| borra el campo `fuente` con acción `responder_a_una_socia` | **CONTENIDO** — falta la cita |
| `accion: cancelar_clase` + `antelacion_h: 3` | **MOMENTO** — mínimo 24 h |

Y si la clase es a las 19:30, **el propio reloj hará saltar la restricción de horario** (22:00–8:00) en cuanto pongas la hora a mano. Es el mejor ejemplo posible: la restricción no depende de nadie, depende de un número.

> **La frase:** «ninguna de estas seis comprobaciones le pregunta nada al modelo. Todas comparan datos con números».

---

## WORKFLOW C · Modo simulación
### Importar y ejecutar · minutos 48 a 57

Cuatro nodos. Se explica en dos minutos y se ejecuta en uno.

`Schedule` → `MODO` (Set) → `Es modo real` (IF) → **Send Email** / **Data Table insert**

- Con `modo = simulacion` → va a la rama de abajo y **apunta en la tabla `simulacion` lo que HABRÍA enviado**.
- Con `modo = real` → sale el correo.

**Ejecútalo dos veces**, cambiando el valor del campo `modo`. Que vean que la única diferencia es una palabra.

Luego abre la tabla `simulacion` y enseña las dos últimas columnas: `revisado` y `habria_acertado`.

> **El método, dicho tal cual:** «una semana en simulación. Cada mañana abres esta tabla, lees las propuestas de ayer y marcas si habrían estado bien. Al cabo de una semana tienes 40 casos reales para corregir el prompt y las políticas. Eso no lo ves en una demo: lo ves en 200 propuestas seguidas».
>
> Y la advertencia: «guarda el **texto completo**, nunca un resumen. Lo que revisas por la mañana tiene que ser exactamente lo que se habría enviado».

---

## Cierre de la sesión práctica · minutos 57 a 60

Slide 11 (ficheros) y una frase de enganche con la segunda hora:

> «Hoy hemos aprendido a **decidir**. Todavía no hemos preguntado a nadie. La rama `PEDIR OK` está ahí, sin conectar a ningún sitio. En la segunda hora diseñamos qué pasa cuando alguien tiene que decir que sí — y mañana lo montamos.»

---

## Si algo falla en directo

| Síntoma | Causa casi segura | Arreglo rápido |
|---|---|---|
| El agente devuelve texto, no JSON | falta activar **Require Specific Output Format** | actívalo y vuelve a ejecutar |
| `$json.accion` viene vacío | te falta el nodo `Extraer la intencion` | comprueba que el Set en modo JSON está en medio |
| El Code devuelve siempre `denegar` | el nombre de la acción no coincide con la fila de la tabla | mira la salida del agente y compara literalmente |
| El Data Table no encuentra la tabla | la seleccionaste por nombre y no existe | créala o cámbiala en el selector |
| El Switch manda todo a la salida 1 | comparas contra el campo equivocado | debe ser `{{ $json.veredicto }}` |
| Todo va lento | `Max Iterations` alto y modelo grande | baja a `gpt-4o-mini` y 6 iteraciones |

**Plan B si n8n se cae:** los tres workflows están exportados. Ábrelos en el editor, enseña el lienzo y explica el nodo Code sobre la slide 8, que tiene las cinco comprobaciones escritas. La clase se puede dar entera sin ejecutar nada.
