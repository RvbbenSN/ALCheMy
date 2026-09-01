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

## 3. Valoración del rendimiento del modelo

Conviene tenerlo escrito con precisión, porque es fácil retener la cifra agregada y perder el
matiz que la califica.

### Las cifras

Todas proceden de la validación cruzada agrupada por placa del cuaderno 06. No son cifras de
entrenamiento.

| | F1 macro | MCC | Exactitud equilibrada |
|---|---|---|---|
| Clasificador trivial | 0,26 | 0,00 | 0,33 |
| **Modelo completo** | **0,522** | **0,31** | **0,57** |
| **Modelo accionable** | **0,413** | **0,13** | — |

Sensibilidad por clase: **71 %** en incipiente, **50 %** en amorfo, **50 %** en cristalino.
Conjunto de entrenamiento: 1.516 síntesis en 68 placas, de las cuales 167 cristalinas.

### Lectura

**El modelo completo duplica holgadamente la línea base** y alcanza un MCC de 0,31: una
asociación real, de magnitud moderada. Dos aspectos de este resultado conviene enunciarlos de
forma explícita en lugar de dejarlos a la inferencia del lector.

**1. La sensibilidad sobre la clase cristalina es de 0,50.** Dado que la finalidad de la
herramienta es preseleccionar condiciones prometedoras, esta es la cifra que gobierna su
utilidad práctica, y constituye una limitación relevante. Es también la consecuencia esperable
de una clase con 167 ejemplos frente a 967 incipientes, y de ser además la más heterogénea:
existen muchas maneras de cristalizar y una sola de no hacerlo.

**2. El modelo accionable se sitúa cerca del límite que los datos permiten.** Restringido a
variables de proceso —el que responde *«dada esta química, qué condiciones favorecen la
cristalización»*— el MCC desciende a 0,13. Está por encima del azar y todavía no constituye una
base para recomendar condiciones. Puesto que es la pregunta que formula el laboratorio, es el
más relevante de los dos resultados.

### El límite reside en el registro experimental, no en el modelo

A lo largo de cinco años el histórico contiene aproximadamente **trece temperaturas objetivo
distintas y nueve tiempos de reacción**, variados además de forma confundida con la química:
cada campaña barría un factor dentro de un sistema metal-ligando. Un modelo supervisado no puede
estimar el efecto de una variable que se mantuvo casi constante, ni separar un efecto de un
factor con el que siempre coincidió.

Es una propiedad de los datos. Ninguna elección de algoritmo o de hiperparámetros recupera
información que los experimentos no generaron.

> **Expectativa realista sobre la optimización de hiperparámetros:** una mejora de entre 0,02 y
> 0,05 en F1 macro. Merece hacerse por completitud metodológica; no es una vía hacia un modelo
> materialmente mejor.

### Qué mejoraría el resultado, por retorno esperado

1. **Un barrido diseñado** de temperatura, tiempo y modulador a resolución fina **dentro de un
   único sistema metal-ligando**. Ataca directamente el confundido y equivale a una o dos placas
   de alto rendimiento: con diferencia, la intervención más eficiente disponible.
2. **Más ejemplos cristalinos.** Con 167 en el conjunto de entrenamiento, la clase minoritaria
   es la restricción que limita todas las métricas anteriores.
3. **Completar el desglose de disolvente** del 18 % de registros que carecen de él. Ese bloque
   puntúa hoy como ruido bajo importancia por permutación, y su contribución real no podrá
   evaluarse hasta que el medio esté registrado por completo.
4. **Revisar la variable objetivo** cuando haya más datos. Un índice de cristalinidad continuo
   podría portar más información que tres clases, si bien las tres clases siguen siendo el
   juicio que el laboratorio registró efectivamente.

### Sobre el valor de este resultado

El mérito de esta etapa no descansa en la magnitud de la puntuación, sino en que la puntuación
sea defendible: validada con las placas como grupos, calculada tras corregir siete defectos de
datos, y reportada junto a la línea base que le da sentido.

Una versión anterior de este análisis reportaba una cifra superior que se demostró después que
reflejaba el método de síntesis antes que la química. Establecer que la limitación actual es de
diseño experimental convierte un resultado negativo en un experimento concreto y accionable.

> Alimentar el modelo con más datos mejora el resultado, pero **importa más la naturaleza de los
> datos que su volumen**: repetir el mismo espacio de condiciones aportará poco; un barrido
> diseñado, bastante.
