import React, { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";
import axios from "axios";
import { registerUser } from "../services/auth";
import { validateRegisterForm } from "../validators/register";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { isTurnstileEnabled } from "../config/turnstile";
// type UserRole = "instructor" | "advanced"; lo hemos hardcodeado

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateRegisterForm({
      email,
      password,
      confirmPassword,
    });
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

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error: unknown) {
      setSuccess(false);

      let errorMessage = "An error occurred while creating the account";

      if (axios.isAxiosError(error) && error.response) {
        const { data } = error.response;

        if (data?.validationErrors) {
          const validationErrors = Object.values(
            data.validationErrors
          ) as string[];
          errorMessage = validationErrors.join(", ");
        } else if (data?.message) {
          errorMessage = data.message;
        }
      }

      setMessage(errorMessage);
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4 py-10">
      <div className="w-full max-w-md px-8 py-10 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center transform rotate-12 shadow-lg">
              <img
                src="/logo/leia_main_white.png"
                alt="LEIA Logo"
                className="w-10 h-10 transform -rotate-12"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create account
          </h1>
          <p className="text-sm text-gray-500">Register to access Designer</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out bg-gray-50 focus:bg-white hover:border-blue-300"
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out bg-gray-50 focus:bg-white hover:border-blue-300"
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

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out bg-gray-50 focus:bg-white hover:border-blue-300"
                placeholder="Confirm the password"
                required
              />
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
          {isTurnstileEnabled && (
            <TurnstileWidget
              key={turnstileKey}
              onTokenChange={handleTurnstileTokenChange}
            />
          )}
          <button
            type="submit"
            disabled={loading || (isTurnstileEnabled && !turnstileToken)}
            className="w-full py-3 px-4 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-blue-600 flex items-center justify-center shadow-sm hover:shadow-md"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Register"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Log in
          </Link>
        </p>
      </div>

      <p className="mt-8 text-center text-sm text-gray-500">
        Developed by the LEIA team
      </p>
    </div>
  );
};
