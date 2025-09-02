import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/solid";
import axios from "axios";
import { useAuth } from "../context";

export const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setSuccess(false);
      setMessage("Please fill in all fields");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/users/login`,
        {
          email: email.trim(),
          password: password.trim(),
        }
      );
      const token = response.data.token;

      if (token) {
        setSuccess(true);
        setMessage("Logged in successfully!");

        login(token);

        setTimeout(() => {
          navigate("/");
        }, 1000);
      } else {
        setSuccess(false);
        setMessage("Something went wrong, please try again later.");
      }
    } catch (error: unknown) {
      setSuccess(false);

      let errorMessage = "An error ocurred";

      if (axios.isAxiosError(error) && error.response) {
        const { status, data } = error.response;

        if (status === 400 && data?.validationErrors) {
          const validationErrors = Object.values(
            data.validationErrors
          ) as string[];
          errorMessage = validationErrors.join(", ");
        } else if (data?.message) {
          errorMessage = data.message;
        }
      }

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="w-full max-w-md px-8 py-12 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center transform rotate-12 shadow-lg">
              <UserCircleIcon className="w-10 h-10 text-white transform -rotate-12" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            LEIA – Designer
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <div className="relative group">
              <input
                type="text"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out bg-gray-50 focus:bg-white group-hover:border-blue-300"
                placeholder="Enter your email"
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none transition-opacity duration-200 ease-in-out opacity-50 group-hover:opacity-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-gray-400"
                >
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out bg-gray-50 focus:bg-white group-hover:border-blue-300"
                placeholder="Enter the password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer hover:opacity-70 transition-opacity duration-200"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <EyeSlashIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`${
                success
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
              } text-sm rounded-lg p-3 flex items-center transition-all duration-200 ease-in-out`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5 mr-2 flex-shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-blue-600 flex items-center justify-center shadow-sm hover:shadow-md"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Login"
            )}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-gray-500">
        Developed by the LEIA team
      </p>
    </div>
  );
};
