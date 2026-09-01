# Conceptos clave del proyecto

Notas para acordarse. Cada entrada explica **una** idea, en lenguaje llano, con el porqué
detrás. Son también el material del que saldrán los tooltips de la aplicación.

---

## 1. De dónde sale el porcentaje: un clasificador no devuelve una etiqueta

Cuando el simulador dice **57 % cristalino**, ese número no es una cuarta cosa aparte de las
tres clases. Es una de ellas.

Un clasificador **no devuelve "cristalino"**. Devuelve **tres números que suman 1**, uno por
clase:

```
amorfo      0.12
incipiente  0.31
cristalino  0.57   ← el mayor
```

La etiqueta es, literalmente, *el nombre del número más alto*. En el cuaderno 06 esto se pide
con `predict_proba`, que es la función que devuelve los tres en vez de solo el ganador.

### Por qué los tres números importan más que la etiqueta

| Predicción | Etiqueta | Qué dice de verdad |
|---|---|---|
| 0.05 / 0.10 / **0.85** | cristalino | El modelo está seguro |
| 0.30 / 0.33 / **0.37** | cristalino | El modelo está adivinando |

Las dos filas dan la misma etiqueta. La segunda es una moneda al aire.

**Y ahí está el active learning.** Las síntesis que merece la pena hacer mañana son las del
segundo tipo, donde dos barras están pegadas: son las que más información aportan cuando se
miden. Con solo la etiqueta serían indistinguibles de las seguras.

> ⚠️ **No confundir dos porcentajes distintos que aparecen en la web.** El del simulador es una
> probabilidad del modelo. El **11,0 % / 79,8 % / 95,7 %** de la tabla del EDA es un
> **recuento**: de todas las síntesis HTS que se hicieron, el 11 % salieron cristalinas. Ahí no
> interviene ningún modelo, es contar.

---

## 2. Rejilla congelada frente a modelo activo

El simulador de la web da predicciones del modelo real **sin servidor y sin descargar el
modelo**. Lo hace congelando: se calcula de antemano la respuesta para cada combinación que el
usuario puede elegir, y la web se limita a buscar en esa tabla
(`scripts/build_simulator_grid.py`).

### Lo que se gana

- **Predicciones reales sin backend.** Nada que mantener encendido, nada que pueda caerse.
- **Nadie puede sondear el modelo.** Sin un endpoint al que preguntar, no hay forma de hacerle
  miles de consultas para reconstruir la química que aprendió. Esto resuelve por sí solo la
  preocupación de proteger la propiedad intelectual.

### Lo que se pierde

- **La rejilla cuantiza.** El usuario elige entre los pasos precalculados, no una temperatura
  cualquiera. Con los cinco controles a resolución fina saldrían decenas de millones de
  combinaciones: por eso los pasos son gruesos a propósito.

### Lo que la rejilla NO sustituye

Y esto es lo importante: **el modelo activo no está para la web, está para el laboratorio.**

| | Rejilla congelada | Modelo activo |
|---|---|---|
| Temperatura arbitraria | No, solo los pasos | Sí |
| Química nueva (metal o ligando que no estaba) | No existe en la rejilla | Sí |
| 24 condiciones para la próxima placa | Se podría precalcular una lista | Sí, con lo medido **esta semana** |
| Registrar la predicción y compararla con el resultado real | No | Sí — es el bucle de active learning |

La web es **una demostración del sistema**, no el sistema. El producto real es pedir condiciones,
sintetizarlas, y que el resultado entrene la siguiente versión. Eso depende de datos que
todavía no existen, así que por definición no se puede congelar.

### La tercera opción, y por qué se descartó

Se puede exportar el modelo a formato ONNX y **ejecutarlo dentro del navegador**: modelo real,
entradas continuas, sin servidor. Se descartó porque implica **servir el fichero del modelo**,
que cualquiera podría descargar. Contradice la regla del proyecto de que los `.joblib` no salen
del servidor.

### Una decisión de honestidad en la rejilla

Los ejes **no salen del rango observado** en el laboratorio: temperatura 25–160 °C, ratio L/M
0,1–1,0, que son los límites reales del histórico. Dejar pedir 200 °C sería invitar al modelo a
extrapolar y presentar el resultado como si valiera lo mismo que una interpolación.

Y cada metal parte de **su propia síntesis mediana**: lo que no se expone (ligando, disolventes,
volúmenes) se fija en la mediana de las síntesis reales de ese metal, no en una media global.
Así cada punto de la rejilla es una receta plausible y no una mezcla imposible.

---

## 3. Cómo de bueno es el modelo, sin adornos

Conviene tenerlo escrito, porque es fácil recordar el número bonito y olvidar el matiz.

### Los números

| | F1 macro | MCC | Referencia |
|---|---|---|---|
| Clasificador trivial | 0,26 | 0,00 | El listón |
| **Modelo completo** | **0,522** | **0,31** | El doble que el listón |
| **Modelo accionable** | **0,413** | **0,13** | Apenas por encima del azar |

Y la matriz de confusión, por clase: acierta el **71 %** de los incipientes, el **50 %** de los
amorfos y el **50 %** de los cristalinos.

### La lectura crítica

**1. Es un modelo débil, y conviene decirlo.** Un MCC de 0,31 es una asociación real pero
modesta. Sobre todo: **se le escapa la mitad de los cristalinos**, que son justo lo que a un
cribado le interesa encontrar. Para la tarea que importa, acierta como una moneda.

**2. El modelo accionable está prácticamente en el azar.** Con MCC 0,13, el modelo que responde
*«dada esta química, qué condiciones la hacen cristalizar»* —que es la pregunta que de verdad
sirve en el laboratorio— **todavía no sabe responder**. Ese es el titular honesto.

**3. La causa no es el algoritmo, es el diseño experimental.** El histórico tiene ~13
temperaturas y ~9 tiempos en cinco años, y además variados *de forma confundida* con la química:
cada campaña barría una cosa para un sistema. El modelo no puede aprender el efecto de una
variable que apenas se movió.

**4. Ajustar hiperparámetros no lo va a arreglar.** Es realista esperar entre +0,02 y +0,05 de
F1. La distancia entre 0,52 y algo útil no está en los hiperparámetros; está en los datos.
Merece la pena saberlo antes de dedicarle una sesión.

### Qué sí movería la aguja, por orden

1. **Más ejemplos cristalinos.** 167 casos es la restricción que ata todo lo demás.
2. **Un barrido diseñado**: temperatura × tiempo × modulador, fino, **dentro de un solo sistema
   metal-ligando**. Ataca directamente el problema de la variación insuficiente y son una o dos
   placas. Es, con diferencia, lo más rentable.
3. **Completar el desglose de disolvente** del 18 % de filas que no lo tienen: ese bloque
   entero puntúa hoy como ruido.
4. **Revisar el objetivo**: con más datos, el índice de cristalinidad como variable continua
   podría dar más que tres clases.

### Y por qué esto no es un fracaso del proyecto

Lo valioso aquí no es el 0,52: es **saber por qué es 0,52**, y haberlo medido. El proyecto
detectó y corrigió siete defectos de datos, descubrió que la versión anterior puntuaba más alto
porque detectaba el *método de síntesis* en vez de la química, y midió que las condiciones no se
habían variado lo suficiente. Eso último convierte un resultado negativo en **una instrucción
experimental concreta**.

> Un 0,52 que sabe explicarse vale más que un 0,85 que nadie puede auditar. Y «seguir
> alimentando el modelo» funciona, pero **importa más qué se le da que cuánto**: más de lo mismo
> —las mismas 13 temperaturas— apenas cambiará nada; un barrido diseñado, sí.
