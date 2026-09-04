# Publishing ALCheMy

Two separate things, and they are worth not confusing:

1. **The public GitHub repository** — the code, so the work can be read.
2. **The site on Cloudflare** — the application, so it can be used.

The site **does not need** the public repository to exist: it can be deployed by
uploading the built folder. So if you want the URL sooner, start at step 2 and
leave step 1 for whenever.

---

## First: the two checks

```bash
python scripts/verificar_proyecto.py      # does the project still stand?
python scripts/comprobar_privacidad.py    # is it safe to publish?
```

The second must say **"Limpio: se puede publicar"**. If it says anything else,
stop and read what it found — that is exactly what it is there for.

---

## 1. The public repository

The current repository is **private**, and its history contains unpublished
ligand names and real sample codes from before the cleanup. Removing them now
does not remove them from the history. So: **this repository stays private**, and
a new public one is created holding the current state as a single commit.

```bash
# A clean copy of the tree, with no .git
cd C:\Users\rubbe\Documents
git clone --depth 1 file:///C:/Users/rubbe/Documents/ALCheMy ALCheMy_public
cd ALCheMy_public
rmdir /s /q .git

# A new repository with one commit
git init -b main
git add -A
git commit -m "ALCheMy: a governed data platform for a materials chemistry laboratory"
```

Check that nothing private travelled, before pushing:

```bash
git ls-files | findstr /i "_lab data/ .env"     # must return nothing
```

Then create the repository on github.com — public, **without** an initial README
or .gitignore — and:

```bash
git remote add origin https://github.com/RvbbenSN/<new-name>.git
git push -u origin main
```

> The private repository remains the one you work in. The public one is refreshed
> by repeating the `clone --depth 1`, whenever you want. That does not have to be
> decided today.

---

## 2. The site on Cloudflare

The application builds to `web/dist`, around 20 MB. It is static: no server, no
database, and no need for your machine to be switched on.

### The quick way — no repository, five minutes

```bash
cd web
npm run build
```

1. Go to **dash.cloudflare.com** → *Workers & Pages* → *Create* → *Pages* →
   **Upload assets**.
2. Give it a name (`alchemy`, say) and drag the **whole** `web/dist` folder in.
3. Cloudflare hands you a `https://alchemy-xxx.pages.dev` URL in under a minute.

To update it: `npm run build` again and upload `dist` again.

### The connected way — deploys itself on every push

Choose **Connect to Git** instead of *Upload assets*. Cloudflare has merged Pages
into Workers, and for a new project it now offers the **Workers** flow, which
deploys by running `npx wrangler deploy` rather than by being told where the
build output is. That is why `web/wrangler.jsonc` exists: it tells wrangler what
to publish. Without it the deploy step fails.

| Field | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (the default) |
| Root directory (*Advanced settings*) | `web` |

No environment variables are needed. Cloudflare's build image already provides
Node 24 and npm 10, which Vite 7 accepts — verified in a real build log, not
assumed. Set `NODE_VERSION` only if a future build reports a version too old.

From then on, every push to `main` rebuilds and republishes the site.

If the dashboard still offers the older **Pages** flow, it also works — set the
build output directory to `dist` with the same root directory. Both paths read
`_headers`; the routing fallback, however, is written differently in each (see
below), and only the Workers path reads `wrangler.jsonc`.

### Two things already handled

**The routing fallback**, declared in `wrangler.jsonc` as
`assets.not_found_handling: "single-page-application"`. It is needed because the
application is a single-page app: routes like `/database` or `/the-model` do not
exist as files on the server — the browser resolves them. Without it, opening one
directly, or reloading while on it, returns a 404 **even though navigating there
from the home page works**. It is a fault that only appears once deployed.

> On the Pages path the same fallback is a `/*  /index.html  200` rule in a
> `public/_redirects` file. **That rule breaks the Workers path**: the deploy is
> rejected with `Infinite loop detected in this rule [code: 100324]`, because
> Cloudflare sees a rule that could forward to itself. It fails late and
> confusingly — the build compiles, every asset uploads, and the error lands on
> the very last step. The file was therefore removed. If this project ever goes
> back to Pages, it has to be recreated.

`web/public/_headers` carries the security headers. Cloudflare provides HTTPS and
DDoS protection on its own; what it does not provide is the content policy that
would stop an injected script from running. The CSP authorises the one inline
script in `index.html` — the theme-flash guard — **by its hash** rather than
allowing inline scripts in general. Edit that script and the hash must be
recomputed; the command is in a comment inside `_headers`, and the symptom of
forgetting is mild and visible (a flash of the light theme on reload).

`web/wrangler.jsonc` carries no server code on purpose. The site is fully static,
so it deploys as assets alone — fewer moving parts, and nothing that can break in
production.

### What the site does not carry, and why

- **The RAG chat.** The assistant answers through n8n on the project machine.
  Exposing it means either leaving that machine on and reachable, or moving the
  models to a paid endpoint. Screen 07 says so.
- **The ingestion.** Deliberately not exposed: a public webhook that writes to the
  database is an attack surface this project does not need.
- **The live model.** This one *is* feasible — the binary is 5.6 MB and traffic
  would be minimal — but it is a separate decision. Today screen 06 serves a
  precomputed grid of predictions, which answers just as fast and needs no server.

---

## If something goes wrong

| Symptom | Where to look |
|---|---|
| The site loads blank | The browser console. Almost always an icon or an import that does not exist. |
| A route 404s when opened directly | The routing fallback is not applying. Check `assets.not_found_handling` in `web/wrangler.jsonc`. |
| Deploy fails with `code: 100324` | A `_redirects` file has come back with a `/*  /index.html  200` rule. On the Workers path that rule is rejected; the fallback belongs in `wrangler.jsonc`. |
| Figures do not appear | They are served from `/figures/`. Check `web/public/figures/` made it into `dist`. |
| Docker will not start after moving something | `python scripts/verificar_proyecto.py` names which of the four mounted paths is missing. |
