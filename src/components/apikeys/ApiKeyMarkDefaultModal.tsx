import type React from "react";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { ApiKey } from "../../models/ApiKeys";

interface ApiKeyMarkDefaultModalProps {
  apiKey: ApiKey | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export const ApiKeyMarkDefaultModal: React.FC<ApiKeyMarkDefaultModalProps> = ({
  apiKey,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!apiKey) return;
    try {
      setLoading(true);
      await onConfirm();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!apiKey) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="h6" component="span">
          {apiKey.isDefault
            ? "¿Desea quitar esta clave como predeterminada?"
            : "¿Desea marcar esta clave como predeterminada?"}
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="Cerrar"
          size="small"
          sx={{ color: "text.disabled", "&:hover": { color: "text.secondary" } }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "text.secondary" }}>
          {apiKey.isDefault
            ? `¿Está seguro de que desea quitar "${apiKey.description}" como clave predeterminada?`
            : `¿Desea marcar "${apiKey.description}" como su clave predeterminada? Esto desmarcará la clave que esté marcada actualmente.`}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={loading} variant="contained" color="warning">
          {loading
            ? "Procesando..."
            : apiKey.isDefault
              ? "Quitar como predeterminada"
              : "Marcar como predeterminada"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApiKeyMarkDefaultModal;
