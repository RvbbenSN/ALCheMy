# Matriz de permisos y políticas · YayaFit

**Módulo 7 · Submódulo 3 — Permisología y Human-in-the-Loop (5, 6 y 7 de agosto)**

Este documento es el entregable del submódulo: lo que se reparte en clase, lo que se copia en las Data Tables de n8n y lo que, en una empresa de verdad, firmaría el responsable del centro.

---

## 1 · La escala de autonomía

| Nivel | Nombre | Qué significa | Quién ejecuta |
|---|---|---|---|
| **L0** | SUGIERE | Lo propone en el briefing y ahí se queda | una persona, a mano |
| **L1** | PREPARA | Deja el borrador hecho, sin enviar | una persona, pulsando enviar |
| **L2** | PIDE OK | Ejecuta sólo tras aprobación explícita | el agente, con permiso |
| **L3** | AVISA | Ejecuta y notifica; se puede revertir | el agente |
| **L4** | AUTÓNOMO | Ejecuta y sólo queda el registro | el agente |

> **El nivel es de la ACCIÓN, no del agente.** El mismo agente lee en L4 y avisa en L2.

Toda acción nueva empieza en **L1 o L2**. Se sube de nivel con datos: si durante varias semanas el porcentaje de rechazos baja del 2 %, se puede subir. Si hay un incidente, se baja.

---

## 2 · La matriz de permisos (para copiar en la Data Table `matriz_permisos`)

| accion | nivel | max_destinos | antelacion_min_h | aprobador | activa | motivo |
|---|---|---|---|---|---|---|
| `consultar_documentos` | L4 | 0 | 0 | | true | lectura, reversible, alcance nulo |
| `consultar_tiempo` | L4 | 0 | 0 | | true | API externa de sólo lectura |
| `consultar_grafo` | L4 | 0 | 0 | | true | Cypher de sólo lectura |
| `redactar_borrador` | L4 | 0 | 0 | | true | no sale del sistema |
| `apuntar_incidencia` | L3 | 0 | 0 | | true | escritura interna, se puede editar |
| `responder_a_una_socia` | L2 | 1 | 0 | coordinacion@yayafit.es | true | sale fuera, aunque a una sola persona |
| `avisar_suspension_clase` | L2 | 60 | 24 | coordinacion@yayafit.es | true | irreversible y de alcance amplio |
| `cancelar_clase` | L2 | 60 | 24 | direccion@yayafit.es | true | compromete al centro |
| `reservar_instalacion` | L2 | 1 | 48 | direccion@yayafit.es | true | compromiso con un tercero |
| `borrar_datos_socia` | L0 | 0 | 0 | | false | nunca lo ejecuta el agente |
| `hacer_pago` | L0 | 0 | 0 | | false | nunca lo ejecuta el agente |

**Columnas de la tabla en n8n**

| columna | tipo | para qué |
|---|---|---|
| `accion` | string | el nombre exacto que devuelve el agente |
| `nivel` | string | L0–L4 |
| `max_destinos` | number | límite duro de alcance; 0 = no aplica |
| `antelacion_min_h` | number | horas mínimas de preaviso; 0 = no aplica |
| `aprobador` | string | correo de una persona concreta |
| `activa` | boolean | interruptor por acción |
| `motivo` | string | por qué esa acción tiene ese nivel |

> Las dos últimas filas están en L0 **y** con `activa = false`: doble barrera. Además, la herramienta correspondiente no existe siquiera en el catálogo del agente.

---

## 3 · Las ocho políticas

Se evalúan **de arriba abajo** y la primera que casa manda. Lo prohibido se comprueba antes que lo permitido.

| # | Si… | Entonces… | Por qué |
|---|---|---|---|
| **P8** | borrar, modificar datos de socias o hacer pagos | **DENEGAR** siempre | el beneficio de automatizarlo es casi nulo y el riesgo, enorme |
| **P2** | suspender o cambiar una clase con menos de 24 h | **PEDIR OK** a dirección | lo dice el protocolo del centro, que existía antes que el agente |
| **P3** | avisar a una socia mayor de 80 años | **PEDIR OK** + obligar a llamada telefónica | a esa edad un correo no se lee |
| **P1** | cualquier correo a más de 10 destinatarios | **PEDIR OK** a coordinación | es el umbral donde un error deja de ser una conversación |
| **P7** | cualquier acción entre las 22:00 y las 8:00 | **RETENER** hasta las 8:00 | de noche nadie supervisa, y una notificación asusta |
| **P6** | escribir en la Data Table de incidencias | **PERMITIR** y notificar | interno y reversible editando la fila |
| **P4** | responder con datos del RAG | **PERMITIR** si cita la fuente | la cita es lo único que permite detectar una alucinación |
| **P5** | consultar tiempo, noticias, RAG o grafo | **PERMITIR** sin límite | lectura pura |

---

## 4 · Las cuatro restricciones de acción

El nivel dice **si** puede. La restricción dice **hasta dónde**.

### De alcance
- Máximo **60 destinatarios** por envío.
- Sólo grupos definidos, nunca «todas las socias».
- Sólo el centro **Las Acacias**.

### De frecuencia
- Máximo **1 correo por socia y día**.
- Máximo **20 llamadas** a la API del tiempo al día.
- Máximo **3 avisos masivos** por semana.

### De contenido
- Prohibido dar consejo médico (`dosis`, `medicamento`, `diagnóstico`, `receta`…).
- Prohibido nombrar patologías en un correo grupal (RGPD: son datos de salud).
- Obligatorio citar la fuente en toda respuesta basada en el RAG.

### De momento
- Nada entre las **22:00 y las 8:00**.
- Cancelaciones sólo con **24 h** de antelación.
- Nada en festivo sin aprobación de dirección.

> Todas se comprueban con **datos de la intención**, nunca preguntándole al modelo. `destinatarios: 12` es un número que se puede comparar; «unas pocas socias» no lo es.

---

## 5 · El flujo de aprobación

```
NOTIFICACIÓN  →  REVISIÓN  →  RESOLUCIÓN
   ↓ falla si       ↓ falla si     ↓ falla si
el aviso se     aprueban sin    nadie previó
   pierde         leerlo         el silencio
```

### Estados de una petición

`PROPUESTA` → `PENDIENTE` → `APROBADA` / `RECHAZADA` / `EXPIRADA` / `ESCALADA` → `EJECUTADA` / `FALLIDA`

**Data Table `aprobaciones`:** `id_ejecucion · cuando · accion · destinatarios · aprobador · estado · decidido_en · motivo_rechazo`

### La respuesta al silencio

Hay que elegir una, escribirla y probarla:

1. **Expirar** — pasado el plazo no se hace nada y se avisa. Es lo correcto por defecto.
2. **Escalar** — a los 30 minutos va a otra persona. Para lo que no puede esperar.
3. **Alternativa segura** — si nadie aprueba el correo masivo, se genera la lista de llamadas para hacer a mano.

Lo que **nunca** es opción: ejecutar por defecto al expirar el plazo. Eso convierte el silencio en un sí.

### La tarjeta de aprobación

Responde seis preguntas, ni una menos:

1. **¿Qué?** — la acción en lenguaje humano
2. **¿A quién?** — el alcance exacto, con número
3. **¿Por qué?** — el motivo y la regla que lo justifica
4. **¿De dónde?** — las fuentes, para poder desconfiar
5. **¿Y si no hago nada?** — la consecuencia del silencio
6. **¿Qué va a decir?** — el texto literal, sin resumir

---

## 6 · Límites operativos

| Límite | Valor de partida | Dónde se pone |
|---|---|---|
| Iteraciones | máx. **8 pasos** | Max Iterations del AI Agent |
| Tiempo | máx. **90 s** | timeout del workflow |
| Llamadas | máx. **20 / herramienta / día** | contador en Data Table |
| Coste | máx. **0,50 € / ejecución** | tokens × precio, apuntado en el log |
| Alcance | máx. **60 destinatarios** | comprobado antes de enviar |

Cómo se eligen la primera vez: mides 20 ejecuciones normales, coges el peor caso y le sumas un 50 %. Luego se ajusta con datos. Un límite que salta todos los días está mal puesto; uno que no salta nunca, tampoco sirve.

---

## 7 · Mecanismos de contención

| Mecanismo | Qué es | Cuándo salva |
|---|---|---|
| **Interruptor general** | fila `activo = false` en la tabla `control`, leída por todos los flujos | apagas todo en 5 segundos |
| **Cortacircuitos** | a los 3 fallos consecutivos, el flujo se desactiva solo | evita que el error se repita 200 veces de madrugada |
| **Modo degradado** | si el LLM no responde, briefing con datos crudos | peor servicio es mejor que ningún servicio |
| **Cuarentena** | lo dudoso se aparca en una tabla para revisión | no pierdes información ni envías nada raro |
| **Vuelta atrás** | guardar el estado anterior antes de cada cambio interno | sirve para lo interno; para un correo enviado no existe |
| **Botón de pánico** | cualquiera del equipo puede parar y avisar | y todo el mundo sabe dónde está |

**Data Table `control`:** `clave · activo · fallos_consecutivos · apagado_en · apagado_por`

---

## 8 · El registro de auditoría

Una fila por **decisión**, incluidas las denegadas y las expiradas.

**Data Table `log_auditoria`:** `cuando · agente · accion · destinatarios · veredicto · estado_final · aprobador · motivo · fuente`

Tiene que poder responder, seis meses después:

1. ¿Quién autorizó este envío?
2. ¿Por qué el agente decidió que hacía falta (o no) aprobación?
3. ¿Qué habría pasado con otra política?

**Cuidado con el RGPD:** son datos de salud de personas mayores. En el log se guardan referencias (nombre del documento, hash del cuerpo), no el contenido. Y el registro tiene fecha de caducidad.

---

## 9 · Los workflows de estos tres días

| Fichero | Sesión | Qué monta |
|---|---|---|
| `M7-3.1_A_matriz_permisos.json` | 6 ago · práctica | agente que propone + matriz + evaluación + tres salidas |
| `M7-3.1_B_restricciones.json` | 6 ago · práctica | las cuatro restricciones, con un caso de prueba que falla a propósito |
| `M7-3.1_C_modo_simulacion.json` | 6 ago · práctica | el interruptor simulación/real y la tabla de revisión |
| `M7-3.2_D_hitl_wait.json` | 7 ago · práctica | HITL mínimo: tarjeta, Wait, aprobar / rechazar / expirar |
| `M7-3.2_E_hitl_yayafit_completo.json` | 7 ago · práctica | el caso completo en tres carriles, con auditoría y resumen |
| `M7-3.2_F_kill_switch.json` | 7 ago · práctica | interruptor general y cortacircuitos |

### Data Tables que hay que crear antes

`matriz_permisos` · `aprobaciones` · `log_auditoria` · `contador_envios` · `simulacion` · `control`

### Credenciales

OpenAI (el agente), SMTP (envío de tarjetas y avisos). El IMAP sólo hace falta si enganchas esto al agente del día 4.

---

## 10 · Lista de comprobación antes de producción

- [ ] ¿Está escrita la matriz de permisos, con aprobador con nombre y límite duro?
- [ ] ¿Lo irreversible pasa por una persona, y esa persona tiene suplente?
- [ ] ¿Hay límite de iteraciones, tiempo y coste, con números medidos?
- [ ] ¿Existe el interruptor general, y lo sabe usar alguien que no seas tú?
- [ ] ¿Se registra cada decisión, incluidas las denegadas?
- [ ] ¿Hay rama de error en cada llamada externa, y alguien recibe el aviso?
- [ ] ¿Se probó una semana en modo simulación, revisando las propuestas cada mañana?
- [ ] ¿Está escrito y probado qué pasa si nadie contesta?
- [ ] ¿El contenido entrante viaja como dato, no concatenado a las instrucciones?
- [ ] ¿Hay una persona con nombre que responde si sale mal?

Diez preguntas. Ninguna es del todo técnica, y ninguna se puede delegar en el modelo.
