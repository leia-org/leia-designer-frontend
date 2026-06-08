export const isTurnstileEnabled =
  import.meta.env.VITE_TURNSTILE_ENABLED?.toLowerCase() !== "false";
