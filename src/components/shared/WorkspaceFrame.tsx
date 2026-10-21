import type { PropsWithChildren } from "react";
import { Box } from "@mui/material";
import { DesignerSidebar } from "./DesignerSidebar";

export function WorkspaceFrame({ children }: PropsWithChildren) {
  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <DesignerSidebar />
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
