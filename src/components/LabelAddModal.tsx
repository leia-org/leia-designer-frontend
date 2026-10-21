import { useState } from "react";
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
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import { useAuth } from "../context/useAuth";
import type { Label, Leia } from "../models/Leia";
import api from "../lib/axios";

interface LabelAddModalProps {
  leia: Leia;
  onClose: () => void;
  onSave: (leiaId: string, labelsIds: string[]) => void;
  allLabels: Label[];
  currentLabels: Label[];
  onLabelCreated: (label: Label) => void;
}

export const LabelAddModal = ({ leia, onClose, onSave, allLabels, currentLabels, onLabelCreated }: LabelAddModalProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(currentLabels.map((label) => label._id)));
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: "", color: "#2563eb", secundaryColor: "#bfdbfe", user: currentUser?.id, isGlobal: false });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const add = (id: string) => setSelectedIds((previous) => new Set([...previous, id]));
  const remove = (id: string) => setSelectedIds((previous) => {
    const copy = new Set(previous);
    copy.delete(id);
    return copy;
  });
  const selected = allLabels.filter((label) => selectedIds.has(label._id));
  const available = allLabels.filter((label) => !selectedIds.has(label._id) && label.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreateLabel = async () => {
    if (!newLabel.name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const response = await api.post<Label>("/api/v1/labels", newLabel);
      const created = response.data;
      onLabelCreated(created);
      add(created._id);
      setIsCreating(false);
      setNewLabel({ name: "", color: "#2563eb", secundaryColor: "#bfdbfe", user: currentUser?.id, isGlobal: false });
    } catch {
      setCreateError("Error creating label. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <Typography variant="h6" component="span">Manage labels</Typography>
          <Typography variant="body2" color="text.secondary">{leia.metadata.name}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {!isCreating ? (
            <>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Current labels</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minHeight: 32 }}>
                  {selected.length === 0 && <Typography variant="body2" color="text.disabled">No labels assigned</Typography>}
                  {selected.map((label) => (
                    <Chip
                      key={label._id}
                      label={label.name}
                      onDelete={() => remove(label._id)}
                      size="small"
                      sx={{ bgcolor: label.color, color: label.secundaryColor, border: "1px solid", borderColor: "divider" }}
                    />
                  ))}
                </Stack>
              </Box>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="subtitle2">Add label</Typography>
                <TextField size="small" placeholder="Search labels..." value={search} onChange={(event) => setSearch(event.target.value)} fullWidth />
                <List dense disablePadding sx={{ maxHeight: 176, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                  {available.length === 0 ? (
                    <Typography variant="body2" color="text.disabled" sx={{ p: 2 }}>No labels found</Typography>
                  ) : available.map((label) => (
                    <ListItemButton key={label._id} onClick={() => add(label._id)}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: label.color, border: "1px solid", borderColor: label.secundaryColor, mr: 1.25 }} />
                      <Typography variant="body2">{label.name}</Typography>
                    </ListItemButton>
                  ))}
                </List>
                <Box>
                  <Button startIcon={<AddOutlinedIcon />} color="inherit" onClick={() => setIsCreating(true)}>
                    Create new label
                  </Button>
                </Box>
              </Stack>
            </>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6">Create new label</Typography>
                <Typography variant="body2" color="text.secondary">Add a label and reuse it in your LEIAs.</Typography>
              </Box>
              <TextField label="Name" value={newLabel.name} onChange={(event) => setNewLabel((previous) => ({ ...previous, name: event.target.value }))} fullWidth />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField type="color" label="Background colour" value={newLabel.color} onChange={(event) => setNewLabel((previous) => ({ ...previous, color: event.target.value }))} fullWidth />
                <TextField type="color" label="Text colour" value={newLabel.secundaryColor} onChange={(event) => setNewLabel((previous) => ({ ...previous, secundaryColor: event.target.value }))} fullWidth />
              </Stack>
              <Stack alignItems="center" spacing={1}>
                <Typography variant="caption">Preview</Typography>
                <Chip icon={<LabelOutlinedIcon />} label={newLabel.name || "Preview"} size="small" sx={{ bgcolor: newLabel.color, color: newLabel.secundaryColor }} />
              </Stack>
              {currentUser?.role === "admin" && (
                <FormControlLabel
                  control={<Switch checked={newLabel.isGlobal} onChange={(event) => setNewLabel((previous) => ({ ...previous, isGlobal: event.target.checked }))} />}
                  label={newLabel.isGlobal ? "Global label" : "Private label"}
                />
              )}
              {createError && <Alert severity="error">{createError}</Alert>}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {isCreating ? (
          <>
            <Button color="inherit" onClick={() => { setIsCreating(false); setCreateError(null); }}>Cancel</Button>
            <Button variant="contained" color="success" onClick={handleCreateLabel} disabled={creating || !newLabel.name.trim()}>
              {creating ? <CircularProgress size={18} color="inherit" /> : "Save label"}
            </Button>
          </>
        ) : (
          <>
            <Button color="inherit" onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={() => onSave(leia.id, Array.from(selectedIds))}>Save changes</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
