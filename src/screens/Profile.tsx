import { useState } from "react";
import { useAuth } from "../context";
import api from "../lib/axios";
import {
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  KeyIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";

export const Profile = () => {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateEmail = async () => {
    if (!email || email === user?.email) return;

    setLoadingEmail(true);
    setEmailMessage(null);

    try {
      const response = await api.put('/api/v1/users/profile/update', { email });
      setUser(response.data);
      setEmailMessage({ type: 'success', text: 'Email updated successfully' });
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
      setPasswordMessage({ type: 'error', text: 'All fields are required' });
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
      setPasswordMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your profile information and security settings.</p>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <UserCircleIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900">Personal Information</h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-start gap-6">
              {/* Avatar Placeholder */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xl font-medium text-gray-600">
                  {user?.email?.[0].toUpperCase()}
                </div>
              </div>

              <div className="flex-1 space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Email Address</label>
                  <div className="flex gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <button
                      onClick={handleUpdateEmail}
                      disabled={loadingEmail || email === user?.email}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingEmail ? "Saving..." : "Save"}
                    </button>
                  </div>
                  {emailMessage && (
                    <div className={`mt-2 flex items-center gap-2 text-xs font-medium ${emailMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {emailMessage.type === 'success' ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
                      {emailMessage.text}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">System Role</label>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize border border-gray-200">
                      {user?.role}
                    </span>
                    <span className="text-xs text-gray-400">
                      (Read-only)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <ShieldCheckIcon className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900">Security</h2>
          </div>

          <div className="p-6">
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Current Password</label>
                <div className="relative">
                  <KeyIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                  <KeyIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Min. 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <KeyIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleChangePassword}
                  disabled={loadingPassword}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPassword ? "Updating Access..." : "Change Password"}
                </button>
              </div>

              {passwordMessage && (
                <div className={`mt-2 flex items-center justify-center gap-2 text-xs font-medium ${passwordMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {passwordMessage.type === 'success' ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
                  {passwordMessage.text}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
