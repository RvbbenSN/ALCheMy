/* GENERADO por scripts/generar_contenido_es.mjs. No editar a mano:
   se sobrescribe. Para corregir una frase, cambiarla en scripts/textos_es.json
   y volver a ejecutar el script. Lo que no este traducido sale en ingles. */

export const MODEL_HERO = {
  "lead": "Juega con las condiciones de síntesis y mira cómo se mueve la predicción; luego mira qué impide que esto sea un fichero pickle suelto en el portátil de alguien."
}

export const MODEL_LOOP = {
  "title": "Una brújula, no un oráculo",
  "metaphor": "Piensa en el espacio de síntesis como un mapa a oscuras. Los experimentos ya hechos iluminan unos pocos trozos. Un modelo predictivo no es una máquina que da la respuesta: es **una brújula**, y apunta hacia donde caminar iluminaría más terreno nuevo.",
  "method": "Y la dirección que señala no es \"donde hay más probabilidad de cristales\". Un experimento hecho donde el modelo ya está seguro confirma lo que ya sabía. El sitio útil es **donde duda**, porque allí cualquiera de los dos resultados lo corrige. Eso es lo que mide el mapa de abajo: la entropía de la distribución predicha, casilla a casilla.",
  "readingPoints": [
    "**La mayor parte del plano no se ha visitado nunca.** Incluso para el Ca, el metal con más historia detrás, las síntesis se amontonan en un puñado de casillas.",
    "**El modelo duda casi en todas partes**, incluso donde el laboratorio sí ha mirado.",
    "**Porque las condiciones se barrieron mientras la química cambiaba a la vez**, así que el registro no puede separar las dos cosas."
  ],
  "consequence": "El mapa y el diagnóstico del modelo señalan el mismo experimento desde extremos opuestos: la siguiente placa que merece la pena es **una que varíe las condiciones con finura manteniendo fijos el metal y el conector**."
}

export const MODEL_REGISTRY = {
  "title": "Un modelo no es un fichero",
  "lead": "La forma habitual de guardar un modelo entrenado es un `.pkl` en una carpeta, y falla de una manera concreta: seis meses después el fichero sigue ahí y **no sigue nada de lo que había alrededor**. Qué filas lo entrenaron, qué columnas, qué versión del código, qué puntuó de verdad.",
  "ruling": "Así que el modelo vive en la base de datos como **cinco tablas relacionadas**, y el binario es la menos importante. Las otras cuatro guardan la receta, y con una receta completa el binario se puede reconstruir.",
  "tables": [
    {
      "name": "ml_datasets",
      "head": "What it was trained on",
      "body": "El SQL literal que seleccionó las filas, más su SHA-256. Dos modelos que comparten consulta pero difieren en número de filas **no** se entrenaron sobre lo mismo, y el hash hace detectable esa diferencia."
    },
    {
      "name": "ml_models",
      "head": "The recipe",
      "body": "Algoritmo, hiperparámetros, semilla aleatoria, versiones de las librerías y el commit exacto de git. También el estado (activo, superado, archivado o **inválido**) y un `CHECK` que se niega a marcar un modelo como irreproducible sin escribir por qué."
    },
    {
      "name": "ml_model_features",
      "head": "Which columns went in, and which did not",
      "body": "Cada columna de entrada con su posición en el contrato, y cada una **excluida** con el motivo de la exclusión. `reactor_volume_ml` queda registrada como varianza cero, y `fill_fraction` como perfectamente colineal con ella."
    },
    {
      "name": "ml_model_metrics",
      "head": "What it scored",
      "body": "Métricas en formato largo, una fila por métrica, por clase y por partición, así que añadir una métrica nueva nunca obliga a alterar el esquema."
    },
    {
      "name": "ml_model_artifacts",
      "head": "The binary, and its fingerprint",
      "body": "El pipeline serializado con un SHA-256 que se comprueba en cada carga. Vive en su propia tabla para que una copia de seguridad ligera pueda saltárselo: es la única parte que una receta completa puede regenerar."
    }
  ],
  "slot": "Una cosa más decide qué modelo está ejecutando el simulador de verdad: una **ranura de despliegue**. El simulador no nombra un modelo; le pregunta a la base de datos cuál ocupa la ranura `primary`. Cuando en su lugar se escribió a mano el nombre de un modelo en este fichero, reentrenar para corregir un error de unidades de un factor de mil dejó **la web sirviendo el modelo superado sin que nada diera error**: un modelo obsoleto devuelve predicciones con la misma facilidad que uno vigente."
}
