import type React from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Link as MuiLink,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import type { ApiKey } from "../../models/ApiKeys";

interface ApiKeyCardProps {
  apiKey: ApiKey;
  userRole: string | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault?: (apiKey: ApiKey) => void;
  isSaving?: boolean;
}

const MetaRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}> = ({ icon, label, children }) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start">
    <Box sx={{ color: "text.disabled", display: "flex", mt: 0.25 }}>{icon}</Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="overline" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.25, minWidth: 0 }}>{children}</Box>
    </Box>
  </Stack>
);

const actionButtonSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1.5,
  color: "text.secondary",
  bgcolor: "background.paper",
};

export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({
  apiKey,
  onEdit,
  userRole,
  onDelete,
  onToggleDefault,
  isSaving = false,
}) => {
  const canManage = !apiKey.isSystemApiKey || userRole === "admin";

  return (
    <Card
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        borderColor: "divider",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        "&:hover": { boxShadow: 2, borderColor: "#D6D3D1" },
      }}
    >
      <CardContent
        sx={{
          p: { xs: 2, sm: 3 },
          display: "flex",
          flexDirection: "column",
          flex: 1,
          "&:last-child": { pb: { xs: 2, sm: 3 } },
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
          sx={{ mb: 2.5 }}
        >
          <Box sx={{ minWidth: 0, overflow: "hidden" }}>
            <Typography
              variant="h6"
              title={apiKey.description}
              sx={{
                fontWeight: 700,
                color: "text.primary",
                mb: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {apiKey.description}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={apiKey.isActive ? "Active" : "Inactive"}
                icon={
                  <Box
                    component="span"
                    aria-hidden
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: apiKey.isActive ? "success.main" : "text.disabled",
                    }}
                  />
                }
                sx={{
                  height: 22,
                  fontSize: 11,
                  fontWeight: 500,
                  bgcolor: apiKey.isActive ? "rgba(22,163,74,0.08)" : "surfaces.subtle",
                  color: apiKey.isActive ? "success.main" : "text.secondary",
                  "& .MuiChip-icon": { ml: 1, mr: -0.25 },
                }}
              />
              {apiKey.isDefault && (
                <Chip
                  size="small"
                  label="Default"
                  sx={{
                    height: 22,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    bgcolor: "surfaces.accent",
                    color: "primary.dark",
                  }}
                />
              )}
              {apiKey.isSystemApiKey && (
                <Chip
                  size="small"
                  label="System"
                  sx={{
                    height: 22,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    bgcolor: "surfaces.subtle",
                    color: "warning.main",
                  }}
                />
              )}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Tooltip title={apiKey.isDefault ? "Unmark Default" : "Mark as Default"}>
              <span>
                <IconButton
                  onClick={() => onToggleDefault?.(apiKey)}
                  disabled={isSaving}
                  size="small"
                  sx={{
                    ...actionButtonSx,
                    "&:hover": {
                      color: "warning.main",
                      borderColor: "warning.main",
                      bgcolor: "rgba(217,119,6,0.06)",
                    },
                  }}
                >
                  {isSaving ? (
                    <CircularProgress size={20} sx={{ color: "text.secondary" }} />
                  ) : apiKey.isDefault ? (
                    <StarIcon sx={{ fontSize: 20, color: "warning.main" }} />
                  ) : (
                    <StarBorderOutlinedIcon sx={{ fontSize: 20, color: "text.disabled" }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            {canManage && (
              <>
                <Tooltip title="Edit API Key">
                  <IconButton
                    onClick={onEdit}
                    size="small"
                    sx={{
                      ...actionButtonSx,
                      "&:hover": {
                        color: "primary.main",
                        borderColor: "primary.main",
                        bgcolor: "surfaces.accent",
                      },
                    }}
                  >
                    <EditOutlinedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete API Key">
                  <IconButton
                    onClick={onDelete}
                    size="small"
                    sx={{
                      ...actionButtonSx,
                      "&:hover": {
                        color: "error.main",
                        borderColor: "error.main",
                        bgcolor: "rgba(220,38,38,0.06)",
                      },
                    }}
                  >
                    <DeleteOutlinedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        <Stack spacing={2.5} sx={{ flex: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: "block" }}>
              API Key Value
            </Typography>
            <Box
              sx={{
                mt: 0.75,
                p: 1.25,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "surfaces.subtle",
              }}
            >
              <Typography
                className="mono"
                sx={{ color: "text.primary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {apiKey.keyValue}
              </Typography>
            </Box>
          </Box>

          <Stack
            spacing={2}
            sx={{ p: 2, borderRadius: 1.5, border: "1px solid", borderColor: "divider", bgcolor: "surfaces.subtle" }}
          >
            <MetaRow icon={<ViewInArOutlinedIcon sx={{ fontSize: 20 }} />} label="API Key Provider">
              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", overflowWrap: "anywhere" }}>
                {apiKey.provider}
              </Typography>
            </MetaRow>
            {apiKey.model && (
              <MetaRow icon={<MemoryOutlinedIcon sx={{ fontSize: 20 }} />} label="Default Model">
                <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", overflowWrap: "anywhere" }}>
                  {apiKey.model}
                </Typography>
              </MetaRow>
            )}
            {apiKey.baseUrl && (
              <MetaRow icon={<LinkOutlinedIcon sx={{ fontSize: 20 }} />} label="Base URL">
                <MuiLink
                  href={apiKey.baseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{ display: "block", fontSize: 14, color: "primary.main", overflowWrap: "anywhere" }}
                >
                  {apiKey.baseUrl}
                </MuiLink>
              </MetaRow>
            )}
            {apiKey.managementUrl && (
              <MetaRow icon={<LinkOutlinedIcon sx={{ fontSize: 20 }} />} label="Management URL">
                <MuiLink
                  href={apiKey.managementUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{ display: "block", fontSize: 14, color: "primary.main", overflowWrap: "anywhere" }}
                >
                  {apiKey.managementUrl}
                </MuiLink>
              </MetaRow>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
