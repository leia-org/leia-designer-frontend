import { useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";

type TestAccount = { id: string; email: string; role: string };
const authUrl = "https://pre.auth.leia.ovh/api/v1/test-login";

/** Only Auth's verified Access capability exposes the pre account picker. */
export function TestAccountLogin({ returnPath = "/" }: { returnPath?: string }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [selected, setSelected] = useState<TestAccount | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!/^(?:pre|pre-[1-9]\d*)\.(?:designer|workbench)\.leia\.ovh$/.test(window.location.hostname) ||
        import.meta.env.VITE_AUTH_SERVICE_BACKEND !== "https://pre.auth.leia.ovh") return;
    const controller = new AbortController();
    void fetch(`${authUrl}/status`, { credentials: "include", signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const status = await response.json() as { enabled?: boolean; authenticated?: boolean; mode?: string };
      if (!status.enabled || !status.authenticated || status.mode !== "modal" || controller.signal.aborted) return;
      setAuthenticated(true);
      if (new URLSearchParams(window.location.search).get("login") !== "password") setOpen(true);
    }).catch(() => { /* Anonymous visitors retain the standard login. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open || !authenticated) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      void fetch(`${authUrl}/accounts?q=${encodeURIComponent(query)}`, {
        credentials: "include", signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw new Error(response.status === 403 ? "Your Access session has expired. Sign in again at test-login.leia.ovh." : "Could not load pre accounts.");
        const data = await response.json() as TestAccount[];
        if (!controller.signal.aborted) { setAccounts(data); setError(""); }
      }).catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load pre accounts.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, authenticated, query]);

  const selectAccount = async () => {
    if (!selected) return;
    setSubmitting(true); setError("");
    try {
      const response = await fetch(`${authUrl}/session`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selected.id }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? "Your Access session has expired. Sign in again at test-login.leia.ovh." : "Could not start the selected pre session.");
      window.location.assign(returnPath);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not start the selected pre session.");
      setSubmitting(false);
    }
  };

  if (!authenticated) return null;
  return <>
    <Stack spacing={1} sx={{ pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
      <Button variant="outlined" startIcon={<GitHubIcon />} fullWidth onClick={() => setOpen(true)}>
        Choose a pre test account
      </Button>
      <Typography variant="caption" color="text.secondary" textAlign="center">
        For leia-org members. Sign in with GitHub through Cloudflare Access.
      </Typography>
    </Stack>
    <Dialog open={open} onClose={() => { if (!submitting) setOpen(false); }} fullWidth maxWidth="sm" aria-labelledby="pre-account-title">
      <DialogTitle id="pre-account-title">Choose a pre account</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 3 }}>Select an existing account to test its permissions in pre.</DialogContentText>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Autocomplete
          options={accounts}
          value={selected}
          onChange={(_, value) => setSelected(value)}
          onInputChange={(_, value, reason) => { if (reason === "input" || reason === "clear") setQuery(value); }}
          filterOptions={options => options}
          getOptionLabel={account => account.email}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={loading}
          disabled={submitting}
          noOptionsText="No matching pre accounts"
          renderOption={(props, account) => <Box component="li" {...props} key={account.id}>
            <Box><Typography variant="body2">{account.email}</Typography><Typography variant="caption" color="text.secondary">{account.role}</Typography></Box>
          </Box>}
          renderInput={params => <TextField {...params} label="Pre account" placeholder="Search by email" autoFocus slotProps={{ input: { ...params.InputProps, endAdornment: <>{loading && <CircularProgress size={18} />}{params.InputProps.endAdornment}</> } }} />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={() => void selectAccount()} disabled={!selected || submitting}>
          {submitting ? <CircularProgress size={20} color="inherit" /> : "Continue"}
        </Button>
      </DialogActions>
    </Dialog>
  </>;
}
