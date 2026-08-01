import React, { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Persona, Problem, Behaviour } from "../models/Leia";

interface DeleteResourceModalProps {
  isOpen: boolean;
  resource: Persona | Problem | Behaviour | null;
  resourceType: "persona" | "problem" | "behaviour" | null;
  onClose: () => void;
  onConfirm: (
    resource: Persona | Problem | Behaviour,
    resourceType: "persona" | "problem" | "behaviour"
  ) => void;
  isDeleting?: boolean;
  error?: {
    message: string;
    data?: Array<{ id: string; name: string }>;
  } | null;
}

export const DeleteResourceModal: React.FC<DeleteResourceModalProps> = ({
  isOpen,
  resource,
  resourceType,
  onClose,
  onConfirm,
  isDeleting = false,
  error = null,
}) => {
  const [confirmName, setConfirmName] = useState("");

  if (!resource || !resourceType) return null;

  const resourceLabel = `${resourceType.charAt(0).toUpperCase()}${resourceType.slice(1)}`;
  const isConfirmValid = confirmName === resource.metadata.name;

  const resetAndClose = () => {
    setConfirmName("");
    onClose();
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Dialog
      open={isOpen}
      onClose={isDeleting ? undefined : resetAndClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="delete-resource-title"
    >
      <DialogTitle id="delete-resource-title" sx={{ pr: 7 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningAmberOutlinedIcon color="error" />
          <Typography component="span" variant="h6">
            Delete {resourceLabel}
          </Typography>
        </Stack>
        <IconButton
          aria-label="Close"
          onClick={resetAndClose}
          disabled={isDeleting}
          sx={{ position: "absolute", top: 12, right: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error">
              <Typography variant="subtitle2" gutterBottom>
                {error.message}
              </Typography>
              {error.data && error.data.length > 0 && (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {error.data.map((leia) => (
                    <Typography component="li" variant="caption" key={leia.id}>
                      <strong>{leia.name}</strong> (ID: {leia.id})
                    </Typography>
                  ))}
                </Box>
              )}
            </Alert>
          )}

          <Alert severity="warning" variant="outlined">
            <Typography variant="subtitle2" gutterBottom>
              Resource details
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2"><strong>Name:</strong> {resource.metadata.name}</Typography>
              <Typography variant="body2"><strong>Type:</strong> {resourceLabel}</Typography>
              <Typography variant="body2"><strong>Version:</strong> {resource.metadata.version}</Typography>
              {resource.createdAt && (
                <Typography variant="body2"><strong>Created:</strong> {formatDate(resource.createdAt)}</Typography>
              )}
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="body2">
              <strong>Warning:</strong> This action cannot be undone. The resource will be permanently deleted.
            </Typography>
          </Alert>

          <TextField
            label="Confirm resource name"
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={resource.metadata.name}
            disabled={isDeleting}
            error={Boolean(confirmName) && !isConfirmValid}
            helperText={
              confirmName && !isConfirmValid
                ? `Name doesn't match. Type "${resource.metadata.name}" exactly.`
                : `Type "${resource.metadata.name}" to confirm deletion.`
            }
            fullWidth
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2 }}>
        <Button color="inherit" onClick={() => setConfirmName("")} disabled={isDeleting}>
          Reset
        </Button>
        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={resetAndClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={isDeleting || !isConfirmValid}
            onClick={() => onConfirm(resource, resourceType)}
            startIcon={isDeleting ? <CircularProgress color="inherit" size={16} /> : undefined}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};
