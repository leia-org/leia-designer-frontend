import { useCallback, useEffect, useState, type FormEvent } from "react";
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
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useAuth } from "../context";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { AuthLayout } from "../components/shared/AuthLayout";
import { isTurnstileEnabled } from "../config/turnstile";

export const Login = () => {
  const navigate = useNavigate();
  const { login, token } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);

  const handleTurnstileTokenChange = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  useEffect(() => {
    if (token) navigate("/", { replace: true });
  }, [navigate, token]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setSuccess(false);
      setMessage("Please fill in all fields");
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
      const response = await axios.post(
        `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/users/login`,
        {
          email: email.trim(),
          password: password.trim(),
          ...(isTurnstileEnabled && { "cf-turnstile-response": turnstileToken }),
        },
        { withCredentials: true },
      );
      const token = response.data.token;
      if (!token) {
        setSuccess(false);
        setMessage("Something went wrong, please try again later.");
        return;
      }
      setSuccess(true);
      setMessage("Logged in successfully!");
      login(token);
      window.setTimeout(() => navigate("/"), 1000);
    } catch (error: unknown) {
      let errorMessage = "An error occurred";
      if (axios.isAxiosError(error) && error.response) {
        const { status, data } = error.response;
        if (status === 400 && data?.validationErrors) {
          errorMessage = (Object.values(data.validationErrors) as string[]).join(", ");
        } else if (data?.message) {
          errorMessage = data.message;
        }
      }
      setSuccess(false);
      setMessage(errorMessage);
      setTurnstileToken("");
      setTurnstileKey((key) => key + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Designer"
      footer={
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Don't have an account?{" "}
          <Link component={RouterLink} to="/register" fontWeight={600}>
            Register
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
            slotProps={{ input: { endAdornment: <InputAdornment position="end"><PersonOutlineIcon color="action" /></InputAdornment> } }}
          />
          <TextField
            type={showPassword ? "text" : "password"}
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter the password"
            autoComplete="current-password"
            required
            fullWidth
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Toggle password visibility"
                      edge="end"
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
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
            {loading ? <CircularProgress size={22} color="inherit" /> : "Login"}
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  );
};
