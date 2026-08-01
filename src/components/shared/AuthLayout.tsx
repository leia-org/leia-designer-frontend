import type { PropsWithChildren, ReactNode } from "react";
import { Box, Typography } from "@mui/material";

interface AuthLayoutProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <Box
      sx={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" }, bgcolor: "background.default" }}
    >
      <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", justifyContent: "space-between", p: 6, color: "common.white", bgcolor: "#0B1A3D" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box component="img" src="/logo/leia_main_white.png" alt="LEIA" sx={{ width: 22, height: 22, objectFit: "contain" }} />
          <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>LEIA</Typography>
        </Box>
        <Box sx={{ maxWidth: 500 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", mb: 2 }}>
            LEIA Designer
          </Typography>
          <Typography sx={{ fontSize: 42, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.035em", mb: 2.5 }}>
            Design better learning experiences.
          </Typography>
          <Typography sx={{ fontSize: 16, lineHeight: 1.55, color: "rgba(255,255,255,0.7)" }}>
            Create, configure, test, and manage your LEIA experiences from one focused workspace.
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>© LEIA Designer</Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 11, mt: 0.25 }}>Developed by the LEIA Team</Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", px: { xs: 3, md: 8 }, py: { xs: 6, md: 4 }, bgcolor: "background.paper" }}>
        <Box sx={{ width: "100%", maxWidth: 420 }}>
          <Typography sx={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, mb: 1 }}>{title}</Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary", lineHeight: 1.55, mb: 4.5 }}>
            {subtitle ?? "Sign in to design, test, and manage your LEIAs."}
          </Typography>
          {children}
          {footer && <Box sx={{ mt: 3 }}>{footer}</Box>}
        </Box>
      </Box>
    </Box>
  );
}
