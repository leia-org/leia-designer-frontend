import { useState, useEffect } from "react";
import {
  UsersIcon,
  UserPlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import api from "../lib/axios";
import validator from "validator";
import axios from "axios";

interface UserResponse {
  id: string;
  email: string;
  role: "admin" | "instructor";
  createdAt: string;
  updatedAt: string;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    role: "instructor" as "admin" | "instructor",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<UserResponse[]>("/api/v1/users");
      setUsers(response.data);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleBadge = (role: string) => {
    const baseClasses =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";

    if (role === "admin") {
      return `${baseClasses} bg-purple-100 text-purple-800`;
    }
    if (role === "instructor") {
      return `${baseClasses} bg-green-100 text-green-800`;
    }
    return `${baseClasses} bg-blue-100 text-blue-800`;
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "instructor":
        return "Instructor";
      default:
        return role;
    }
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!validator.isEmail(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      await api.post("/api/v1/users", {
        email: formData.email.trim(),
        role: formData.role,
        password: formData.password,
      });

      setSubmitSuccess(true);
      setSubmitMessage("User created successfully!");

      // Reset form
      setFormData({
        email: "",
        role: "instructor",
        password: "",
        confirmPassword: "",
      });
      setFormErrors({});

      // Refresh users list
      fetchUsers();

      // Close modal after a short delay
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitMessage("");
        setSubmitSuccess(false);
      }, 1500);
    } catch (error: unknown) {
      setSubmitSuccess(false);

      let errorMessage = "An error occurred while creating the user";

      if (axios.isAxiosError(error) && error.response) {
        if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data?.validationErrors) {
          const validationErrors = Object.values(
            error.response.data.validationErrors
          ) as string[];
          errorMessage = validationErrors.join(", ");
        }
      }

      setSubmitMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setFormData({
      email: "",
      role: "instructor",
      password: "",
      confirmPassword: "",
    });
    setFormErrors({});
    setSubmitMessage("");
    setSubmitSuccess(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchUsers}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Users Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <UsersIcon className="h-6 w-6 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">
                  User Management
                </h1>
              </div>
              <button
                onClick={() => {
                  resetModal();
                  setIsModalOpen(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                <UserPlusIcon className="h-5 w-5 mr-2" />
                Add User
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creation Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {getInitials(user.email)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.email}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {user.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getRoleBadge(user.role)}>
                        {getRoleDisplayName(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-900 p-1 rounded">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-900 p-1 rounded">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No users registered</p>
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Add New User
                </h2>
                <button
                  onClick={() => {
                    resetModal();
                    setIsModalOpen(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {submitMessage && (
                <div
                  className={`p-4 mb-4 rounded-md text-sm ${
                    submitSuccess
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                  role="alert"
                >
                  {submitMessage}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={`block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 ${
                      formErrors.email ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="Enter email"
                    required
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as "admin" | "instructor",
                      })
                    }
                    className="block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                    required
                  >
                    <option value="instructor">Instructor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className={`block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 ${
                        formErrors.password
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                      placeholder="Enter password"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? (
                          <EyeIcon className="h-5 w-5" />
                        ) : (
                          <EyeSlashIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  {formErrors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {formErrors.password}
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className={`block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 ${
                        formErrors.confirmPassword
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                      placeholder="Confirm password"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? (
                          <EyeIcon className="h-5 w-5" />
                        ) : (
                          <EyeSlashIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  {formErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      {formErrors.confirmPassword}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`${
                      isSubmitting
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    } text-white px-4 py-2 rounded-md transition-colors text-sm flex items-center`}
                  >
                    {isSubmitting && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
