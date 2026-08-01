import { useCallback, useEffect, useMemo, useState } from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import MergeTypeOutlinedIcon from "@mui/icons-material/MergeTypeOutlined";
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
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Label } from "../models/Leia";
import api from "../lib/axios";
import { PageShell } from "../components/shared/PageShell";

type LabelGroupProps = {
  title: string;
  description: string;
  labels: Label[];
  mergeMode: boolean;
  selectedLabelIds: Set<string>;
  onSelect: (labelId: string) => void;
  onEdit: (label: Label) => void;
  onDelete: (label: Label) => void;
};

const labelChipSx = (label: Label) => ({
  bgcolor: label.color || "#f3f4f6",
  color: label.secundaryColor || "#111827",
  borderColor: "rgba(15, 23, 42, 0.12)",
  maxWidth: "100%",
  "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
});

const LabelGroup = ({
  title,
  description,
  labels,
  mergeMode,
  selectedLabelIds,
  onSelect,
  onEdit,
  onDelete,
}: LabelGroupProps) => (
  <Paper variant="outlined" sx={{ p: 2.25, minHeight: 250 }}>
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </Box>

      {labels.length ? (
        <Stack spacing={1}>
          {labels.map((label) => {
            const isSelected = selectedLabelIds.has(label._id);
            return (
              <Paper
                key={label._id}
                variant="outlined"
                role={mergeMode ? "button" : undefined}
                tabIndex={mergeMode ? 0 : undefined}
                onClick={mergeMode ? () => onSelect(label._id) : undefined}
                onKeyDown={mergeMode ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(label._id);
                  }
                } : undefined}
                sx={{
                  p: 1.25,
                  cursor: mergeMode ? "pointer" : "default",
                  borderColor: isSelected ? "primary.main" : "divider",
                  bgcolor: isSelected ? "surfaces.selected" : "background.paper",
                  boxShadow: isSelected ? "0 0 0 1px rgba(37, 99, 235, 0.22)" : "none",
                  transition: "background-color 120ms ease, border-color 120ms ease",
                  "&:hover": mergeMode ? { bgcolor: "surfaces.hover" } : undefined,
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Chip label={label.name} size="small" variant="outlined" sx={labelChipSx(label)} />
                  <Stack direction="row" spacing={0.25}>
                    <Tooltip title="Edit label">
                      <span>
                        <IconButton
                          aria-label={`Edit ${label.name}`}
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(label);
                          }}
                          disabled={mergeMode}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete label">
                      <span>
                        <IconButton
                          aria-label={`Delete ${label.name}`}
                          size="small"
                          color="error"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(label);
                          }}
                          disabled={mergeMode}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">No labels in this group.</Typography>
        </Box>
      )}
    </Stack>
  </Paper>
);

export const LabelManagement = () => {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [labelToEdit, setLabelToEdit] = useState<Label | null>(null);
  const [labelToDelete, setLabelToDelete] = useState<Label | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadLabels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<Label[]>("/api/v1/labels");
      setLabels(response.data || []);
    } catch (loadError) {
      console.error("Error fetching labels:", loadError);
      setError("Could not load labels.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLabels();
  }, [loadLabels]);

  const globalLabels = useMemo(() => labels.filter((label) => label.isGlobal), [labels]);
  const privateLabels = useMemo(() => labels.filter((label) => !label.isGlobal), [labels]);
  const selectedLabels = useMemo(
    () => labels.filter((label) => selectedLabelIds.has(label._id)),
    [labels, selectedLabelIds],
  );
  const sourceLabel = selectedLabels[0] ?? null;
  const targetLabel = selectedLabels[1] ?? null;

  const closeMergeMode = () => {
    setMergeMode(false);
    setSelectedLabelIds(new Set());
  };

  const toggleLabelSelection = (labelId: string) => {
    setSelectedLabelIds((previous) => {
      const next = new Set(previous);
      if (next.has(labelId)) {
        next.delete(labelId);
        return next;
      }
      if (next.size >= 2) return previous;
      next.add(labelId);
      return next;
    });
  };

  const handleUpdate = async () => {
    if (!labelToEdit) return;
    try {
      setIsSaving(true);
      setError(null);
      await api.put<Label>(`/api/v1/labels/${labelToEdit._id}`, {
        name: labelToEdit.name.trim(),
        color: labelToEdit.color,
        secundaryColor: labelToEdit.secundaryColor,
        isGlobal: labelToEdit.isGlobal,
      });
      setLabelToEdit(null);
      await loadLabels();
    } catch (updateError) {
      console.error("Error updating label:", updateError);
      setError("Could not update this label.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!labelToDelete) return;
    try {
      setIsSaving(true);
      setError(null);
      await api.delete(`/api/v1/labels/${labelToDelete._id}`);
      setLabels((previous) => previous.filter((label) => label._id !== labelToDelete._id));
      setLabelToDelete(null);
    } catch (deleteError) {
      console.error("Error deleting label:", deleteError);
      setError("Could not delete this label.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMerge = async () => {
    if (!sourceLabel || !targetLabel) return;
    try {
      setIsSaving(true);
      setError(null);
      await api.post(`/api/v1/labels/${sourceLabel._id}/merge-into/${targetLabel._id}`);
      closeMergeMode();
      await loadLabels();
    } catch (mergeError) {
      console.error("Error merging labels:", mergeError);
      setError("Could not merge these labels.");
    } finally {
      setIsSaving(false);
    }
  };

  const mergeButton = (
    <Button
      variant={mergeMode ? "outlined" : "contained"}
      color={mergeMode ? "inherit" : "primary"}
      startIcon={<MergeTypeOutlinedIcon />}
      onClick={() => (mergeMode ? closeMergeMode() : setMergeMode(true))}
    >
      {mergeMode ? "Cancel merge" : "Merge labels"}
    </Button>
  );

  return (
    <PageShell
      title="Label management"
      description="Edit, organize, and merge global or private labels."
      maxWidth="lg"
      actions={mergeButton}
    >
      <Stack spacing={2.5}>
        {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void loadLabels()}>Retry</Button>}>{error}</Alert>}

        {mergeMode && (
          <Alert severity="info">
            Select the source label first, then the label that should receive its references. Select a label again to remove it.
          </Alert>
        )}

        {isLoading ? (
          <Paper variant="outlined" sx={{ minHeight: 300, display: "grid", placeItems: "center" }}>
            <Stack alignItems="center" spacing={1.5}>
              <CircularProgress size={32} />
              <Typography color="text.secondary">Loading labels...</Typography>
            </Stack>
          </Paper>
        ) : (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1.5}>
                <LabelOutlinedIcon color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">{labels.length} labels</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Global labels can be used across the designer. Private labels remain scoped to their owner.
                  </Typography>
                </Box>
                <Chip label={`${globalLabels.length} global`} size="small" variant="outlined" />
                <Chip label={`${privateLabels.length} private`} size="small" variant="outlined" />
              </Stack>
            </Paper>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <LabelGroup
                title="Global labels"
                description="Available to everyone."
                labels={globalLabels}
                mergeMode={mergeMode}
                selectedLabelIds={selectedLabelIds}
                onSelect={toggleLabelSelection}
                onEdit={(label) => setLabelToEdit({ ...label })}
                onDelete={setLabelToDelete}
              />
              <LabelGroup
                title="Private labels"
                description="Visible only to their owner."
                labels={privateLabels}
                mergeMode={mergeMode}
                selectedLabelIds={selectedLabelIds}
                onSelect={toggleLabelSelection}
                onEdit={(label) => setLabelToEdit({ ...label })}
                onDelete={setLabelToDelete}
              />
            </Box>
          </>
        )}
      </Stack>

      <Dialog open={Boolean(labelToEdit)} onClose={() => !isSaving && setLabelToEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit label</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Name"
              value={labelToEdit?.name ?? ""}
              onChange={(event) => setLabelToEdit((previous) => previous ? { ...previous, name: event.target.value } : previous)}
              fullWidth
              autoFocus
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Background colour"
                type="color"
                value={labelToEdit?.color ?? "#2563eb"}
                onChange={(event) => setLabelToEdit((previous) => previous ? { ...previous, color: event.target.value } : previous)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                label="Text colour"
                type="color"
                value={labelToEdit?.secundaryColor ?? "#ffffff"}
                onChange={(event) => setLabelToEdit((previous) => previous ? { ...previous, secundaryColor: event.target.value } : previous)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Box>
            {labelToEdit && <Chip label={labelToEdit.name || "Preview"} sx={{ ...labelChipSx(labelToEdit), alignSelf: "flex-start" }} />}
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(labelToEdit?.isGlobal)}
                  onChange={(event) => setLabelToEdit((previous) => previous ? { ...previous, isGlobal: event.target.checked } : previous)}
                />
              }
              label="Global label"
              sx={{ m: 0 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setLabelToEdit(null)} disabled={isSaving}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleUpdate()} disabled={isSaving || !labelToEdit?.name.trim()}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(labelToDelete)} onClose={() => !isSaving && setLabelToDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete label?</DialogTitle>
        <DialogContent dividers>
          <Typography color="text.secondary">
            Delete "{labelToDelete?.name}"? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setLabelToDelete(null)} disabled={isSaving}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()} disabled={isSaving}>
            {isSaving ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(sourceLabel && targetLabel)} onClose={() => !isSaving && closeMergeMode()} fullWidth maxWidth="xs">
        <DialogTitle>Merge labels?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            <Typography color="text.secondary">
              All references from the source label will move to the target label. The source label will then be deleted.
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
              {sourceLabel && <Chip label={sourceLabel.name} size="small" sx={labelChipSx(sourceLabel)} />}
              <Typography color="text.secondary">to</Typography>
              {targetLabel && <Chip label={targetLabel.name} size="small" sx={labelChipSx(targetLabel)} />}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={closeMergeMode} disabled={isSaving}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleMerge()} disabled={isSaving}>
            {isSaving ? "Merging..." : "Merge labels"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};
