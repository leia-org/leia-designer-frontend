import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import BookmarkBorderOutlinedIcon from "@mui/icons-material/BookmarkBorderOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useAuth } from "../context";
import { PageShell } from "../components/shared/PageShell";
import { authApi } from "../lib/axios";

type StatusMessage = { type: "success" | "error"; text: string };

const getRequestMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = error.response as { data?: { message?: unknown } } | undefined;
    if (typeof response?.data?.message === "string") return response.data.message;
  }
  return fallback;
};

export const Profile = () => {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [emailMessage, setEmailMessage] = useState<StatusMessage | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<StatusMessage | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const handleUpdateEmail = async () => {
    if (!email || email === user?.email) {
      setEmailMessage({ type: "error", text: "Please enter a different email" });
      return;
    }
    setLoadingEmail(true);
    setEmailMessage(null);
    try {
      const response = await authApi.put("/api/v1/users/profile/update", { email });
      setUser(response.data);
      setEmailMessage({ type: "success", text: "Email updated successfully!" });
      setIsEditingEmail(false);
    } catch (error: unknown) {
      setEmailMessage({ type: "error", text: getRequestMessage(error, "Failed to update email") });
    } finally {
      setLoadingEmail(false);
    }
  };

  const resetPasswordForm = () => {
    setIsChangingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: "error", text: "Please fill in all password fields" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setLoadingPassword(true);
    setPasswordMessage(null);
    try {
      await authApi.put("/api/v1/users/profile/change-password", { currentPassword, newPassword });
      setPasswordMessage({ type: "success", text: "Password changed successfully!" });
      resetPasswordForm();
    } catch (error: unknown) {
      setPasswordMessage({ type: "error", text: getRequestMessage(error, "Failed to change password") });
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <PageShell
      title="Profile"
      description="View and manage your account information"
      maxWidth="md"
      contentSx={{ maxWidth: 900 }}
    >
      <Stack spacing={3}>
        <Card variant="outlined" sx={{ borderColor: "divider" }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, "&:last-child": { pb: { xs: 2.5, sm: 3.5 } } }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AccountCircleOutlinedIcon sx={{ fontSize: 44, color: "text.disabled" }} />
                <Box>
                  <Typography variant="h6" fontWeight={700}>Account Information</Typography>
                  <Typography variant="body2" color="text.secondary">Personal details and settings</Typography>
                </Box>
              </Stack>
              <Divider />

              <Stack spacing={2.5}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AlternateEmailOutlinedIcon sx={{ fontSize: 20, color: "text.disabled" }} />
                      <Typography variant="subtitle2">Email Address</Typography>
                    </Stack>
                    {!isEditingEmail && (
                      <Button size="small" onClick={() => { setEmailMessage(null); setIsEditingEmail(true); }}>
                        Edit
                      </Button>
                    )}
                  </Stack>
                  {isEditingEmail ? (
                    <Stack spacing={1.5}>
                      <TextField
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        label="Email address"
                        placeholder="Enter new email"
                        fullWidth
                      />
                      <Stack direction="row" spacing={1}>
                        <Button variant="contained" onClick={handleUpdateEmail} disabled={loadingEmail}>
                          {loadingEmail ? <CircularProgress size={18} color="inherit" /> : "Save"}
                        </Button>
                        <Button
                          color="inherit"
                          onClick={() => {
                            setIsEditingEmail(false);
                            setEmail(user?.email || "");
                            setEmailMessage(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography variant="body1">{user?.email}</Typography>
                  )}
                  {emailMessage && (
                    <Alert severity={emailMessage.type} sx={{ mt: 1.5 }}>
                      {emailMessage.text}
                    </Alert>
                  )}
                </Box>

                <Divider />

                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <AccountCircleOutlinedIcon sx={{ fontSize: 20, color: "text.disabled" }} />
                    <Typography variant="subtitle2">Role</Typography>
                  </Stack>
                  <Chip label={user?.role || "User"} color="primary" size="small" sx={{ textTransform: "capitalize" }} />
                </Box>

                <Divider />

                <Link
                  component={RouterLink}
                  to="/leias"
                  underline="hover"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 1, width: "fit-content", fontWeight: 600 }}
                >
                  <BookmarkBorderOutlinedIcon fontSize="small" />
                  My LEIAs
                  <ArrowForwardIcon fontSize="small" />
                </Link>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderColor: "divider" }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, "&:last-child": { pb: { xs: 2.5, sm: 3.5 } } }}>
            <Stack spacing={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <KeyOutlinedIcon sx={{ fontSize: 28, color: "text.disabled" }} />
                  <Box>
                    <Typography variant="h6" fontWeight={700}>Change Password</Typography>
                    {!isChangingPassword && <Typography variant="body2" color="text.secondary">Update your account password.</Typography>}
                  </Box>
                </Stack>
                {!isChangingPassword && <Button size="small" onClick={() => { setPasswordMessage(null); setIsChangingPassword(true); }}>Change</Button>}
              </Stack>

              {isChangingPassword && (
                <Stack spacing={2}>
                  <TextField type="password" label="Current Password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} fullWidth autoComplete="current-password" />
                  <TextField type="password" label="New Password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} helperText="At least 6 characters" fullWidth autoComplete="new-password" />
                  <TextField type="password" label="Confirm New Password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} fullWidth autoComplete="new-password" />
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={handleChangePassword} disabled={loadingPassword}>
                      {loadingPassword ? <CircularProgress size={18} color="inherit" /> : "Change Password"}
                    </Button>
                    <Button color="inherit" onClick={() => { resetPasswordForm(); setPasswordMessage(null); }}>Cancel</Button>
                  </Stack>
                </Stack>
              )}
              {passwordMessage && <Alert severity={passwordMessage.type}>{passwordMessage.text}</Alert>}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </PageShell>
  );
};
