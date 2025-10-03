import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context";
import { Header } from "../components/shared/Header";
import api from "../lib/axios";
import {
  UserCircleIcon,
  EnvelopeIcon,
  KeyIcon,
  BookmarkIcon,
  CheckCircleIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";

export const Profile = () => {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const handleUpdateEmail = async () => {
    if (!email || email === user?.email) {
      setEmailMessage({ type: 'error', text: 'Please enter a different email' });
      return;
    }

    setLoadingEmail(true);
    setEmailMessage(null);

    try {
      const response = await api.put('/api/v1/users/profile/update', { email });
      setUser(response.data);
      setEmailMessage({ type: 'success', text: 'Email updated successfully!' });
      setIsEditingEmail(false);
    } catch (error: any) {
      setEmailMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update email'
      });
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Please fill in all password fields' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoadingPassword(true);
    setPasswordMessage(null);

    try {
      await api.put('/api/v1/users/profile/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsChangingPassword(false);
    } catch (error: any) {
      setPasswordMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to change password'
      });
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Profile"
        description="View and manage your account information"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">

          {/* User Info Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center">
                <UserCircleIcon className="h-12 w-12 text-gray-400 mr-4" />
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Account Information
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Personal details and settings
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Email Section */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <label className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                  </div>
                  {!isEditingEmail && (
                    <button
                      onClick={() => setIsEditingEmail(true)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {isEditingEmail ? (
                  <div className="space-y-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter new email"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateEmail}
                        disabled={loadingEmail}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {loadingEmail ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingEmail(false);
                          setEmail(user?.email || "");
                          setEmailMessage(null);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                    {emailMessage && (
                      <div className={`flex items-center gap-2 text-sm ${
                        emailMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {emailMessage.type === 'success' ? (
                          <CheckCircleIcon className="h-4 w-4" />
                        ) : (
                          <XCircleIcon className="h-4 w-4" />
                        )}
                        {emailMessage.text}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-900">{user?.email}</p>
                )}
              </div>

              {/* Role Section */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center mb-2">
                  <UserCircleIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <label className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                  {user?.role}
                </span>
              </div>

              {/* My LEIAs Link */}
              <div className="border-b border-gray-200 pb-4">
                <Link
                  to="/leias"
                  className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <BookmarkIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">My LEIAs</span>
                  <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <KeyIcon className="h-6 w-6 text-gray-400 mr-3" />
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Change Password
                  </h3>
                </div>
                {!isChangingPassword && (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>

            {isChangingPassword && (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter new password (min. 6 characters)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Confirm new password"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={loadingPassword}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loadingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                  <button
                    onClick={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordMessage(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>

                {passwordMessage && (
                  <div className={`flex items-center gap-2 text-sm ${
                    passwordMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {passwordMessage.type === 'success' ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <XCircleIcon className="h-4 w-4" />
                    )}
                    {passwordMessage.text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
