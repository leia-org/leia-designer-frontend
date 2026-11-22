import React, { useEffect, useRef, useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  BEHAVIOUR_PLACEHOLDER_SECTIONS,
  type PlaceholderSection,
} from "../lib/behaviourPlaceholders";

interface BehaviourPlaceholdersInfoButtonProps {
  sections?: readonly PlaceholderSection[];
  title?: string;
}

export const BehaviourPlaceholdersInfoButton: React.FC<BehaviourPlaceholdersInfoButtonProps> = ({
  sections = BEHAVIOUR_PLACEHOLDER_SECTIONS,
  title = "Available {{}} placeholders",
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [activeSection, setActiveSection] = useState<"leia" | "stages">(sections[0]?.id ?? "leia");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const open = Boolean(anchorEl);

  useEffect(() => () => {
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
  }, []);

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard?.writeText(token);
    } catch {
      // Ignore clipboard permission errors in restricted contexts.
    }
    setCopiedToken(token);
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => setCopiedToken(null), 1500);
  };

  const currentSection =
    sections.find((section) => section.id === activeSection) ??
    sections[0];

  return (
    <>
      <Tooltip title={title}>
        <IconButton
          size="small"
          aria-label="Available placeholders cheat sheet"
          aria-expanded={open}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{ p: 0.25, color: "text.secondary" }}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: { width: { xs: 340, sm: 500 }, maxHeight: 440, display: "flex", flexDirection: "column" },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click any placeholder to copy it to the clipboard.
          </Typography>
          <Tabs
            value={currentSection.id}
            onChange={(_, value: "leia" | "stages") => setActiveSection(value)}
            aria-label="Placeholder categories"
            variant="fullWidth"
            sx={{ mt: 1, minHeight: 36, borderBottom: 1, borderColor: "divider" }}
          >
            {sections.map((section) => (
              <Tab
                key={section.id}
                value={section.id}
                label={section.label}
                sx={{ minHeight: 36, py: 0.5, textTransform: "none", fontSize: "0.8125rem" }}
              />
            ))}
          </Tabs>
        </Box>
        <Stack spacing={1.5} sx={{ px: 2, py: 1.5, overflowY: "auto" }}>
          {currentSection.groups.map((group, groupIndex) => (
            <React.Fragment key={group.title}>
              {groupIndex > 0 && <Divider />}
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase" }}>
                  {group.title}
                </Typography>
                <Stack spacing={1} sx={{ mt: 0.75 }}>
                  {group.items.map((item) => {
                    const isCopied = copiedToken === item.token;
                    return (
                      <Stack key={item.token} spacing={0.25} alignItems="flex-start">
                        <Button
                          type="button"
                          size="small"
                          onClick={() => void handleCopyToken(item.token)}
                          aria-label={`Copy ${item.token}`}
                          endIcon={isCopied ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                          sx={{
                            px: 0.75,
                            py: 0.25,
                            minWidth: 0,
                            maxWidth: "100%",
                            justifyContent: "flex-start",
                            borderRadius: 0.75,
                            bgcolor: isCopied ? "success.light" : "#F3E8FF",
                            color: isCopied ? "success.contrastText" : "#7E22CE",
                            fontSize: "0.75rem",
                            fontFamily: "'JetBrains Mono Variable', monospace",
                            textTransform: "none",
                            textAlign: "left",
                            overflowWrap: "anywhere",
                            "&:hover": {
                              bgcolor: isCopied ? "success.main" : "#E9D5FF",
                            },
                          }}
                        >
                          {isCopied ? "Copied!" : item.token}
                        </Button>
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 0.25 }}>
                          {item.description}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            </React.Fragment>
          ))}
        </Stack>
      </Popover>
    </>
  );
};
