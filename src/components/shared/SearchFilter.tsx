import type React from "react";
import { InputAdornment, TextField, type SxProps, type Theme } from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";

interface SearchFilterProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Kept temporarily for older callers while they are migrated to sx. */
  className?: string;
  sx?: SxProps<Theme>;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({ placeholder, value, onChange, sx }) => (
  <TextField
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    aria-label={placeholder}
    fullWidth
    size="small"
    sx={sx}
    slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon color="action" /></InputAdornment> } }}
  />
);
