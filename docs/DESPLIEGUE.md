# Publicar ALCheMy

Dos cosas distintas, y conviene no mezclarlas:

1. **El repositorio publico en GitHub** — el codigo, para que se vea como esta hecho.
2. **La web en Cloudflare Pages** — el sitio, para que se vea funcionando.

La web **no necesita** el repositorio publico para existir: se puede desplegar
subiendo la carpeta construida. Asi que si quieres la URL cuanto antes, empieza
por el punto 2 y deja el 1 para cuando te apetezca.

---

## Antes de nada: las dos comprobaciones

```bash
python scripts/verificar_proyecto.py      # ¿sigue todo en pie?
python scripts/comprobar_privacidad.py    # ¿se puede publicar?
```

El segundo tiene que decir **«Limpio: se puede publicar»**. Si dice otra cosa,
para y mira que ha encontrado: esta ahi justamente para eso.

---

## 1. El repositorio publico

El repositorio actual (`RvbbenSN/ALCheMy`) esta **en privado**, y su historial
contiene los nombres de ligando sin publicar y codigos de muestra reales de
antes de la limpieza. Quitarlos ahora no los borra del historial. Por eso:
**este repositorio se queda privado**, y se crea uno nuevo publico con el estado
actual y un solo commit.

```bash
# 1. Una copia limpia del arbol, sin .git
cd C:\Users\rubbe\Documents
git clone --depth 1 file:///C:/Users/rubbe/Documents/ALCheMy ALCheMy_public
cd ALCheMy_public
rmdir /s /q .git

# 2. Un repositorio nuevo con un solo commit
git init -b main
git add -A
git commit -m "ALCheMy: plataforma de datos para un laboratorio de MOFs"
```

Comprueba antes de empujar que no ha viajado nada privado:

```bash
git ls-files | findstr /i "_lab data/ .env"     # no debe devolver nada
```

Luego crea el repositorio en github.com (publico, **sin** README ni .gitignore
iniciales) y:

```bash
git remote add origin https://github.com/RvbbenSN/<nombre-nuevo>.git
git push -u origin main
```

> El repositorio privado sigue siendo el que trabajas. El publico se refresca
> repitiendo el `clone --depth 1` cuando quieras, o con un `git push` desde una
> segunda rama; no hace falta decidirlo hoy.

---

## 2. La web en Cloudflare Pages

La aplicacion se construye a `web/dist`, unos 20 MB. Es estatica: no necesita
servidor, ni base de datos, ni que tu ordenador este encendido.

### La forma rapida (sin repositorio, 5 minutos)

```bash
cd web
npm run build
```

1. Entra en **dash.cloudflare.com** → *Workers & Pages* → *Create* → *Pages* →
   **Upload assets**.
2. Ponle un nombre (`alchemy`, por ejemplo) y arrastra la carpeta `web/dist`
   **entera**.
3. Cloudflare te da una URL `https://alchemy-xxx.pages.dev` en menos de un minuto.

Para actualizarla: `npm run build` otra vez y subir `dist` de nuevo.

### La forma conectada (se despliega sola al hacer push)

Si has hecho el punto 1, en el mismo sitio elige **Connect to Git** en vez de
*Upload assets*, y configura:

| Campo | Valor |
|---|---|
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `web/dist` |
| Root directory | `web` |
| Node version (variable de entorno) | `NODE_VERSION` = `20` |

A partir de ahi, cada `git push` a `main` reconstruye y publica el sitio solo.

### Lo que ya esta resuelto

`web/public/_redirects` manda cualquier ruta a `index.html` con codigo 200.
Hace falta porque la aplicacion es una SPA: rutas como `/database` o
`/the-model` no existen como ficheros en el servidor, las resuelve el navegador.
Sin ese fichero, entrar directo a una de ellas —o recargar estando en ella—
devuelve un 404, **aunque navegar desde la portada funcione**. Es un fallo que
solo aparece al desplegar.

### Lo que la web NO lleva, y por que

- **El chat del RAG.** El agente responde a traves de n8n en tu ordenador.
  Exponerlo pide o dejar la maquina encendida y accesible, o mover los modelos a
  un endpoint de pago. La pantalla 07 lo dice.
- **La ingesta.** Se descarto a proposito: un webhook publico que escribe en la
  base es una superficie de ataque que este proyecto no necesita.
- **El modelo en vivo.** Este si es viable —el binario son 5,6 MB y el trafico
  seria minimo—, pero es una decision aparte. Hoy la pantalla 06 sirve una
  rejilla de predicciones calculada de antemano, que responde igual de rapido y
  no necesita servidor.

---

## Si algo sale mal

| Sintoma | Que mirar |
|---|---|
| La web carga en blanco | La consola del navegador. Casi siempre es un icono o un import que no existe. |
| Una ruta da 404 al entrar directo | Falta `_redirects` en `dist`. Comprueba que `web/public/_redirects` existe y vuelve a construir. |
| Las figuras no aparecen | Se sirven de `/figures/`. Comprueba que `web/public/figures/` viajo en el `dist`. |
| Docker no levanta tras mover algo | `python scripts/verificar_proyecto.py` dice cual de las cuatro rutas montadas falta. |
