import React, { useState } from "react";
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { Leia } from "../models/Leia";

interface DeleteLeiaModalProps {
  isOpen: boolean;
  leia: Leia | null;
  onClose: () => void;
  onConfirm: (leia: Leia) => void;
  isDeleting?: boolean;
  error?: string | null;
}

export const DeleteLeiaModal: React.FC<DeleteLeiaModalProps> = ({
  isOpen,
  leia,
  onClose,
  onConfirm,
  isDeleting = false,
  error = null,
}) => {
  const [confirmName, setConfirmName] = useState("");

  if (!isOpen || !leia) return null;

  const handleConfirm = () => {
    if (confirmName === leia.metadata.name) {
      onConfirm(leia);
    }
  };

  const resetAndClose = () => {
    setConfirmName("");
    onClose();
  };

  const isConfirmValid = confirmName === leia.metadata.name;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
            Delete LEIA
          </h2>
          <button
            onClick={resetAndClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isDeleting}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div
            className="p-4 mb-4 rounded-md text-sm bg-red-100 text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="mb-3">
              <h3 className="font-medium text-red-800 mb-2">LEIA Details:</h3>
              <div className="space-y-2 text-sm text-red-700">
                <div>
                  <strong>Name:</strong> {leia.metadata.name}
                </div>
                <div>
                  <strong>Type:</strong> LEIA
                </div>
                <div>
                  <strong>Version:</strong> {leia.metadata.version}
                </div>
                {leia.createdAt && (
                  <div>
                    <strong>Created:</strong> {formatDate(leia.createdAt)}
                  </div>
                )}
              </div>
            </div>
            <div className="text-sm text-red-700">
              <strong>Warning:</strong> This action cannot be undone. The LEIA
              will be permanently deleted.
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To confirm deletion, type the LEIA name:{" "}
              <strong>{leia.metadata.name}</strong>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={leia.metadata.name}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                confirmName && !isConfirmValid
                  ? "border-red-300"
                  : "border-gray-300"
              }`}
              disabled={isDeleting}
            />
            {confirmName && !isConfirmValid && (
              <p className="mt-1 text-sm text-red-600">
                Name doesn't match. Type "{leia.metadata.name}" exactly.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={resetAndClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
            disabled={isDeleting}
          >
            Reset
          </button>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting || !isConfirmValid}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center ${
                isDeleting || !isConfirmValid
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isDeleting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {isDeleting ? "Deleting..." : "Delete LEIA"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
