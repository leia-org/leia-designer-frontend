import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    surfaces: {
      sidebar: string;
      subtle: string;
      hover: string;
      selected: string;
      accent: string;
    };
  }

  interface PaletteOptions {
    surfaces?: {
      sidebar: string;
      subtle: string;
      hover: string;
      selected: string;
      accent: string;
    };
  }
}

export const leiaTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#FAFAF9",
      paper: "#FFFFFF",
    },
    divider: "#E7E5E4",
    text: {
      primary: "#0A0A0A",
      secondary: "#57534E",
      disabled: "#A8A29E",
    },
    primary: {
      main: "#2563EB",
      dark: "#1D4ED8",
      contrastText: "#FFFFFF",
    },
    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    surfaces: {
      sidebar: "#FFFFFF",
      subtle: "#F5F5F4",
      hover: "#F4F4F5",
      selected: "#F1F5FE",
      accent: "#EFF6FF",
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily:
      "'Manrope Variable', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body1: { fontSize: 14, lineHeight: 1.5, fontWeight: 400 },
    body2: { fontSize: 13, lineHeight: 1.45, fontWeight: 400 },
    subtitle2: { fontSize: 14, fontWeight: 600, letterSpacing: 0 },
    caption: {
      fontSize: 12,
      lineHeight: 1.4,
      fontWeight: 400,
      color: "#57534E",
    },
    overline: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0,
      textTransform: "uppercase",
      color: "#A8A29E",
      lineHeight: 1.2,
    },
    h6: { fontSize: 18, fontWeight: 600, letterSpacing: 0 },
    button: { textTransform: "none", fontWeight: 500, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ".mono": {
          fontFamily:
            "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
        },
        body: {
          WebkitUserSelect: "text",
          userSelect: "text",
        },
      },
    },
    MuiButton: {
      defaultProps: { size: "small", disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 6, textTransform: "none", fontWeight: 500 },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 4 } } },
    MuiDrawer: { styleOverrides: { paper: { borderRadius: 0 } } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "transparent" },
    },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
  },
});

export default leiaTheme;
