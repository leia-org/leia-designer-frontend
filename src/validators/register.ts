import validator from "validator";

export interface RegisterFormValues {
  email: string;
  password: string;
  confirmPassword: string;
}

export const validateRegisterForm = ({
  email,
  password,
  confirmPassword,
}: RegisterFormValues): string => {
  if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
    return "Please fill in all required fields";
  }

  if (!validator.isEmail(email.trim())) {
    return "Please enter a valid email address";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  return "";
};
