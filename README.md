# LEIA Designer frontend

React, TypeScript, and Vite application. Builds produce `dist/`, which can be
deployed to Cloudflare Workers with Static Assets or to Cloudflare Pages.
The API and authentication services are deployed separately.

## Development

Requires Node.js 22 or later. `.nvmrc` selects Node.js 22.

```sh
nvm use
npm ci
cp .env.example .env
npm run dev
```

## Production configuration

For a local build, copy `.env.production.example` to `.env.production.local`
and replace the example domains with the actual ones. In Cloudflare, configure
these values as **build variables** for production and any previews you use.

| Variable | Value |
| --- | --- |
| `VITE_APP_BACKEND` | HTTPS URL of the Designer API, without a trailing slash. |
| `VITE_AUTH_SERVICE_BACKEND` | HTTPS URL of the authentication service, without a trailing slash. |
| `VITE_WORKBENCH_URL` | HTTPS URL of the Workbench frontend. |
| `VITE_IMAGE_PUBLIC_URL` | Public HTTPS URL used to serve images. |
| `VITE_TURNSTILE_ENABLED` | `true`, or `false` if Turnstile is also disabled in the backend. |
| `VITE_CLOUDFLARE_SITE_KEY` | Public Turnstile site key for the deployed hostname. |

Vite embeds `VITE_*` values in the public JavaScript bundle during the build.
Changing them requires a new build and deployment. Worker runtime variables
alone do not update the frontend. Private keys and the Turnstile secret belong
in the backend services.

Allow the frontend's HTTPS origin in the APIs' CORS configuration and authorize
its hostname in Turnstile. Workbench also needs its origin allowed by Socket.IO.

## API requests reaching the frontend hostname

If a request such as `/api/v1/apikeys` reaches the frontend hostname, check
`VITE_AUTH_SERVICE_BACKEND` in the **build variables**. That route belongs to
the authentication service; `VITE_APP_BACKEND` points to this application's API.
Both values must be absolute HTTP(S) URLs. Save the build variables in Cloudflare,
then rebuild and redeploy.

Workers and Pages builds fail when required backend URLs are missing or invalid,
or when Turnstile is enabled without a public site key. This prevents deployments
that would accidentally use relative API URLs.

## Missing Turnstile site key

If Turnstile reports `Invalid or missing type for parameter "sitekey"`, add
`VITE_CLOUDFLARE_SITE_KEY` under **Settings > Build > Build Variables and Secrets**,
then rebuild and redeploy. The public site key and the backend's secret must
belong to the same widget, with the frontend hostname authorized.

Adding the value only to the Worker's **Variables & Secrets** or Wrangler's
`vars` does not include it in the Vite bundle.

## Cloudflare Workers

`wrangler.workers.jsonc` serves `dist/` as Static Assets and enables the SPA
fallback so React Router routes work when opened directly or refreshed.

```sh
npx wrangler login
npm run deploy:workers
```

`npm run deploy` is an alias for `deploy:workers`. The Worker name is
`leia-designer-frontend`; change it in `wrangler.workers.jsonc` if needed.
To test the build with Cloudflare's local runtime:

```sh
npm run preview:workers
```

Connect this repository to **Workers Builds** with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --config wrangler.workers.jsonc` |
| Node.js | `NODE_VERSION=22` |

Add the `VITE_*` values listed above to the build variables. The Workers project
name must match `name` in `wrangler.workers.jsonc`.

## Cloudflare Pages

Connect this repository to Pages with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root |
| Framework preset | React (Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `NODE_VERSION=22` |

Set the `VITE_*` variables in the build environment. Pages serves the SPA
automatically because `dist/` contains `index.html` and no `404.html`.
Pages uses `wrangler.jsonc`; Workers commands explicitly select
`wrangler.workers.jsonc` so the two deployment options remain independent.

For a terminal deployment, create the project once, unless it already exists,
then deploy:

```sh
npx wrangler login
npx wrangler pages project create leia-designer-frontend --production-branch main
npm run deploy:pages
```

If the project already exists under another name, update `name` in
`wrangler.jsonc`. To test Pages locally:

```sh
npm run preview:pages
```

## Validation

```sh
npm run build
npx wrangler deploy --config wrangler.workers.jsonc --dry-run
```

Deployment commands build the application before publishing it. CI can use
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` instead of interactive login.
`npm start` retains the Express server for other hosting environments;
Cloudflare serves the files in `dist/` directly.

References: [Workers SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/),
[Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/),
and [Pages SPA routing](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).
