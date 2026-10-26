import { getTurnstilePolicy } from "./turnstilePolicy.mjs";

const turnstilePolicy = getTurnstilePolicy(
  import.meta.env.VITE_TURNSTILE_ENABLED,
  import.meta.env.VITE_CLOUDFLARE_SITE_KEY,
);

export const turnstileSiteKey = turnstilePolicy.siteKey;
export const isTurnstileEnabled = turnstilePolicy.enabled;
export const turnstileState = turnstilePolicy.state;
