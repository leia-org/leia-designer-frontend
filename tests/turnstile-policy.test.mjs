import assert from "node:assert/strict";
import test from "node:test";

import { getTurnstilePolicy } from "../src/config/turnstilePolicy.mjs";

test("Turnstile remains required when its site key is missing", () => {
  assert.deepEqual(getTurnstilePolicy(undefined, "  "), {
    enabled: true,
    siteKey: undefined,
    state: "unavailable",
  });
});

test("Turnstile can be explicitly disabled even when a site key is present", () => {
  assert.deepEqual(getTurnstilePolicy("FALSE", "site-key"), {
    enabled: false,
    siteKey: "site-key",
    state: "disabled",
  });
});

test("configured site keys are trimmed before the widget is rendered", () => {
  assert.deepEqual(getTurnstilePolicy(undefined, " site-key "), {
    enabled: true,
    siteKey: "site-key",
    state: "ready",
  });
});
