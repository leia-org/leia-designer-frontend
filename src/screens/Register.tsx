import { useCallback, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { registerUser } from "../services/auth";
import { validateRegisterForm } from "../validators/register";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { AuthLayout } from "../components/shared/AuthLayout";
import { isTurnstileEnabled } from "../config/turnstile";

export const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);

  const handleTurnstileTokenChange = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileKey((key) => key + 1);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateRegisterForm({ email, password, confirmPassword });
    if (validationError) {
      setSuccess(false);
      setMessage(validationError);
      resetTurnstile();
      return;
    }
    if (isTurnstileEnabled && !turnstileToken) {
      setSuccess(false);
      setMessage("Please complete the verification challenge.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await registerUser({ email, password, turnstileToken });
      setSuccess(true);
      setMessage("Account created successfully. You can now log in.");
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (error: unknown) {
      let errorMessage = "An error occurred while creating the account";
      if (axios.isAxiosError(error) && error.response) {
        const { data } = error.response;
        if (data?.validationErrors) {
          errorMessage = (Object.values(data.validationErrors) as string[]).join(", ");
        } else if (data?.message) {
          errorMessage = data.message;
        }
      }
      setSuccess(false);
      setMessage(errorMessage);
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  const passwordAdornment = (
    <InputAdornment position="end">
      <IconButton
        aria-label="Toggle password visibility"
        edge="end"
        onClick={() => setShowPassword((visible) => !visible)}
      >
        {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <AuthLayout
      title="Create account"
      subtitle="Register to access Designer"
      footer={
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Already have an account?{" "}
          <Link component={RouterLink} to="/login" fontWeight={600}>
            Log in
          </Link>
        </Typography>
      }
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.5}>
          <TextField
            type="email"
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            required
            fullWidth
          />
          <TextField
            type={showPassword ? "text" : "password"}
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter the password"
            autoComplete="new-password"
            required
            fullWidth
            slotProps={{ input: { endAdornment: passwordAdornment } }}
          />
          <TextField
            type={showPassword ? "text" : "password"}
            label="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm the password"
            autoComplete="new-password"
            required
            fullWidth
            slotProps={{ input: { endAdornment: passwordAdornment } }}
          />
          {message && <Alert severity={success ? "success" : "error"}>{message}</Alert>}
          {isTurnstileEnabled && <TurnstileWidget key={turnstileKey} onTokenChange={handleTurnstileTokenChange} />}
          <Button
            type="submit"
            variant="contained"
            size="medium"
            fullWidth
            disabled={loading || (isTurnstileEnabled && !turnstileToken)}
            sx={{ minHeight: 44 }}
          >
            {loading ? <CircularProgress size={22} color="inherit" /> : "Register"}
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  );
};
