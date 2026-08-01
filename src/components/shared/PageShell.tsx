import type { PropsWithChildren, ReactNode } from "react";
import { Box, Container, type SxProps, type Theme } from "@mui/material";
import { Header } from "./Header";

interface PageShellProps extends PropsWithChildren {
  title: string;
  description: string;
  actions?: ReactNode;
  leftContent?: ReactNode;
  showNavigation?: boolean;
  dropdownTour?: boolean;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  contentSx?: SxProps<Theme>;
  flush?: boolean;
}

/**
 * Shared Material UI frame for Designer pages. It keeps the navigation and
 * content rhythm consistent while allowing feature screens to own their data
 * and interactions.
 */
export function PageShell({
  title,
  description,
  actions,
  leftContent,
  showNavigation,
  dropdownTour,
  maxWidth = "xl",
  contentSx,
  flush = false,
  children,
}: PageShellProps) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <Header
        title={title}
        description={description}
        rightContent={actions}
        leftContent={leftContent}
        showNavigation={showNavigation}
        dropdownTour={dropdownTour}
      />
      <Box component="main" sx={{ flex: 1, minHeight: 0, overflow: flush ? "hidden" : "auto", px: flush ? 0 : { xs: 2, md: 4 }, py: flush ? 0 : { xs: 2, md: 4 }, display: "flex", flexDirection: "column" }}>
        <Container
          maxWidth={maxWidth}
          disableGutters
          sx={{
            ...(flush ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}),
            ...contentSx,
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  );
}
