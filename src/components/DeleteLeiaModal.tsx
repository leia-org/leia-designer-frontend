import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import type { Leia } from "../models/Leia";

interface DeleteLeiaModalProps {
  isOpen: boolean;
  leia: Leia | null;
  onClose: () => void;
  onConfirm: (leia: Leia) => void;
  isDeleting?: boolean;
  error?: { message: string; data?: Array<{ id: string; name: string }> } | null;
}

export const DeleteLeiaModal = ({
  isOpen,
  leia,
  onClose,
  onConfirm,
  isDeleting = false,
  error = null,
}: DeleteLeiaModalProps) => {
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    if (!isOpen) setConfirmName("");
  }, [isOpen]);

  if (!leia) return null;

  const isConfirmValid = confirmName === leia.metadata.name;
  const resetAndClose = () => {
    setConfirmName("");
    onClose();
  };
  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <Dialog open={isOpen} onClose={isDeleting ? undefined : resetAndClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <WarningAmberOutlinedIcon color="error" />
          <Typography variant="h6" component="span">Delete LEIA</Typography>
        </Stack>
        <IconButton onClick={resetAndClose} disabled={isDeleting} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error">
              <Typography variant="body2" fontWeight={700}>{error.message}</Typography>
              {error.data && error.data.length > 0 && (
                <Box component="ul" sx={{ mb: 0, pl: 2.5 }}>
                  {error.data.map((experiment) => <li key={experiment.id}>{experiment.name} (ID: {experiment.id})</li>)}
                </Box>
              )}
            </Alert>
          )}
          <Alert severity="error" icon={<WarningAmberOutlinedIcon />}>
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">LEIA Details</Typography>
              <Typography variant="body2"><strong>Name:</strong> {leia.metadata.name}</Typography>
              <Typography variant="body2"><strong>Type:</strong> LEIA</Typography>
              <Typography variant="body2"><strong>Version:</strong> {leia.metadata.version}</Typography>
              {leia.createdAt && <Typography variant="body2"><strong>Created:</strong> {formatDate(leia.createdAt)}</Typography>}
              <Typography variant="body2" sx={{ mt: 1 }}><strong>Warning:</strong> This action cannot be undone. The LEIA will be permanently deleted.</Typography>
            </Stack>
          </Alert>
          <TextField
            label={`Type “${leia.metadata.name}” to confirm`}
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={leia.metadata.name}
            disabled={isDeleting}
            error={Boolean(confirmName) && !isConfirmValid}
            helperText={confirmName && !isConfirmValid ? `Name doesn't match. Type “${leia.metadata.name}” exactly.` : undefined}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={() => setConfirmName("")} disabled={isDeleting}>Reset</Button>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={resetAndClose} disabled={isDeleting}>Cancel</Button>
        <Button variant="contained" color="error" onClick={() => onConfirm(leia)} disabled={isDeleting || !isConfirmValid}>
          {isDeleting ? <CircularProgress size={18} color="inherit" /> : "Delete LEIA"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
