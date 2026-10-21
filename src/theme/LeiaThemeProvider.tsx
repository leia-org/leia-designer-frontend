import type { PropsWithChildren } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import { leiaTheme } from "./leiaTheme";

export function LeiaThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={leiaTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
