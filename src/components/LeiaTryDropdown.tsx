import React from "react";
import { Link } from "react-router-dom";
import Select from "react-select";
import openAiIcon from "../assets/providers/openai.svg";
import geminiIcon from "../assets/providers/gemini.svg";
import ollamaIcon from "../assets/providers/ollama.svg";
import type { ApiKey } from "../models/ApiKeys";

const providerIcons: Record<string, string> = {
  openai: openAiIcon,
  gemini: geminiIcon,
  ollama: ollamaIcon,
};

interface LeiaTryDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  providersError?: string | null;
  apiKeysError?: string | null;
  modelValue: string;
  models: string[];
  apiKeys: ApiKey[];
  apiKeyValue: string | null;
  apiKeyProvidersMapped: Record<string, string[]>;
  toolsRestricted?: boolean;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
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
  models,
  apiKeys,
  apiKeyValue,
  apiKeyProvidersMapped,
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

  const modelOptions = models.map((model) => ({
    value: model,
    label: model,
    provider:
      Object.entries(apiKeyProvidersMapped).find(([, providerModels]) =>
        providerModels.includes(model)
      )?.[0] || "",
  }));
  const selectedModel = modelOptions.find((option) => option.value === modelValue) || null;
  const apiKeyOptions = apiKeys.map((apiKey) => ({
    value: apiKey.id,
    label: `${apiKey.description || apiKey.provider}${
      apiKey.isDefault ? " (Default)" : ""
    }`,
  }));
  const selectedApiKey =
    apiKeyOptions.find((option) => option.value === apiKeyValue) || null;

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
          <Select
            value={selectedModel}
            options={modelOptions}
            onChange={(option) => onModelChange(option?.value || "")}
            isDisabled={isLoading}
            isLoading={isLoading}
            placeholder="-- Select model --"
            formatOptionLabel={(option) => (
              <span className="flex items-center gap-2">
                {providerIcons[option.provider] && (
                  <img src={providerIcons[option.provider]} alt="" className="h-5 w-5 object-contain" />
                )}
                <span>{option.label}</span>
              </span>
            )}
            styles={{
              control: (base) => ({ ...base, minHeight: 38, fontSize: 14 }),
              menu: (base) => ({ ...base, fontSize: 14 }),
            }}
          />
        </div>
        {apiKeyOptions.length > 1 && (
          <div className="mt-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              API key
            </label>
            <Select
              value={selectedApiKey}
              options={apiKeyOptions}
              onChange={(option) => onApiKeyChange(option?.value || "")}
              isDisabled={isLoading}
              isLoading={isLoading}
              placeholder="-- Select API key --"
              styles={{
                control: (base) => ({ ...base, minHeight: 38, fontSize: 14 }),
                menu: (base) => ({ ...base, fontSize: 14 }),
              }}
            />
          </div>
        )}
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
