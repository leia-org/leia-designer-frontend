import { useEffect, useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";

/** The public login remains available; account selection is authorized by Auth and Access. */
export function TestAccountLogin({ returnPath = "/" }: { returnPath?: string }) {
  const [entryUrl, setEntryUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!/^(?:pre|pre-[1-9]\d*)\.(?:designer|workbench)\.leia\.ovh$/.test(window.location.hostname) ||
        import.meta.env.VITE_AUTH_SERVICE_BACKEND !== "https://pre.auth.leia.ovh") return;
    const controller = new AbortController();
    const entry = new URL("https://test-login.leia.ovh/");
    entry.searchParams.set("returnTo", `${window.location.origin}${returnPath}`);
    void fetch("https://pre.auth.leia.ovh/api/v1/test-login/status", {
      credentials: "include", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) return;
      const status = await response.json() as { enabled?: boolean; authenticated?: boolean };
      if (!status.enabled || controller.signal.aborted) return;
      setEntryUrl(entry.href);
      if (status.authenticated && new URLSearchParams(window.location.search).get("login") !== "password") {
        window.location.assign(entry.href);
      }
    }).catch(() => { /* A failed capability check leaves the standard login available. */ });
    return () => controller.abort();
  }, [returnPath]);
  if (!entryUrl) return null;
  return <Stack spacing={1} sx={{ pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
    <Button component="a" href={entryUrl} variant="outlined" startIcon={<GitHubIcon />} fullWidth>
      Choose a pre test account
    </Button>
    <Typography variant="caption" color="text.secondary" textAlign="center">
      For leia-org members. Sign in with GitHub through Cloudflare Access.
    </Typography>
  </Stack>;
}
