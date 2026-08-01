import { useRef, useState } from "react";
import { Editor, loader } from "@monaco-editor/react";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Box, Chip, IconButton, Paper, Popper, Stack, Typography } from "@mui/material";
import { useAuth } from "../context";
import type { User } from "../models/User";
import { Avatar } from "./shared/Avatar";

loader.init().then((monaco) => {
  if (!monaco.languages.getLanguages().find((language: { id: string }) => language.id === "yaml")) {
    monaco.languages.register({ id: "yaml" });
  }
});

interface LeiaCardProps {
  title: string;
  description: string;
  version: string;
  selected?: boolean;
  yaml?: string;
  onClick?: () => void;
  user?: User;
  isPublished?: boolean;
  hideContentForInstructor?: boolean;
  onDelete?: () => void;
  resourceId?: string;
  avatar?: string | null;
  fallbackAvatar?: string | null;
  showAvatar?: boolean;
}

export default function LeiaCard({
  title,
  description,
  version,
  selected = false,
  yaml,
  onClick,
  user,
  isPublished = false,
  hideContentForInstructor = false,
  onDelete,
  resourceId,
  avatar,
  fallbackAvatar,
  showAvatar = false,
}: LeiaCardProps) {
  const [showPopup, setShowPopup] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();

  const canDelete =
    currentUser &&
    onDelete &&
    resourceId &&
    (currentUser.role === "admin" || (user && currentUser.id === user.id));

  const roleLabel =
    user?.role === "admin"
      ? "Administrator"
      : user?.role === "advanced"
        ? "Advanced"
        : "Instructor";
  const roleColor =
    user?.role === "admin" ? "secondary.main" : user?.role === "advanced" ? "primary.main" : "success.main";

  return (
    <Box
      ref={cardRef}
      onMouseEnter={() => !hideContentForInstructor && setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      <Paper
        variant="outlined"
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(event) => {
          if (onClick && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onClick();
          }
        }}
        sx={{
          p: 2,
          cursor: onClick ? "pointer" : "default",
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? "primary.main" : "divider",
          bgcolor: selected ? "surfaces.selected" : "background.paper",
          transition: (theme) => theme.transitions.create(["border-color", "background-color"]),
          "&:hover": onClick
            ? { borderColor: selected ? "primary.main" : "primary.light" }
            : undefined,
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          {showAvatar && (
            <Avatar
              src={avatar}
              fallbackSrc={fallbackAvatar}
              alt={`${title} avatar`}
              label={title}
              size="md"
            />
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Typography variant="subtitle2" sx={{ pr: 1 }}>
                {title}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
                <Chip label={`v${version}`} size="small" />
                {user && (
                  <Chip
                    label={isPublished ? "Published" : "Unpublished"}
                    size="small"
                    color={isPublished ? "success" : "warning"}
                    variant="outlined"
                  />
                )}
                {canDelete && (
                  <IconButton
                    aria-label="Delete resource"
                    color="error"
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete?.();
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </Stack>

            {user?.email && user.role && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {user.email}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: roleColor }} />
                  <Typography variant="caption" color="text.secondary">
                    {roleLabel}
                  </Typography>
                </Stack>
              </Stack>
            )}

            {!hideContentForInstructor && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: user?.email && user.role ? 1 : 1.25, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {description}
              </Typography>
            )}

            {selected && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.5, color: "primary.main" }}>
                <CheckIcon fontSize="small" />
                <Typography variant="body2" fontWeight={600}>
                  Selected
                </Typography>
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>

      <Popper
        open={showPopup && Boolean(yaml) && !hideContentForInstructor}
        anchorEl={cardRef.current}
        placement="right"
        sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
      >
        <Paper sx={{ width: 500, height: 300, p: 1, bgcolor: "#1E1E1E", overflow: "hidden" }}>
          <Editor
            height="100%"
            language="yaml"
            theme="vs-dark"
            value={yaml}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "off",
              folding: false,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 0,
              renderLineHighlight: "none",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              contextmenu: false,
              hover: { enabled: false },
              links: false,
              occurrencesHighlight: "off",
              renderValidationDecorations: "off",
              selectionHighlight: false,
            }}
            beforeMount={(monaco) => {
              if (!monaco.languages.getLanguages().find((language: { id: string }) => language.id === "yaml")) {
                monaco.languages.register({ id: "yaml" });
              }
            }}
          />
        </Paper>
      </Popper>
    </Box>
  );
}
