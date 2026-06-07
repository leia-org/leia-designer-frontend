import React from "react";
import { Link } from "react-router-dom";
import type { ApiKey } from "../models/ApiKeys";

interface LeiaTryDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  providersError?: string | null;
  apiKeysError?: string | null;
  modelValue: string;
  apiKeyValue: string | null;
  models: string[];
  apiKeys: ApiKey[];
  toolsRestricted?: boolean;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string | null) => void;
  canStart: boolean;
  onStart: () => void;
  isStarting: boolean;
  showNoApiKeys: boolean;
  showNoMatchingKeys: boolean;
}

export const LeiaTryDropdown: React.FC<LeiaTryDropdownProps> = ({
  isOpen,
  onClose,
  isLoading,
  providersError,
  apiKeysError,
  modelValue,
  apiKeyValue,
  models,
  apiKeys,
  toolsRestricted,
  onModelChange,
  onApiKeyChange,
  canStart,
  onStart,
  isStarting,
  showNoApiKeys,
  showNoMatchingKeys,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose}></div>
      <div className="absolute right-0 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg z-20 p-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Try settings
        </div>
        {toolsRestricted && (
          <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-700">
            This activity uses widgets, so its tool-functions only run on a
            tool-capable provider. Only OpenAI models are available here.
          </div>
        )}
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Model
          </label>
          <select
            className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={modelValue}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={isLoading}
          >
            <option value="">
              {isLoading ? "Loading models..." : "-- Select model --"}
            </option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            API Key
          </label>
          <select
            className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={apiKeyValue || ""}
            onChange={(e) => onApiKeyChange(e.target.value || null)}
            disabled={isLoading}
          >
            <option value="">
              {isLoading ? "Loading keys..." : "-- Select API key --"}
            </option>
            {apiKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.description}
              </option>
            ))}
          </select>
        </div>
        {(providersError || apiKeysError) && (
          <div className="mt-2 text-xs text-red-600">
            {providersError || apiKeysError}
          </div>
        )}
        {showNoApiKeys && (
          <div className="mt-2">
            <div className="text-xs text-gray-500">
              No API keys available for your account
            </div>
            <Link
              to="/api-keys"
              onClick={onClose}
              className="mt-2 inline-flex rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              Create API key
            </Link>
          </div>
        )}
        {showNoMatchingKeys && (
          <div className="mt-2 text-xs text-amber-600">
            No API keys match the selected model
          </div>
        )}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-800"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`px-3 py-1.5 text-xs rounded-md text-white transition-colors ${
              canStart && !isStarting
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-300 cursor-not-allowed"
            }`}
            onClick={onStart}
            disabled={!canStart || isStarting}
          >
            {isStarting ? "Starting..." : "Start"}
          </button>
        </div>
      </div>
    </>
  );
};
