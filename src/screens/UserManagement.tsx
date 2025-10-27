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
import { Header } from "../components/shared/Header";

interface UserResponse {
  id: string;
  email: string;
  role: "admin" | "instructor" | "advanced";
  createdAt: string;
  updatedAt: string;
}

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
  const [formData, setFormData] = useState({
    email: "",
    role: "instructor" as "admin" | "instructor" | "advanced",
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
    if (role === "advanced") {
      return `${baseClasses} bg-blue-100 text-blue-800`;
    }
    return `${baseClasses} bg-gray-100 text-gray-800`;
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "instructor":
        return "Instructor";
      case "advanced":
        return "Advanced";
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

    if (!formData.password && !editingUser) {
      errors.password = "Password is required";
    } else if (formData.password && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword && formData.password) {
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
      if (editingUser) {
        await api.put(`/api/v1/users/${editingUser.id}`, {
          email: formData.email.trim(),
          role: formData.role,
          password: formData.password || undefined,
        });
        setSubmitSuccess(true);
        setSubmitMessage("User updated successfully!");
      } else {
        await api.post("/api/v1/users", {
          email: formData.email.trim(),
          role: formData.role,
          password: formData.password,
        });
        setSubmitSuccess(true);
        setSubmitMessage("User created successfully!");
      }

      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitMessage("");
        setSubmitSuccess(false);
        setEditingUser(null);
        fetchUsers();
      }, 1500);
    } catch (error: unknown) {
      setSubmitSuccess(false);

      let errorMessage = editingUser
        ? "An error occurred while updating the user"
        : "An error occurred while creating the user";

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

  const openDeleteModal = (user: UserResponse) => {
    setDeletingUser(user);
    setDeleteConfirmEmail("");
    setDeleteMessage("");
    setDeleteSuccess(false);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    setDeleteMessage("");

    try {
      await api.delete(`/api/v1/users/${deletingUser.id}`);
      setDeleteSuccess(true);
      setDeleteMessage("User deleted successfully!");

      setTimeout(() => {
        setIsDeleteModalOpen(false);
        setDeleteMessage("");
        setDeleteSuccess(false);
        setDeletingUser(null);
        setDeleteConfirmEmail("");
        fetchUsers();
      }, 1500);
    } catch (error: unknown) {
      setDeleteSuccess(false);

      let errorMessage = "An error occurred while deleting the user";

      if (axios.isAxiosError(error) && error.response) {
        if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
      }

      setDeleteMessage(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteModal = () => {
    setDeleteConfirmEmail("");
    setDeleteMessage("");
    setDeleteSuccess(false);
  };

  const openEditModal = (user: UserResponse) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      role: user.role,
      password: "",
      confirmPassword: "",
    });
    setFormErrors({});
    setSubmitMessage("");
    setSubmitSuccess(false);
    setIsModalOpen(true);
  };

  const resetModal = () => {
    if (editingUser) {
      setFormData({
        email: editingUser.email,
        role: editingUser.role,
        password: "",
        confirmPassword: "",
      });
    } else {
      setFormData({
        email: "",
        role: "instructor",
        password: "",
        confirmPassword: "",
      });
    }
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
    <div className="min-h-screen bg-gray-50">
      <Header
        title="User Management"
        description="Manage users, roles, and permissions"
      />

      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Users Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <UsersIcon className="h-6 w-6 text-blue-600 mr-3" />
                  <h2 className="text-xl font-bold text-gray-900">Users</h2>
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
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                            onClick={() => openDeleteModal(user)}
                          >
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

          {/* User Modal - Create/Edit */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500/50 backdrop-blur-sm">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingUser ? "Edit User" : "Add New User"}
                  </h2>
                  <button
                    onClick={() => {
                      resetModal();
                      setIsModalOpen(false);
                      setEditingUser(null);
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
                          role: e.target.value as
                            | "admin"
                            | "instructor"
                            | "advanced",
                        })
                      }
                      className="block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                      required
                    >
                      <option value="instructor">Instructor</option>
                      <option value="admin">Administrator</option>
                      <option value="advanced">Advanced</option>
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
                          setFormData({
                            ...formData,
                            password: e.target.value,
                          })
                        }
                        className={`block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 ${
                          formErrors.password
                            ? "border-red-300"
                            : "border-gray-300"
                        }`}
                        placeholder="Enter password"
                        required={!editingUser}
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
                        required={
                          !editingUser || formData.password.trim() !== ""
                        }
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
                      {editingUser ? "Update User" : "Create User"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete User Modal */}
          {isDeleteModalOpen && deletingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500/50 backdrop-blur-sm">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Delete User
                  </h2>
                  <button
                    onClick={() => {
                      resetDeleteModal();
                      setIsDeleteModalOpen(false);
                      setDeletingUser(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {deleteMessage && (
                  <div
                    className={`p-4 mb-4 rounded-md text-sm ${
                      deleteSuccess
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                    role="alert"
                  >
                    {deleteMessage}
                  </div>
                )}

                <div className="mb-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <div className="text-sm text-red-700">
                        <p>
                          You are about to permanently delete the user:
                          <br />
                          <strong className="font-semibold">
                            {deletingUser.email}
                          </strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="confirmEmail"
                      className="block text-sm font-medium text-gray-700"
                    >
                      To confirm deletion, please type the user's email address:
                    </label>
                    <input
                      type="email"
                      id="confirmEmail"
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      placeholder={deletingUser.email}
                      disabled={isDeleting}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={resetDeleteModal}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                    disabled={isDeleting}
                  >
                    Reset
                  </button>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        resetDeleteModal();
                        setIsDeleteModalOpen(false);
                        setDeletingUser(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={
                        isDeleting || deleteConfirmEmail !== deletingUser.email
                      }
                      className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center ${
                        isDeleting || deleteConfirmEmail !== deletingUser.email
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {isDeleting && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      )}
                      Delete User
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
