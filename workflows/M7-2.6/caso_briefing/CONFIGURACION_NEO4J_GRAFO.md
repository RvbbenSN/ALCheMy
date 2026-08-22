# Configuración de Neo4j para el RAG de grafos

**Módulo 7 · caso YayaFit** — GraphRAG con grafo visible.

> **¿Por qué Neo4j?** Porque trae **Neo4j Browser**, que dibuja el grafo. Para una clase, poder *ver* los nodos y las flechas vale más que cualquier explicación.

---

## 1 · Montar la base de datos (elige una opción)

### Opción A · Neo4j Aura Free (recomendada, sin instalar nada)

1. Entra en <https://neo4j.com/cloud/aura/> → **Start free**.
2. Crea una instancia **AuraDB Free**.
3. Al crearla te muestra **una sola vez** la contraseña y te descarga un fichero con las credenciales. **Guárdalo.**
4. Apunta:
   - **URI de conexión**: `neo4j+s://xxxxxxx.databases.neo4j.io`
   - **Usuario**: `neo4j`
   - **Contraseña**: la generada
5. La URL para la **Query API** (la que usan los workflows) es:
   ```
   https://xxxxxxx.databases.neo4j.io/db/neo4j/query/v2
   ```
   (el mismo host, pero con `https://` y esa ruta)

### Opción B · Local con Docker

```bash
docker run -d --name neo4j-master \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/master1234 \
  neo4j:latest
```

- **Browser**: <http://localhost:7474>
- **Query API**: `http://localhost:7474/db/neo4j/query/v2`
- Usuario `neo4j`, contraseña `master1234`

---

## 2 · Credencial en n8n

Los workflows llaman a Neo4j por HTTP, así que basta con autenticación básica:

1. **Credentials → New → Basic Auth** (Header/Generic).
2. **User**: `neo4j` · **Password**: la tuya.
3. En los nodos `HTTP Request` de los workflows **D**, **E** y **F**, esa credencial ya está seleccionada como *Generic Credential Type → Basic Auth*.

También hay que **sustituir la URL**: en los workflows aparece

```
https://TU-INSTANCIA.databases.neo4j.io/db/neo4j/query/v2
```

Cámbiala por la tuya (Aura o `localhost`).

---

## 3 · El modelo de datos del caso

Modelo deliberadamente simple, para que el LLM pueda escribir Cypher sin equivocarse:

```
(:Entidad {nombre, tipo})  -[:REL {tipo}]->  (:Entidad {nombre, tipo})
```

**Tipos de entidad:** `Socia`, `Clase`, `Instalacion`, `Riesgo`, `Protocolo`, `Incidencia`
**Tipos de relación:** `ASISTE_A`, `AL_AIRE_LIBRE`, `AFECTA_A`, `CEDE`, `APLICA_A`

> Con una sola etiqueta (`:Entidad`) y una sola relación (`:REL`) el grafo es más fácil de generar automáticamente. En un proyecto real usarías etiquetas específicas (`:Socia`, `:Clase`…).

---

## 4 · Cargar el grafo del caso

### Automático (workflow D)

Ejecuta `M7-2.6_D_ingesta_grafo_neo4j.json`: un LLM extrae entidades y relaciones del texto del caso y las escribe con `MERGE` (puedes repetirlo sin duplicar).

### Manual (por si falla en directo — pégalo en Neo4j Browser)

```cypher
CREATE CONSTRAINT ent_nombre IF NOT EXISTS
FOR (e:Entidad) REQUIRE e.nombre IS UNIQUE;

// Entidades
MERGE (calor:Entidad {nombre:'calor'})                SET calor.tipo='Riesgo'
MERGE (aqua:Entidad {nombre:'Aquagym'})               SET aqua.tipo='Clase'
MERGE (paseo:Entidad {nombre:'Paseo saludable'})      SET paseo.tipo='Clase'
MERGE (gim:Entidad {nombre:'Gimnasia suave'})         SET gim.tipo='Clase'
MERGE (pil:Entidad {nombre:'Pilates para mayores'})   SET pil.tipo='Clase'
MERGE (fue:Entidad {nombre:'Fuerza y equilibrio'})    SET fue.tipo='Clase'
MERGE (pis:Entidad {nombre:'Piscina El Pinar'})       SET pis.tipo='Instalacion'
MERGE (prot:Entidad {nombre:'Protocolo de calor'})    SET prot.tipo='Protocolo'
MERGE (carmen:Entidad {nombre:'Carmen Ruiz'})         SET carmen.tipo='Socia', carmen.edad=84
MERGE (pilar:Entidad {nombre:'Pilar Ibanez'})         SET pilar.tipo='Socia',  pilar.edad=78
MERGE (jose:Entidad {nombre:'Josefa Moreno'})         SET jose.tipo='Socia',   jose.edad=81
MERGE (anto:Entidad {nombre:'Antonio Gil'})           SET anto.tipo='Socia',   anto.edad=76
MERGE (reme:Entidad {nombre:'Remedios Vega'})         SET reme.tipo='Socia',   reme.edad=88
MERGE (inc:Entidad {nombre:'Mareo por calor 07/2025'}) SET inc.tipo='Incidencia'

// Relaciones
MERGE (aqua)-[:REL {tipo:'AL_AIRE_LIBRE'}]->(calor)
MERGE (paseo)-[:REL {tipo:'AL_AIRE_LIBRE'}]->(calor)
MERGE (calor)-[:REL {tipo:'AFECTA_A'}]->(aqua)
MERGE (calor)-[:REL {tipo:'AFECTA_A'}]->(paseo)
MERGE (carmen)-[:REL {tipo:'ASISTE_A'}]->(aqua)
MERGE (carmen)-[:REL {tipo:'ASISTE_A'}]->(gim)
MERGE (pilar)-[:REL {tipo:'ASISTE_A'}]->(aqua)
MERGE (pilar)-[:REL {tipo:'ASISTE_A'}]->(paseo)
MERGE (jose)-[:REL {tipo:'ASISTE_A'}]->(paseo)
MERGE (anto)-[:REL {tipo:'ASISTE_A'}]->(pil)
MERGE (anto)-[:REL {tipo:'ASISTE_A'}]->(fue)
MERGE (reme)-[:REL {tipo:'ASISTE_A'}]->(gim)
MERGE (pis)-[:REL {tipo:'CEDE'}]->(aqua)
MERGE (prot)-[:REL {tipo:'APLICA_A'}]->(aqua)
MERGE (prot)-[:REL {tipo:'APLICA_A'}]->(paseo)
MERGE (inc)-[:REL {tipo:'AFECTA_A'}]->(carmen);
```

---

## 5 · VER el grafo (el momento visual de la clase)

En **Neo4j Browser**:

```cypher
MATCH (n)-[r]->(m) RETURN n, r, m
```

Verás el grafo dibujado. Consejos para que luzca:

- Haz clic en la etiqueta **Entidad** (arriba) y elige mostrar la propiedad `nombre` como *caption*.
- Puedes colorear por tipo y arrastrar los nodos para colocarlos.
- Aísla el hilo del caso:
  ```cypher
  MATCH path = (s:Entidad)-[:REL*1..2]-(r:Entidad {nombre:'calor'})
  WHERE s.tipo='Socia'
  RETURN path
  ```
  → se dibuja el camino **socia → clase → calor**.

---

## 6 · Las consultas del caso

```cypher
// ¿A qué socias afecta el calor? (la pregunta estrella)
MATCH (r:Entidad {nombre:'calor'})-[:REL {tipo:'AFECTA_A'}]->(cl)<-[:REL {tipo:'ASISTE_A'}]-(s)
WHERE s.tipo = 'Socia'
RETURN DISTINCT s.nombre AS socia, s.edad AS edad, collect(cl.nombre) AS clases;

// ¿Qué socias NO se ven afectadas? (solo clases de interior)
MATCH (s:Entidad) WHERE s.tipo='Socia'
  AND NOT (s)-[:REL {tipo:'ASISTE_A'}]->()<-[:REL {tipo:'AFECTA_A'}]-(:Entidad {nombre:'calor'})
RETURN s.nombre;

// ¿De quién dependemos para el aquagym? (proveedor único)
MATCH (i)-[:REL {tipo:'CEDE'}]->(:Entidad {nombre:'Aquagym'}) RETURN i.nombre;

// Todo lo que rodea a una socia
MATCH (s:Entidad {nombre:'Carmen Ruiz'})-[r]-(v) RETURN s, r, v;
```

## 7 · Vector RAG vs GraphRAG (para explicarlo en clase)

| | **Vector (Pinecone)** | **Grafo (Neo4j)** |
|---|---|---|
| Guarda | trozos de texto | entidades y relaciones |
| Busca por | parecido semántico | recorrido de relaciones |
| Brilla en | «¿qué dice el protocolo sobre X?» | «¿a qué socias afecta X?» |
| Flojea en | preguntas de varios saltos | texto libre y matices |
| La cita es | el documento de origen | **el camino recorrido** |
| Prepararlo | trocear + embeddings | extraer entidades y relaciones |

**Lo mejor: los dos juntos.** El vector responde «qué dice»; el grafo responde «a quién afecta». En el workflow **F** cada uno es un especialista distinto del sistema multi-agente.

---

## 8 · Seguridad

- La herramienta `consultar_grafo` **dice** en su descripción que es de solo lectura… pero eso no es una garantía.
- En producción: crea en Neo4j un **usuario con rol de solo lectura** y usa esa credencial en n8n.
- Nunca expongas la Query API a internet sin autenticación.

---

## 9 · Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `401 Unauthorized` | credencial mal puesta | revisa usuario/contraseña en la Basic Auth |
| `404` en la URL | ruta incorrecta | debe acabar en `/db/neo4j/query/v2` |
| El grafo sale vacío | el workflow D no escribió | ejecuta el Cypher manual del punto 4 |
| Nodos duplicados | usaste `CREATE` en vez de `MERGE` | borra todo (`MATCH (n) DETACH DELETE n`) y repite |
| El agente escribe Cypher inválido | el modelo no conoce tu esquema | está en el System Message: revisa que incluya etiquetas y ejemplos |
