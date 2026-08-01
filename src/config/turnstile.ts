export const turnstileSiteKey = import.meta.env.VITE_CLOUDFLARE_SITE_KEY?.trim();

export const isTurnstileEnabled =
  import.meta.env.VITE_TURNSTILE_ENABLED?.toLowerCase() !== "false" && Boolean(turnstileSiteKey);
