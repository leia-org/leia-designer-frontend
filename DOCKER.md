# Docker images

GitHub Actions publishes `ghcr.io/leia-org/leia-designer-frontend` for pushes to `main` and
`develop`. Pull requests build the image without publishing it. The workflow can
also be run manually on either stable branch.

| Source | Tags |
| --- | --- |
| `main` | `main`, `latest`, `main-<full-commit-sha>`, `<full-commit-sha>` |
| `develop` | `develop`, `develop-<full-commit-sha>` |

Images target `linux/amd64`. `develop` never updates `latest` or the unprefixed
commit tag. Publishing uses the repository's automatic `GITHUB_TOKEN` with
`packages: write`; no registry password or personal token is required. The Actions
summary includes the published tags and digest.

The Docker context excludes local environment files, Git metadata, dependency
folders, logs and private key files.

## Public frontend build configuration

Set repository Actions variables `DOCKER_BUILD_ENV_MAIN` and
`DOCKER_BUILD_ENV_DEVELOP` to JSON objects containing the corresponding public
`VITE_` settings. They are initialized from the stable production/pre Cloudflare
build configuration. Keep these Docker build variables in sync when changing
Cloudflare's public build settings. The existing production-promotion workflow
synchronizes hosting configuration; it does not update these Actions variables.

The Docker build validates URLs and the Turnstile site key. It supplies the public
configuration through a BuildKit file mount and includes its hash in the build
cache key, so changing configuration invalidates the compiled bundle. Vite values
are public in the browser bundle; never put backend credentials here.

The final image contains the compiled static assets and Nginx, with SPA fallback.
The container listens on `5173` by default; `PORT` can override the listening
port. Vite settings must be supplied at build time, not when starting the image.

```sh
# Use a local file containing the appropriate public VITE_ values.
docker build --secret id=vite_env,src=.env.production.local \
  --build-arg BUILD_CONFIG_DIGEST="$(shasum -a 256 .env.production.local | cut -d ' ' -f 1)" \
  -t leia-frontend .
docker run --rm -p 8080:5173 leia-frontend
```
