import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DraftsOutlinedIcon from "@mui/icons-material/DraftsOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { PageShell } from "../components/shared/PageShell";
import {
  deleteLeiaDraft,
  listLeiaDrafts,
  type LeiaDraft,
} from "../lib/leiaDrafts";

type DraftComponent = {
  metadata?: { name?: string };
};

type LeiaDraftWorkspace = {
  currentStep?: 1 | 2;
  leiaConfig?: {
    persona?: DraftComponent | null;
    problem?: DraftComponent | null;
    behaviour?: DraftComponent | null;
  };
  chatState?: {
    messages?: unknown[];
  };
};

const formatUpdatedAt = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

const draftComponentNames = (draft: LeiaDraft<LeiaDraftWorkspace>) =>
  [
    draft.state.leiaConfig?.persona?.metadata?.name,
    draft.state.leiaConfig?.problem?.metadata?.name,
    draft.state.leiaConfig?.behaviour?.metadata?.name,
  ].filter((name): name is string => Boolean(name));

export const LeiaDrafts = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<LeiaDraft<LeiaDraftWorkspace>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<LeiaDraft<LeiaDraftWorkspace> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDrafts(await listLeiaDrafts<LeiaDraftWorkspace>());
    } catch (loadError) {
      console.error("Error loading LEIA drafts:", loadError);
      setError("Could not load your LEIA drafts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const continueDraft = (draft: LeiaDraft<LeiaDraftWorkspace>) => {
    navigate("/create", { state: { draft } });
  };

  const confirmDelete = async () => {
    if (!draftToDelete) return;

    try {
      setDeletingId(draftToDelete.id);
      setError(null);
      await deleteLeiaDraft(draftToDelete.id);
      setDrafts((previous) => previous.filter((draft) => draft.id !== draftToDelete.id));
      setDraftToDelete(null);
    } catch (deleteError) {
      console.error("Error deleting LEIA draft:", deleteError);
      setError("Could not delete this LEIA draft.");
    } finally {
      setDeletingId(null);
    }
  };

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <Paper variant="outlined" sx={{ minHeight: 300, display: "grid", placeItems: "center" }}>
          <Stack alignItems="center" spacing={1.5}>
            <CircularProgress size={32} />
            <Typography color="text.secondary">Loading your drafts...</Typography>
          </Stack>
        </Paper>
      );
    }

    if (drafts.length === 0) {
      return (
        <Paper
          variant="outlined"
          sx={{ minHeight: 300, display: "grid", placeItems: "center", borderStyle: "dashed" }}
        >
          <Stack alignItems="center" spacing={1.5} sx={{ maxWidth: 360, px: 3, textAlign: "center" }}>
            <DraftsOutlinedIcon sx={{ fontSize: 44, color: "text.disabled" }} />
            <Typography variant="h6">No saved drafts</Typography>
            <Typography color="text.secondary">
              Start a LEIA and your work will be saved here automatically.
            </Typography>
            <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => navigate("/create")}>
              New LEIA
            </Button>
          </Stack>
        </Paper>
      );
    }

    return (
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        {drafts.map((draft) => {
          const componentNames = draftComponentNames(draft);
          const isReview = draft.state.currentStep === 2;
          const messageCount = draft.state.chatState?.messages?.length ?? 0;

          return (
            <Paper key={draft.id} variant="outlined" sx={{ p: 2.25, display: "flex", flexDirection: "column", minHeight: 210 }}>
              <Stack spacing={1.5} sx={{ height: "100%" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" noWrap>{draft.title || "Untitled LEIA"}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Updated {formatUpdatedAt(draft.updatedAt)}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={isReview ? "Review" : "New LEIA"}
                    color={isReview ? "primary" : "default"}
                    variant={isReview ? "filled" : "outlined"}
                  />
                </Stack>

                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                    Components
                  </Typography>
                  {componentNames.length ? (
                    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
                      {componentNames.map((name) => <Chip key={name} label={name} size="small" variant="outlined" />)}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No components selected yet.
                    </Typography>
                  )}
                  {messageCount > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
                      {messageCount} assistant message{messageCount === 1 ? "" : "s"} saved
                    </Typography>
                  )}
                </Box>

                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Tooltip title="Delete draft">
                    <span>
                      <IconButton
                        aria-label={`Delete ${draft.title || "LEIA draft"}`}
                        color="error"
                        size="small"
                        onClick={() => setDraftToDelete(draft)}
                        disabled={Boolean(deletingId)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button variant="contained" size="small" onClick={() => continueDraft(draft)}>
                    Continue
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          );
        })}
      </Box>
    );
  }, [deletingId, drafts, isLoading, navigate]);

  return (
    <PageShell
      title="LEIA drafts"
      description="Continue building a saved LEIA or remove drafts you no longer need."
      maxWidth="lg"
      actions={
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh drafts">
            <IconButton aria-label="Refresh drafts" onClick={() => void loadDrafts()} disabled={isLoading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => navigate("/create")}>
            New LEIA
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void loadDrafts()}>Retry</Button>}>{error}</Alert>}
        {content}
      </Stack>

      <Dialog open={Boolean(draftToDelete)} onClose={() => setDraftToDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete draft?</DialogTitle>
        <DialogContent dividers>
          <Typography color="text.secondary">
            Delete "{draftToDelete?.title || "Untitled LEIA"}"? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setDraftToDelete(null)} disabled={Boolean(deletingId)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmDelete()} disabled={Boolean(deletingId)}>
            {deletingId ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};
