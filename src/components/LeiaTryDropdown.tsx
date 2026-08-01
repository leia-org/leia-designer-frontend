import type React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Popover,
  Select,
  Stack,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import type { ApiKey } from "../models/ApiKeys";
import openAiIcon from "../assets/providers/openai.svg";
import geminiIcon from "../assets/providers/gemini.svg";
import ollamaIcon from "../assets/providers/ollama.svg";

const providerIcons: Record<string, string> = {
  openai: openAiIcon,
  gemini: geminiIcon,
  ollama: ollamaIcon,
};

interface LeiaTryDropdownProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  isLoading: boolean;
  providersError?: string | null;
  apiKeysError?: string | null;
  modelValue: string;
  models: string[];
  apiKeys: ApiKey[];
  apiKeyValue: string | null;
  apiKeyProvidersMapped: Record<string, string[]>;
  toolsRestricted?: boolean;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  canStart: boolean;
  onStart: () => void;
  isStarting: boolean;
  showNoApiKeys: boolean;
  showNoMatchingKeys: boolean;
  heading?: string;
  startLabel?: string;
}

export const LeiaTryDropdown: React.FC<LeiaTryDropdownProps> = ({
  isOpen,
  anchorEl,
  onClose,
  isLoading,
  providersError,
  apiKeysError,
  modelValue,
  models,
  apiKeys,
  apiKeyValue,
  apiKeyProvidersMapped,
  toolsRestricted,
  onModelChange,
  onApiKeyChange,
  canStart,
  onStart,
  isStarting,
  showNoApiKeys,
  showNoMatchingKeys,
  heading = "Try settings",
  startLabel = "Start",
}) => {
  return (
    <Popover
      open={isOpen && Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      marginThreshold={12}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-label": heading,
          sx: {
            width: { xs: "calc(100vw - 32px)", sm: 320 },
            maxWidth: "calc(100vw - 32px)",
            p: 2,
            mt: 1,
            border: 1,
            borderColor: "divider",
            boxShadow: 8,
          },
        },
      }}
    >
        <Stack spacing={1.5}>
          <Typography variant="overline">{heading}</Typography>
          {toolsRestricted && (
            <Alert severity="warning" icon={false} sx={{ py: 0.5, "& .MuiAlert-message": { fontSize: 12 } }}>
              This activity uses widgets, so its tool-functions only run on a tool-capable provider. Only OpenAI models are available here.
            </Alert>
          )}
          <FormControl fullWidth size="small" disabled={isLoading}>
            <InputLabel id="try-model-label">Model</InputLabel>
            <Select
              labelId="try-model-label"
              label="Model"
              value={modelValue}
              onChange={(event: SelectChangeEvent<string>) => onModelChange(event.target.value)}
            >
              <MenuItem value="">{isLoading ? "Loading models..." : "-- Select model --"}</MenuItem>
              {models.map((model) => {
                const provider = Object.entries(apiKeyProvidersMapped).find(([, providerModels]) =>
                  providerModels.includes(model),
                )?.[0];
                const icon = provider ? providerIcons[provider.toLowerCase()] : undefined;

                return (
                  <MenuItem key={model} value={model}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {icon && <Box component="img" src={icon} alt="" sx={{ width: 18, height: 18 }} />}
                      <span>{model}</span>
                    </Stack>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" disabled={isLoading}>
            <InputLabel id="try-api-key-label">API Key</InputLabel>
            <Select
              labelId="try-api-key-label"
              label="API Key"
              value={apiKeyValue || ""}
              onChange={(event: SelectChangeEvent<string>) => onApiKeyChange(event.target.value)}
            >
              <MenuItem value="">{isLoading ? "Loading keys..." : "-- Select API key --"}</MenuItem>
              {apiKeys.map((apiKey) => <MenuItem key={apiKey.id} value={apiKey.id}>{apiKey.description}</MenuItem>)}
            </Select>
          </FormControl>
          {(providersError || apiKeysError) && <Alert severity="error">{providersError || apiKeysError}</Alert>}
          {showNoApiKeys && (
            <Box>
              <Typography variant="body2" color="text.secondary">No API keys available for your account.</Typography>
              <Link component={RouterLink} to="/api-keys" onClick={onClose} variant="body2" fontWeight={600}>
                Create API key
              </Link>
            </Box>
          )}
          {showNoMatchingKeys && <Alert severity="warning">No API keys match the selected model.</Alert>}
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button color="inherit" onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={onStart} disabled={!canStart || isStarting}>
              {isStarting ? "Starting..." : startLabel}
            </Button>
          </Stack>
        </Stack>
    </Popover>
  );
};
