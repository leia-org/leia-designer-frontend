import axios from "axios";

export interface RegisterUserInput {
  email: string;
  password: string;
}

export const registerUser = async ({
  email,
  password,
}: RegisterUserInput): Promise<void> => {
  await axios.post(
    `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/users/register`,
    {
      email: email.trim(),
      password
    }
  );
};
