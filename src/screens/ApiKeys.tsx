import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import { PageShell } from "../components/shared/PageShell";
import { ApiKeyCard } from "../components/apikeys/ApiKeyCard";
import { ApiKeyFormModal } from "../components/apikeys/ApiKeyFormModal";
import { ApiKeyMarkDefaultModal } from "../components/apikeys/ApiKeyMarkDefaultModal";
import type { ApiKey, ApiKeyFormData } from "../models/ApiKeys";
import { useApiKeys } from "../hooks/useApiKeys";
import { useAuth } from "../context";

export const ApiKeysPage = () => {
  const { user } = useAuth();
  const { apiKeys, isLoading, toggleDefault, savingIds, deleteKey, saveKey, refetch } = useApiKeys();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMarkDefaultModalOpen, setIsMarkDefaultModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setSelectedKey(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedKey(null);
  };

  const confirmMarkDefault = async () => {
    if (!selectedKey) return;
    try {
      const updatedKey = await toggleDefault(selectedKey);
      toast.success(updatedKey.isDefault ? "API Key set as default" : "API Key removed as default");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update default status");
    } finally {
      setIsMarkDefaultModalOpen(false);
      setSelectedKey(null);
    }
  };

  const openCreateModal = () => {
    setFormMode("create");
    setSelectedKey(null);
    setValidationErrors({});
    setIsFormModalOpen(true);
  };

  const openEditModal = (apiKey: ApiKey) => {
    setFormMode("edit");
    setSelectedKey(apiKey);
    setValidationErrors({});
    setIsFormModalOpen(true);
  };

  const openMarkDefaultModal = (apiKey: ApiKey) => {
    setSelectedKey(apiKey);
    setIsMarkDefaultModalOpen(true);
  };

  const handleSaveKey = async (formData: Partial<ApiKey>) => {
    try {
      setValidationErrors({});
      const isCreate = formMode === "create";
      const isSystemKey = isCreate ? formData.isSystemApiKey : selectedKey?.isSystemApiKey;
      const apiKeysBaseUrl = isSystemKey
        ? `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apiKeys/system`
        : `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apikeys`;
      const url = isCreate ? apiKeysBaseUrl : `${apiKeysBaseUrl}/${selectedKey?.id}`;
      const method = isCreate ? "POST" : "PUT";

      const payload: ApiKeyFormData = {
        description: formData.description,
        keyValue: formData.keyValue,
        provider: formData.provider,
        model: formData.model,
        baseUrl: formData.baseUrl,
        managementUrl: formData.managementUrl?.trim() || undefined,
        isActive: formData.isActive,
      };
      if (isCreate) payload.isDefault = formData.isDefault;

      await saveKey(url, method, payload);
      await refetch();
      toast.success(isCreate ? "API Key created successfully!" : "API Key updated!");
      closeFormModal();
    } catch (error) {
      console.error(error);
      const validationErrorsFromApi =
        error instanceof Error && "validationErrors" in error
          ? error.validationErrors
          : undefined;
      if (validationErrorsFromApi && typeof validationErrorsFromApi === "object") {
        setValidationErrors(validationErrorsFromApi as Record<string, string>);
        toast.error("Please correct the errors in the form.");
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to save API Key");
      }
      throw error;
    }
  };

  const confirmDelete = async () => {
    if (!selectedKey) return;
    try {
      const apiKeysBaseUrl = selectedKey.isSystemApiKey
        ? `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apiKeys/system`
        : `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apikeys`;
      await deleteKey(`${apiKeysBaseUrl}/${selectedKey.id}`, selectedKey.id);
      toast.success("API Key deleted successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to delete API Key");
    } finally {
      closeDeleteModal();
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 10 }}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography sx={{ color: "text.secondary", fontWeight: 500 }}>
            Loading your API Keys...
          </Typography>
        </Box>
      );
    }

    if (apiKeys.length === 0) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 10,
            px: 3,
            bgcolor: "background.paper",
            borderRadius: 2,
            border: "1px dashed",
            borderColor: "divider",
          }}
        >
          <VpnKeyOutlinedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography sx={{ color: "text.secondary", mb: 2, textAlign: "center", maxWidth: 360 }}>
            You don't have any custom API Keys configured yet. Add one to get started.
          </Typography>
          <Button variant="outlined" onClick={openCreateModal}>
            Create your first key
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 3 }}>
        {apiKeys.map((apiKey) => (
          <ApiKeyCard
            key={apiKey.id}
            apiKey={apiKey}
            userRole={user?.role}
            onEdit={() => openEditModal(apiKey)}
            onDelete={() => {
              setSelectedKey(apiKey);
              setIsDeleteModalOpen(true);
            }}
            onToggleDefault={openMarkDefaultModal}
            isSaving={Boolean(savingIds[apiKey.id])}
          />
        ))}
      </Box>
    );
  };

  const headerActions = (
    <Button variant="contained" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={openCreateModal}>
      New API key
    </Button>
  );

  return (
    <PageShell
      title="My API Keys"
      description="Manage your model configurations and programmatic access keys."
      actions={headerActions}
      maxWidth="lg"
    >
      {renderContent()}

      <ApiKeyFormModal
        isOpen={isFormModalOpen}
        mode={formMode}
        canSelectDefault={apiKeys.length > 0}
        userRole={user?.role}
        selectedKey={selectedKey}
        onClose={closeFormModal}
        onSave={handleSaveKey}
        errors={validationErrors}
      />

      <Dialog open={isDeleteModalOpen} onClose={closeDeleteModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 18, fontWeight: 700 }}>
          Delete API Key?
          <IconButton aria-label="close" onClick={closeDeleteModal} sx={{ color: "text.disabled" }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Are you sure you want to delete the key{" "}
            <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
              "{selectedKey?.description}"
            </Box>
            ? This action cannot be undone and any application using this key will stop working immediately.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" color="inherit" onClick={closeDeleteModal} sx={{ borderColor: "divider", color: "text.primary" }}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {isMarkDefaultModalOpen && (
        <ApiKeyMarkDefaultModal
          apiKey={selectedKey}
          onClose={() => {
            setIsMarkDefaultModalOpen(false);
            setSelectedKey(null);
          }}
          onConfirm={confirmMarkDefault}
        />
      )}
      <ToastContainer />
    </PageShell>
  );
};
