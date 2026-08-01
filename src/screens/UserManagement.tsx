import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import validator from "validator";
import axios from "axios";
import { authApi } from "../lib/axios";
import { PageShell } from "../components/shared/PageShell";

interface UserResponse {
  id: string;
  email: string;
  role: "admin" | "instructor" | "advanced";
  useSystemApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

type UserFormData = {
  email: string;
  role: UserResponse["role"];
  password: string;
  confirmPassword: string;
  useSystemApiKey: boolean;
};

const emptyForm = (): UserFormData => ({
  email: "",
  role: "instructor",
  password: "",
  confirmPassword: "",
  useSystemApiKey: false,
});

const roleLabel = (role: UserResponse["role"]) => {
  if (role === "admin") return "Administrator";
  if (role === "advanced") return "Advanced";
  return "Instructor";
};

const roleChipSx = (role: UserResponse["role"]) => {
  if (role === "admin") return { bgcolor: "rgba(124,58,237,0.10)", color: "#6D28D9" };
  if (role === "advanced") return { bgcolor: "surfaces.accent", color: "primary.dark" };
  return { bgcolor: "rgba(22,163,74,0.10)", color: "success.main" };
};

export const UserManagement = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authApi.get<UserResponse[]>("/api/v1/users");
      setUsers(response.data);
    } catch (fetchError) {
      console.error("Error fetching users:", fetchError);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const resetForm = (user: UserResponse | null = editingUser) => {
    setFormData(
      user
        ? { email: user.email, role: user.role, password: "", confirmPassword: "", useSystemApiKey: user.useSystemApiKey }
        : emptyForm(),
    );
    setFormErrors({});
    setSubmitMessage("");
    setSubmitSuccess(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const closeUserModal = () => {
    resetForm();
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    resetForm(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserResponse) => {
    setEditingUser(user);
    resetForm(user);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!validator.isEmail(formData.email)) errors.email = "Please enter a valid email address";

    if (!formData.password && !editingUser) errors.password = "Password is required";
    else if (formData.password && formData.password.length < 6) errors.password = "Password must be at least 6 characters";

    if (!formData.confirmPassword && formData.password) errors.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Passwords do not match";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitMessage("");
    try {
      if (editingUser) {
        await authApi.put(`/api/v1/users/${editingUser.id}`, {
          email: formData.email.trim(),
          role: formData.role,
          password: formData.password || undefined,
          useSystemApiKey: formData.useSystemApiKey,
        });
        setSubmitSuccess(true);
        setSubmitMessage("User updated successfully!");
      } else {
        await authApi.post("/api/v1/users", {
          email: formData.email.trim(),
          role: formData.role,
          password: formData.password,
          useSystemApiKey: formData.useSystemApiKey,
        });
        setSubmitSuccess(true);
        setSubmitMessage("User created successfully!");
      }
      window.setTimeout(() => {
        closeUserModal();
        void fetchUsers();
      }, 1200);
    } catch (submitError: unknown) {
      let errorMessage = editingUser
        ? "An error occurred while updating the user"
        : "An error occurred while creating the user";
      if (axios.isAxiosError(submitError) && submitError.response) {
        if (submitError.response.data?.message) {
          errorMessage = submitError.response.data.message;
        } else if (submitError.response.data?.validationErrors) {
          errorMessage = (Object.values(submitError.response.data.validationErrors) as string[]).join(", ");
        }
      }
      setSubmitSuccess(false);
      setSubmitMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetDeleteModal = () => {
    setDeleteConfirmEmail("");
    setDeleteMessage("");
    setDeleteSuccess(false);
  };

  const closeDeleteModal = () => {
    resetDeleteModal();
    setIsDeleteModalOpen(false);
    setDeletingUser(null);
  };

  const openDeleteModal = (user: UserResponse) => {
    setDeletingUser(user);
    resetDeleteModal();
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setDeleteMessage("");
    try {
      await authApi.delete(`/api/v1/users/${deletingUser.id}`);
      setDeleteSuccess(true);
      setDeleteMessage("User deleted successfully!");
      window.setTimeout(() => {
        closeDeleteModal();
        void fetchUsers();
      }, 1200);
    } catch (deleteError: unknown) {
      let errorMessage = "An error occurred while deleting the user";
      if (axios.isAxiosError(deleteError) && deleteError.response?.data?.message) {
        errorMessage = deleteError.response.data.message;
      }
      setDeleteSuccess(false);
      setDeleteMessage(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const passwordAdornment = (visible: boolean, toggle: () => void) => (
    <InputAdornment position="end">
      <IconButton onClick={toggle} edge="end" aria-label="Toggle password visibility">
        {visible ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
      </IconButton>
    </InputAdornment>
  );

  const table = (
    <Paper variant="outlined" sx={{ borderColor: "divider", overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ p: { xs: 2, sm: 2.5 }, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <GroupOutlinedIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Users</Typography>
        </Stack>
        <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={openCreateModal}>
          Add User
        </Button>
      </Stack>
      <TableContainer>
        <Table sx={{ minWidth: 760 }}>
          <TableHead sx={{ bgcolor: "surfaces.subtle" }}>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Creation Date</TableCell>
              <TableCell>System API Key</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 36, height: 36, bgcolor: "surfaces.subtle", color: "text.secondary", fontSize: 14, fontWeight: 700 }}>
                      {user.email.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{user.email}</Typography>
                      <Typography variant="caption" className="mono" noWrap>ID: {user.id}</Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell><Chip label={roleLabel(user.role)} size="small" sx={roleChipSx(user.role)} /></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{formatDate(user.createdAt)}</Typography></TableCell>
                <TableCell>
                  <Chip
                    label={user.useSystemApiKey ? "Yes" : "No"}
                    size="small"
                    sx={user.useSystemApiKey ? { bgcolor: "rgba(22,163,74,0.10)", color: "success.main" } : { bgcolor: "surfaces.subtle", color: "text.secondary" }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit user"><IconButton size="small" onClick={() => openEditModal(user)} color="primary"><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Delete user"><IconButton size="small" onClick={() => openDeleteModal(user)} color="error"><DeleteOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {users.length === 0 && (
        <Stack spacing={1.5} alignItems="center" sx={{ p: 7, color: "text.disabled" }}>
          <GroupOutlinedIcon sx={{ fontSize: 44 }} />
          <Typography variant="body2" color="text.secondary">No users registered</Typography>
        </Stack>
      )}
    </Paper>
  );

  return (
    <PageShell
      title="User Management"
      description="Manage users, roles, and permissions"
      maxWidth="xl"
      actions={<Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={openCreateModal}>Add User</Button>}
    >
      {loading ? (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ minHeight: 360 }}>
          <CircularProgress size={40} />
          <Typography color="text.secondary">Loading users...</Typography>
        </Stack>
      ) : error ? (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ minHeight: 360 }}>
          <WarningAmberOutlinedIcon sx={{ fontSize: 44, color: "error.main" }} />
          <Typography color="error.main">{error}</Typography>
          <Button variant="outlined" onClick={() => void fetchUsers()}>Retry</Button>
        </Stack>
      ) : table}

      <Dialog open={isModalOpen} onClose={closeUserModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" component="span">{editingUser ? "Edit User" : "Add New User"}</Typography>
          <IconButton onClick={closeUserModal} aria-label="Close"><CloseIcon /></IconButton>
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <DialogContent dividers>
            <Stack spacing={2.25}>
              {submitMessage && <Alert severity={submitSuccess ? "success" : "error"}>{submitMessage}</Alert>}
              <TextField
                type="email"
                label="Email"
                value={formData.email}
                onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                error={Boolean(formErrors.email)}
                helperText={formErrors.email}
                placeholder="Enter email"
                required
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="user-role-label">Role</InputLabel>
                <Select
                  labelId="user-role-label"
                  label="Role"
                  value={formData.role}
                  onChange={(event: SelectChangeEvent<UserResponse["role"]>) => setFormData((current) => ({ ...current, role: event.target.value as UserResponse["role"] }))}
                >
                  <MenuItem value="instructor">Instructor</MenuItem>
                  <MenuItem value="admin">Administrator</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>
              <TextField
                type={showPassword ? "text" : "password"}
                label="Password"
                value={formData.password}
                onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                error={Boolean(formErrors.password)}
                helperText={formErrors.password || (editingUser ? "Leave blank to keep the current password" : undefined)}
                placeholder="Enter password"
                required={!editingUser}
                autoComplete="new-password"
                fullWidth
                slotProps={{ input: { endAdornment: passwordAdornment(showPassword, () => setShowPassword((visible) => !visible)) } }}
              />
              <TextField
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm Password"
                value={formData.confirmPassword}
                onChange={(event) => setFormData((current) => ({ ...current, confirmPassword: event.target.value }))}
                error={Boolean(formErrors.confirmPassword)}
                helperText={formErrors.confirmPassword}
                placeholder="Confirm password"
                required={!editingUser || Boolean(formData.password.trim())}
                autoComplete="new-password"
                fullWidth
                slotProps={{ input: { endAdornment: passwordAdornment(showConfirmPassword, () => setShowConfirmPassword((visible) => !visible)) } }}
              />
              <FormControlLabel
                control={<Checkbox checked={formData.useSystemApiKey} onChange={(event) => setFormData((current) => ({ ...current, useSystemApiKey: event.target.checked }))} />}
                label="Use System API Key"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button type="button" color="inherit" onClick={() => resetForm()}>Reset</Button>
            <Box sx={{ flex: 1 }} />
            <Button type="button" color="inherit" onClick={closeUserModal}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={18} color="inherit" /> : editingUser ? "Update User" : "Create User"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={isDeleteModalOpen && Boolean(deletingUser)} onClose={closeDeleteModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" component="span">Delete User</Typography>
          <IconButton onClick={closeDeleteModal} aria-label="Close"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {deleteMessage && <Alert severity={deleteSuccess ? "success" : "error"}>{deleteMessage}</Alert>}
            <Alert severity="error" icon={<WarningAmberOutlinedIcon />}>
              You are about to permanently delete <strong>{deletingUser?.email}</strong>.
            </Alert>
            <TextField
              type="email"
              label="Confirm email address"
              value={deleteConfirmEmail}
              onChange={(event) => setDeleteConfirmEmail(event.target.value)}
              placeholder={deletingUser?.email}
              helperText="Type the user's email address to enable deletion."
              disabled={isDeleting}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button type="button" color="inherit" onClick={resetDeleteModal} disabled={isDeleting}>Reset</Button>
          <Box sx={{ flex: 1 }} />
          <Button type="button" color="inherit" onClick={closeDeleteModal} disabled={isDeleting}>Cancel</Button>
          <Button
            type="button"
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={isDeleting || deleteConfirmEmail !== deletingUser?.email}
          >
            {isDeleting ? <CircularProgress size={18} color="inherit" /> : "Delete User"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};
