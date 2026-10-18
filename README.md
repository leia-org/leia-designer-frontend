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
