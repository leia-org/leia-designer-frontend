import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import { useAuth } from "../../context/useAuth";

interface NavigationItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  show?: boolean;
  onClick?: () => void;
  id?: string;
}

interface HeaderProps {
  title: string;
  description: string;
  rightContent?: React.ReactNode;
  leftContent?: React.ReactNode;
  leadingContent?: React.ReactNode;
  menuItems?: NavigationItem[];
  showNavigation?: boolean;
  dropdownTour?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  description,
  rightContent,
  leftContent,
  leadingContent,
  menuItems,
  showNavigation = true,
  dropdownTour = false,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuAnchor(dropdownTour ? menuButtonRef.current : null);
  }, [dropdownTour]);

  const defaultMenuItems: NavigationItem[] = [
    {
      label: "Profile",
      href: "/profile",
      icon: <PeopleOutlineIcon fontSize="small" />,
      show: true,
      id: "profile-button",
    },
    {
      label: "Manage labels",
      href: "/administration/labels",
      icon: <LabelOutlinedIcon fontSize="small" />,
      show: user?.role === "admin",
      id: "manageLabels-button",
    },
    {
      label: "Logout",
      icon: <LogoutOutlinedIcon fontSize="small" />,
      show: true,
      id: "logout-button",
      onClick: logout,
    },
  ];

  const visibleItems = showNavigation
    ? (menuItems ?? defaultMenuItems).filter((item) => item.show !== false)
    : [];

  const closeMenu = () => setMenuAnchor(null);

  const handleItemClick = (item: NavigationItem) => {
    item.onClick?.();
    if (item.href) navigate(item.href);
    closeMenu();
  };

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        height: 56,
        minHeight: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 2, md: 4 },
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        {leadingContent}
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.1 }}>
          <Typography variant="h6" noWrap>{title}</Typography>
          {description && (
            <Typography noWrap sx={{ display: { xs: "none", sm: "block" }, mt: 0.25, fontSize: 12, color: "text.secondary" }}>
              {description}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flexShrink: 0 }}>
        {leftContent}
        {rightContent}
        {visibleItems.length > 0 && (
          <>
            <Tooltip title="Account menu">
              <IconButton
                ref={menuButtonRef}
                id="navigation-menu"
                aria-label="Account menu"
                aria-controls={menuAnchor ? "designer-navigation-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={Boolean(menuAnchor)}
                onClick={(event) => setMenuAnchor(event.currentTarget)}
                size="small"
                sx={{ ml: 0.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, gap: 0.25, px: 0.5 }}
              >
                <Avatar sx={{ width: 24, height: 24, bgcolor: "surfaces.accent", color: "primary.dark", fontSize: 11, fontWeight: 700 }}>
                  {user?.email?.slice(0, 1).toUpperCase() ?? "U"}
                </Avatar>
                <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              </IconButton>
            </Tooltip>
            <Menu
              id="designer-navigation-menu"
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={closeMenu}
              MenuListProps={{ "aria-labelledby": "navigation-menu" }}
              slotProps={{ paper: { sx: { minWidth: 200, mt: 1, border: "1px solid", borderColor: "divider" } } }}
            >
              {user?.email && <Typography noWrap sx={{ px: 2, py: 1, fontSize: 12, color: "text.secondary", maxWidth: 240 }}>{user.email}</Typography>}
              {visibleItems.map((item) => (
                <MenuItem key={item.label} id={item.id} onClick={() => handleItemClick(item)}>
                  {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                  <ListItemText primary={item.label} />
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Box>
    </Box>
  );
};
