# LEIA Designer frontend

Aplicación React, TypeScript y Vite. El build genera `dist/`, que se puede
publicar en Cloudflare Workers con Static Assets o en Cloudflare Pages.
Los servicios de API y autenticación se despliegan por separado.

## Desarrollo

Requiere Node.js 22 o posterior. `.nvmrc` selecciona Node.js 22.

```sh
nvm use
npm ci
cp .env.example .env
npm run dev
```

## Configuración de producción

Para un build local, copiar `.env.production.example` a `.env.production.local`
y sustituir los dominios de ejemplo por los reales. En Cloudflare, definir estas
mismas variables en la configuración del **build**, tanto para producción como
para los previews que se vayan a utilizar.

| Variable | Valor |
| --- | --- |
| `VITE_APP_BACKEND` | URL HTTPS de la API de Designer, sin barra final. |
| `VITE_AUTH_SERVICE_BACKEND` | URL HTTPS del servicio de autenticación, sin barra final. |
| `VITE_WORKBENCH_URL` | URL HTTPS del frontend Workbench. |
| `VITE_TURNSTILE_ENABLED` | `true`, o `false` si también está desactivado en el backend. |
| `VITE_CLOUDFLARE_SITE_KEY` | Clave pública de Turnstile para el dominio desplegado. |

Vite incorpora `VITE_*` al JavaScript público durante la compilación. Cambiar
estas variables requiere otro build y despliegue; configurarlas solo como
variables de ejecución del Worker no cambia el frontend. Las claves privadas y
la clave secreta de Turnstile pertenecen a los backends.

Autorizar el origen HTTPS del frontend en el CORS de las APIs y el dominio en
Turnstile. Para Workbench, permitir también ese origen en el servidor Socket.IO.

## Llamadas API al dominio del frontend

Si una petición como `/api/v1/apikeys` sale hacia el dominio del frontend,
comprobar `VITE_AUTH_SERVICE_BACKEND` en las variables del **build**. Esa ruta
pertenece al servicio de autenticación; `VITE_APP_BACKEND` apunta a la API de
esta aplicación. Ambas deben contener URLs absolutas, con `https://`.
Guardar las variables en Cloudflare y ejecutar un nuevo build y despliegue.

Los builds de Workers y Pages fallan si faltan URLs requeridas o si no son
URLs HTTP(S), o si Turnstile está habilitado sin clave pública. Así se evita
publicar un frontend que use por error rutas relativas para llamar a la API.

## Turnstile sin clave en el frontend

Si aparece `Invalid or missing type for parameter "sitekey"`, añadir
`VITE_CLOUDFLARE_SITE_KEY` en **Settings > Build > Build Variables and Secrets**
y volver a compilar y desplegar. Usar la clave pública del widget de Turnstile
que corresponde al backend, con el dominio del frontend autorizado. Configurarla
solo en **Variables & Secrets** del Worker o en `vars` de Wrangler no la incorpora
al JavaScript de Vite.

Cuando Turnstile está habilitado y falta la clave pública, el formulario muestra
un aviso y mantiene el acceso pendiente de verificación.

## Cloudflare Workers

`wrangler.workers.jsonc` publica `dist/` como Static Assets y activa el fallback de SPA
para que las rutas de React Router funcionen al abrirlas directamente o recargar.

```sh
npx wrangler login
npm run deploy:workers
```

`npm run deploy` es un alias de `deploy:workers`. El nombre del Worker es
`leia-designer-frontend`; se puede cambiar en `wrangler.workers.jsonc`.
Para comprobar el build con el runtime local de Cloudflare:

```sh
npm run preview:workers
```

Para conectar el repositorio a **Workers Builds**:

| Ajuste | Valor |
| --- | --- |
| Rama de producción | `main` |
| Directorio raíz | Raíz de este repositorio |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --config wrangler.workers.jsonc` |
| Node.js | `NODE_VERSION=22` |

Añadir las variables `VITE_*` del apartado anterior a las variables del build.
El nombre del proyecto de Workers debe coincidir con `name` en `wrangler.workers.jsonc`.

## Cloudflare Pages

En Pages, conectar este repositorio con estos ajustes:

| Ajuste | Valor |
| --- | --- |
| Rama de producción | `main` |
| Directorio raíz | Raíz de este repositorio |
| Framework preset | React (Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `NODE_VERSION=22` |

Añadir las variables `VITE_*` en el entorno de compilación. Pages sirve la SPA
automáticamente porque `dist/` contiene `index.html` y no tiene `404.html`.
Pages utiliza `wrangler.jsonc`; los comandos de Workers seleccionan explícitamente
`wrangler.workers.jsonc`, para mantener ambas opciones independientes.

Para publicar desde terminal, crear el proyecto una sola vez (omitir la creación
si ya existe) y desplegar:

```sh
npx wrangler login
npx wrangler pages project create leia-designer-frontend --production-branch main
npm run deploy:pages
```

Si el proyecto ya existe con otro nombre, actualizar `name` en
`wrangler.jsonc`. Para probar Pages localmente:

```sh
npm run preview:pages
```

## Validación

```sh
npm run build
npx wrangler deploy --config wrangler.workers.jsonc --dry-run
```

Los comandos de despliegue compilan antes de publicar. Para CI se pueden usar
`CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en lugar del login interactivo.
`npm start` mantiene el servidor Express para otros entornos; Cloudflare sirve
los archivos de `dist/` directamente.

Referencias: [Workers SPA](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/),
[build de Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/) y
[rutas SPA de Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).

## Pre y previews de pull requests

La rama `main` mantiene el despliegue público de producción. Las ramas de
prepublicación se sirven como Worker Previews del mismo Worker:

| Fuente | URL |
| --- | --- |
| `develop` | `https://pre.designer.leia.ovh` |
| PR abierta hacia `develop`, por ejemplo #123 | `https://pre-123.designer.leia.ovh` |
| Rama sin PR abierta | URL `branch-...` con un sufijo estable |

En Cloudflare, activar **Builds for Preview branches** en **Settings > Builds >
Previews Base** y configurar:

| Ajuste | Valor |
| --- | --- |
| Build command de previews | `npm run build:pre` |
| Preview command | `npm run deploy:preview` |
| Root directory | `/` |
| Variables del build de previews | Las de Heroku `pre`, en este mismo panel |

Las variables de previews son independientes de las variables del build de
producción. Para un build local, copiar `.env.pre.example` a `.env.pre.local`
y completar los valores. No añadir las variables Vite al bloque `vars` de Wrangler.

En **Domains**, habilitar el dominio `designer.leia.ovh` para **Production and
Preview**. Cloudflare usa `*.designer.leia.ovh` para los previews. El registro
existente de `pre.designer.leia.ovh` debe migrarse de Heroku a esta ruta una vez
validado el preview `pre`; los registros específicos de los backends se conservan.
Cloudflare gestiona el DNS y el certificado de los dominios de preview.

El comando de previews obtiene el número de PR mediante la API pública de
GitHub, sin tokens adicionales. Detiene el despliegue si GitHub no responde o
si hay una asociación ambigua. `develop` siempre usa el nombre `pre` y `main`
se rechaza explícitamente. Cloudflare Builds publica el enlace en las PR.

Todos los previews de Designer usan `VITE_WORKBENCH_URL=https://pre.workbench.leia.ovh`.
Los números de PR de Designer y Workbench no se emparejan.

Las APIs de pre y Turnstile deben admitir los nuevos orígenes. CORS debe autorizar
los hosts `https://pre-<número>.designer.leia.ovh` y
`https://pre-<número>.workbench.leia.ovh`; el servidor Socket.IO de Workbench
necesita la misma autorización para sus previews.

Por decisión actual, los dominios estables de pre y las PR son públicos.
Zero Trust y Cloudflare Access quedan desactivados. La futura lista de correos
para Access se conserva fuera del repositorio; no se publica información personal.

```sh
npm run test:preview
WORKERS_CI_BRANCH=develop npm run deploy:preview -- --dry-run
npm run build:pre
```

Las ramas de PR deben incorporar esta configuración desde `develop` antes de
usar los nuevos comandos. Los previews se conservan hasta borrarlos o alcanzar
los límites de Cloudflare; cerrar una PR no ejecuta un workflow de limpieza aquí.
