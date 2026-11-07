# Regression and integration tests

Implements [development #114](https://github.com/leia-org/development/issues/114).

```sh
npm ci
npm run test:regression
```

`npm test` runs the same finite suite; `npm run test:watch` is available for development. CI runs the regression command on Node 22 and 24 for pull requests and pushes to `main`/`develop`, without service credentials.

Real Axios interceptors with an in-memory adapter: bearer rotation, central-session logout, 401/403/server/network errors, plus draft state persistence and legacy ids. All existing Node test suites (including creator and image regressions) also run.

External side effects are replaced at the database, HTTP adapter/fetch, Redis or model-provider boundary. No MongoDB, Redis server or paid model API is needed. These tests complement browser and deployed-stack end-to-end tests.

## Integration tests

```sh
npm run test:integration
```

Production React dialog/hooks/Axios interceptors mount in jsdom and make real HTTP requests to a local contract server. Tests select an existing activity, create a new one, retry a failed attachment without duplicate creation and cancel safely.

CI runs integration separately on Node 24. No production service/repository method is mocked; local HTTP peers supply deterministic contracts for external dependencies. These suites do not assert real LLM answer quality or live audio.
