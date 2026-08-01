import type React from "react";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { ApiKey } from "../../models/ApiKeys";
import { useProviders } from "../../hooks/useProviders";
import openAiIcon from "../../assets/providers/openai.svg";
import geminiIcon from "../../assets/providers/gemini.svg";
import ollamaIcon from "../../assets/providers/ollama.svg";

const providerIcons: Record<string, string> = {
  openai: openAiIcon,
  gemini: geminiIcon,
  ollama: ollamaIcon,
};

export interface ApiKeyFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  selectedKey: ApiKey | null;
  canSelectDefault?: boolean;
  userRole?: string;
  onClose: () => void;
  onSave: (formData: Partial<ApiKey>) => Promise<void>;
  errors?: Record<string, string>;
}

const emptyKey = (): Partial<ApiKey> => ({
  description: "",
  keyValue: "",
  provider: "",
  model: "",
  isActive: true,
  baseUrl: "",
  managementUrl: "",
  isDefault: false,
  isSystemApiKey: false,
});

export const ApiKeyFormModal: React.FC<ApiKeyFormModalProps> = ({
  isOpen,
  mode,
  selectedKey,
  canSelectDefault = false,
  userRole,
  onClose,
  onSave,
  errors = {},
}) => {
  const [formData, setFormData] = useState<Partial<ApiKey>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { apiKeysProviderSet, apiKeyProvidersMapped, isLoading: isLoadingProviders } = useProviders();
  const providerModels = (formData.provider && apiKeyProvidersMapped[formData.provider]) || [];

  useEffect(() => {
    if (!isOpen) return;
    setFormData(mode === "edit" && selectedKey ? { ...selectedKey, keyValue: "" } : emptyKey());
  }, [isOpen, mode, selectedKey]);

  const updateValue = <K extends keyof ApiKey>(name: K, value: ApiKey[K]) => {
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    updateValue(name as keyof ApiKey, value as never);
  };

  const handleProviderChange = (event: SelectChangeEvent<string>) => {
    const provider = event.target.value;
    setFormData((current) => ({ ...current, provider, model: "" }));
  };

  const handleStatusChange = (event: SelectChangeEvent<string>) => {
    updateValue("isActive", event.target.value === "Active");
  };

  const handleModelChange = (event: SelectChangeEvent<string>) => {
    updateValue("model", event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({ ...formData });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="h6" component="span">
          {mode === "create" ? "Add New API Key" : "Edit API Key"}
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="Close"
          size="small"
          sx={{ color: "text.disabled", "&:hover": { color: "text.secondary" } }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <TextField
              label="Key Name (Description)"
              name="description"
              value={formData.description || ""}
              onChange={handleTextChange}
              placeholder="e.g. Production Key"
              required
              fullWidth
              error={Boolean(errors.description)}
              helperText={errors.description}
            />
            <TextField
              label="API Key Value"
              name="keyValue"
              value={formData.keyValue || ""}
              onChange={handleTextChange}
              placeholder={mode === "create" ? "sk-..." : "Leave blank to keep current"}
              required={mode === "create"}
              fullWidth
              error={Boolean(errors.keyValue)}
              helperText={errors.keyValue}
              slotProps={{ input: { sx: { fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" } } }}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth required error={Boolean(errors.provider)} disabled={isLoadingProviders}>
                <InputLabel id="api-key-provider-label">API Key Type</InputLabel>
                <Select
                  labelId="api-key-provider-label"
                  label="API Key Type"
                  value={formData.provider || ""}
                  onChange={handleProviderChange}
                  displayEmpty
                  renderValue={(selected) =>
                    selected || (
                      <Typography component="span" sx={{ color: "text.disabled" }}>
                        {isLoadingProviders ? "Loading providers..." : "Select a provider"}
                      </Typography>
                    )
                  }
                >
                  {apiKeysProviderSet.map((provider) => (
                    <MenuItem key={provider} value={provider}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {providerIcons[provider.toLowerCase()] && (
                          <Box
                            component="img"
                            src={providerIcons[provider.toLowerCase()]}
                            alt=""
                            sx={{ width: 20, height: 20, objectFit: "contain" }}
                          />
                        )}
                        <span>{provider}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
                {errors.provider && (
                  <Typography variant="caption" sx={{ color: "error.main", mt: 0.5, ml: 1.75 }}>
                    {errors.provider}
                  </Typography>
                )}
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="api-key-status-label">Status</InputLabel>
                <Select
                  labelId="api-key-status-label"
                  label="Status"
                  value={formData.isActive ? "Active" : "Inactive"}
                  onChange={handleStatusChange}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <FormControl
              fullWidth
              required
              error={Boolean(errors.model)}
              disabled={!formData.provider || isLoadingProviders || providerModels.length === 0}
            >
              <InputLabel id="api-key-model-label">Default Model</InputLabel>
              <Select
                labelId="api-key-model-label"
                label="Default Model"
                value={formData.model || ""}
                onChange={handleModelChange}
              >
                <MenuItem value="" disabled>
                  {!formData.provider
                    ? "Select a provider first"
                    : providerModels.length === 0
                      ? "No models for this provider"
                      : "Select a model"}
                </MenuItem>
                {providerModels.map((model) => (
                  <MenuItem key={model} value={model}>{model}</MenuItem>
                ))}
              </Select>
              <Typography
                variant="caption"
                sx={{ color: errors.model ? "error.main" : "text.secondary", mt: 0.5, ml: 1.75 }}
              >
                {errors.model || "Preselected wherever this key is used (you can still change it there)."}
              </Typography>
            </FormControl>

            <TextField
              label="Base URL (Required for local providers)"
              name="baseUrl"
              type="url"
              value={formData.baseUrl || ""}
              onChange={handleTextChange}
              placeholder="https://..."
              fullWidth
              error={Boolean(errors.baseUrl)}
              helperText={errors.baseUrl}
              slotProps={{ input: { sx: { color: "primary.main" } } }}
            />
            <TextField
              label="Management URL (Optional)"
              name="managementUrl"
              type="url"
              value={formData.managementUrl || ""}
              onChange={handleTextChange}
              placeholder="https://..."
              fullWidth
              slotProps={{ input: { sx: { color: "primary.main" } } }}
            />

            {mode === "create" && canSelectDefault && (
              <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(formData.isDefault)}
                      onChange={(event) => updateValue("isDefault", event.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="subtitle2">Make this the default API Key</Typography>}
                />
                {errors.isDefault && (
                  <Typography variant="caption" sx={{ display: "block", color: "error.main", ml: 3.75 }}>
                    {errors.isDefault}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 3.75 }}>
                  If set, this API key will be used by default for operations that require it.
                </Typography>
              </Box>
            )}

            {mode === "create" && userRole === "admin" && (
              <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(formData.isSystemApiKey)}
                      onChange={(event) => updateValue("isSystemApiKey", event.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="subtitle2">Make this a System API Key</Typography>}
                />
                {errors.isSystemApiKey && (
                  <Typography variant="caption" sx={{ display: "block", color: "error.main", ml: 3.75 }}>
                    {errors.isSystemApiKey}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 3.75 }}>
                  System API keys can be used by all users who have system access enabled.
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button type="button" onClick={onClose} disabled={isSubmitting} color="inherit">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} variant="contained" color="success">
            {isSubmitting ? "Saving..." : mode === "create" ? "Create Key" : "Save Changes"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default ApiKeyFormModal;
