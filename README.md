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
## Pre and linked pull request previews

`main` serves production. `develop` automatically updates the stable pre site.
Eligible PRs targeting `develop` are reconciled by **leia-org-bot** through the
[central coordinator](https://github.com/leia-org/leia-infrastructure-docker/tree/main/previews)
every five minutes. Authors must be active members of `leia-org`, and source
branches must belong to this repository.

| Source | URL |
| --- | --- |
| `develop` | `https://pre.designer.leia.ovh` |
| Open PR targeting `develop`, such as #123 | `https://pre-123.designer.leia.ovh` |

A frontend PR can open by itself: it uses the stable pre APIs and creates no
backend application or database. The bot adds a managed environment block to its
body and updates one status comment with services, commits and URLs.

When a related backend PR exists, add its full GitHub URL to `pull_requests` in
**either** PR's managed block, or reuse the first environment name. The bot
validates and synchronizes both bodies. PR numbers and branch names never imply
a link. A backend added later deploys first; the coordinator then rebuilds the
unchanged frontend commit with the new API URL and republishes the same PR URL.
Only selected backend services run. Unchanged services use pre. Designer opens
stable Workbench by default unless a Workbench frontend PR is explicitly linked.

Selected MongoDB services receive isolated copies of their pre data, seeded once.
New records are not synchronized to pre, and calls handled by shared pre services
can still modify pre. Use explicit full isolation for cross-service flows that
need all writes and callbacks inside the preview. See the coordinator documentation
for the manifest template, data behavior and service capacity limit.

Closing a PR reconciles the remaining links and URLs. The coordinator removes its
owned frontend preview and removes backend resources and copied data when they
are no longer needed. Server capacity can queue backend environments; frontend-only
previews do not consume that limit. The bot reports readiness and queued or failed
states on the PR.

### Native Cloudflare builds for stable pre

Production build settings remain as documented above. Under **Settings > Builds >
Previews Base**, keep preview builds enabled, set the pre `VITE_*` build values,
and add `SKIP_DEPENDENCY_INSTALL=true`. Use these trusted dashboard commands so
non-develop branches run neither dependency installation nor repository scripts
and cannot overwrite the coordinator's planned API URLs:

```sh
# Build command
if [ "$WORKERS_CI_BRANCH" = develop ]; then npm ci --include=dev && npm run build:pre; else echo "PR previews are managed by leia-org-bot"; fi
# Preview command
if [ "$WORKERS_CI_BRANCH" = develop ]; then npm run deploy:preview; else echo "PR previews are managed by leia-org-bot"; fi
```

Use `/` as the root directory. Preview build variables are independent of
production values and are embedded by Vite at build time; do not put them in
Wrangler's runtime `vars` block. Under **Domains**, enable **Production and Preview**
for `designer.leia.ovh`; Cloudflare manages its wildcard preview domain and TLS.
Keep the API services' specific DNS records intact. The pre Turnstile site key and
Auth secret must belong to the same widget, with the preview hostnames authorized.
The APIs and Workbench Socket.IO must allow the preview frontend origins.

Stable pre sites and PR previews are public. Cloudflare Access is deferred; private
email allowlists and deployment credentials are not stored in this repository.

For a local build, copy `.env.pre.example` to `.env.pre.local` and fill in the
public build values:

```sh
npm run test:preview
npm run build:pre
```
