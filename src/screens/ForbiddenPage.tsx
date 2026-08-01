import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { useAuth } from "../context";

export const ForbiddenPage = () => {
  const { logout } = useAuth();

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        placeItems: "center",
        p: 3,
        bgcolor: "background.default",
      }}
    >
      <Stack spacing={3} alignItems="center" sx={{ width: "100%", maxWidth: 460 }}>
        <WarningAmberRoundedIcon sx={{ fontSize: 64, color: "error.main" }} />
        <Stack spacing={0.5} textAlign="center">
          <Typography variant="h4" fontWeight={700}>Access Denied</Typography>
          <Typography variant="body2" color="text.secondary">Error 403 — Forbidden</Typography>
        </Stack>
        <Paper variant="outlined" sx={{ width: "100%", p: { xs: 3, sm: 4 }, borderColor: "divider" }}>
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>Administrator Access Required</Typography>
              <Typography variant="body2" color="text.secondary">
                You don't have sufficient permissions to access this resource. This page requires administrator privileges.
              </Typography>
            </Box>
            <Stack spacing={1.5} width="100%">
              <Button component={RouterLink} to="/" variant="contained" fullWidth startIcon={<HomeOutlinedIcon />}>
                Go to Home
              </Button>
              <Button onClick={logout} variant="outlined" color="inherit" fullWidth startIcon={<LogoutOutlinedIcon />}>
                Switch Account
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};
