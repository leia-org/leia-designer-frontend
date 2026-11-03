export function getTurnstilePolicy(enabledValue, siteKeyValue) {
  const siteKey = siteKeyValue?.trim() || undefined;
  const enabled = enabledValue?.toLowerCase() !== "false";

  return {
    enabled,
    siteKey,
    state: !enabled ? "disabled" : siteKey ? "ready" : "unavailable",
  };
}
