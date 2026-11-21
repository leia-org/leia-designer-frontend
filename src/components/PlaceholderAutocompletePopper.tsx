import React from "react";
import { ListItemButton, Paper, Popper, Typography } from "@mui/material";
import type { AutocompleteSuggestion } from "../hooks/usePlaceholderAutocomplete";

interface PlaceholderAutocompletePopperProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  suggestions: readonly AutocompleteSuggestion[];
  activeIndex: number;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
}

export const PlaceholderAutocompletePopper: React.FC<PlaceholderAutocompletePopperProps> = ({
  open,
  anchorEl,
  suggestions,
  activeIndex,
  onSelect,
}) => (
  <Popper
    open={open && Boolean(anchorEl)}
    anchorEl={anchorEl}
    placement="bottom-start"
    sx={{ zIndex: 1400 }}
    modifiers={[
      { name: "offset", options: { offset: [0, 4] } },
      { name: "preventOverflow", options: { padding: 8 } },
    ]}
  >
    <Paper
      role="listbox"
      aria-label="Placeholder suggestions"
      elevation={6}
      sx={{
        width: { xs: 280, sm: 360 },
        maxWidth: "calc(100vw - 32px)",
        maxHeight: 220,
        overflowY: "auto",
        border: 1,
        borderColor: "divider",
      }}
    >
      {suggestions.map((item, index) => (
        <ListItemButton
          key={item.key}
          role="option"
          aria-selected={index === activeIndex}
          selected={index === activeIndex}
          dense
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(item)}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            py: 0.75,
            px: 1.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontFamily: "'JetBrains Mono Variable', monospace",
              color: "#7E22CE",
              fontWeight: 600,
            }}
          >
            {item.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.description}
          </Typography>
        </ListItemButton>
      ))}
    </Paper>
  </Popper>
);
