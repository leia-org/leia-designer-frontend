import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DraftsOutlinedIcon from "@mui/icons-material/DraftsOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { useAuth } from "../../context";

export const DESIGNER_SIDEBAR_WIDTH = 240;

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  show?: boolean;
  matches?: (pathname: string) => boolean;
}

const groupLabelSx = {
  display: "block",
  px: 2,
  pt: 3,
  pb: 1,
};

const itemButtonSx = (selected: boolean) => ({
  minHeight: 32,
  mx: 1,
  px: 1.25,
  borderRadius: "6px",
  position: "relative" as const,
  color: selected ? "primary.dark" : "text.primary",
  bgcolor: selected ? "surfaces.selected" : "transparent",
  "&:hover": {
    bgcolor: selected ? "surfaces.selected" : "surfaces.hover",
  },
  "&::before": selected
    ? {
        content: '""',
        position: "absolute",
        left: 0,
        top: 6,
        bottom: 6,
        width: 2,
        borderRadius: 2,
        bgcolor: "primary.main",
      }
    : {},
  "& .MuiListItemIcon-root": {
    minWidth: 28,
    color: selected ? "primary.main" : "text.secondary",
  },
  "& .MuiListItemText-primary": {
    fontSize: 13,
    fontWeight: selected ? 600 : 500,
  },
});

export function DesignerSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const workspaceItems: NavigationItem[] = [
    {
      label: "LEIA library",
      path: "/",
      icon: <LibraryBooksOutlinedIcon sx={{ fontSize: 18 }} />,
      matches: (pathname) => pathname === "/" || pathname.startsWith("/chat/") || pathname.startsWith("/edit/"),
    },
    {
      label: "Continue drafts",
      path: "/drafts",
      icon: <DraftsOutlinedIcon sx={{ fontSize: 18 }} />,
      matches: (pathname) => pathname.startsWith("/drafts"),
    },
    {
      label: "Design",
      path: "/create",
      icon: <AddCircleOutlineIcon sx={{ fontSize: 18 }} />,
      matches: (pathname) => pathname.startsWith("/create"),
    },
    {
      label: "Activities",
      path: "/users/me/activities",
      icon: <ExtensionOutlinedIcon sx={{ fontSize: 18 }} />,
      show: user?.role === "admin" || user?.role === "advanced",
      matches: (pathname) => pathname.startsWith("/users/me/activities"),
    },
  ];

  const accountItems: NavigationItem[] = [
    {
      label: "Profile",
      path: "/profile",
      icon: <PersonOutlineIcon sx={{ fontSize: 18 }} />,
      matches: (pathname) => pathname.startsWith("/profile"),
    },
    {
      label: "API keys",
      path: "/api-keys",
      icon: <VpnKeyOutlinedIcon sx={{ fontSize: 18 }} />,
      matches: (pathname) => pathname.startsWith("/api-keys"),
    },
    {
      label: "Users",
      path: "/administration/users",
      icon: <PeopleOutlineIcon sx={{ fontSize: 18 }} />,
      show: user?.role === "admin",
      matches: (pathname) => pathname.startsWith("/administration/users"),
    },
  ];

  const renderItem = (item: NavigationItem) => {
    if (item.show === false) return null;
    const selected = item.matches?.(location.pathname) ?? location.pathname === item.path;
    return (
      <ListItem key={item.path} disablePadding sx={{ display: "block" }}>
        <ListItemButton
          aria-current={selected ? "page" : undefined}
          onClick={() => navigate(item.path)}
          sx={itemButtonSx(selected)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: { xs: 0, md: DESIGNER_SIDEBAR_WIDTH },
        flexShrink: 0,
        display: { xs: "none", md: "block" },
        "& .MuiDrawer-paper": {
          width: DESIGNER_SIDEBAR_WIDTH,
          boxSizing: "border-box",
          bgcolor: "surfaces.sidebar",
          borderRight: "1px solid",
          borderColor: "divider",
          boxShadow: "none",
        },
      }}
    >
      <Box
        sx={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          boxSizing: "border-box",
        }}
      >
        <Box component="img" src="/logo/leia_main_dark.png" alt="LEIA" sx={{ width: 22, height: 22, objectFit: "contain" }} />
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            LEIA
          </Typography>
          <Typography sx={{ fontSize: 10, color: "text.secondary", lineHeight: 1.2, mt: 0.25 }}>
            Designer
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100% - 56px)", overflow: "hidden" }}>
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          <Typography variant="overline" sx={groupLabelSx}>Workspace</Typography>
          <List dense disablePadding>{workspaceItems.map(renderItem)}</List>

          <Typography variant="overline" sx={groupLabelSx}>Account</Typography>
          <List dense disablePadding>{accountItems.map(renderItem)}</List>
        </Box>

        <Box sx={{ borderTop: "1px solid", borderColor: "divider", py: 1 }}>
          {user?.email && (
            <Typography noWrap sx={{ display: "block", px: 2.25, pb: 1, fontSize: 11, color: "text.secondary" }}>
              {user.email}
            </Typography>
          )}
          <List dense disablePadding>
            <ListItem disablePadding sx={{ display: "block" }}>
              <ListItemButton
                onClick={logout}
                sx={{
                  ...itemButtonSx(false),
                  "&:hover": {
                    bgcolor: "rgba(220, 38, 38, 0.06)",
                    color: "error.main",
                    "& .MuiListItemIcon-root": { color: "error.main" },
                  },
                }}
              >
                <ListItemIcon><LogoutOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Box>
    </Drawer>
  );
}
