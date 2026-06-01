import React, { useState, useEffect } from "react";
import type { ApiKey } from "../../models/ApiKeys";
import { useProviders } from "../../hooks/useProviders";

export interface ApiKeyFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  selectedKey: ApiKey | null;
  userRole?: string;
  onClose: () => void;

  onSave: (formData: Partial<ApiKey>) => Promise<void>;
  errors?: Record<string, string>;
}

export const ApiKeyFormModal: React.FC<ApiKeyFormModalProps> = ({ isOpen, mode, selectedKey, userRole, onClose, onSave, errors = {} }) => {
  const [formData, setFormData] = useState<Partial<ApiKey>>({});
  const [, setInitialFormData] = useState<Partial<ApiKey> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { apiKeysProviderSet, isLoading: isLoadingProviders } = useProviders();

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && selectedKey) {
        const initialData = { ...selectedKey, keyValue: "" };
        setFormData(initialData);
        setInitialFormData(initialData);
      } else {
        const newKeyData = {
          description: "",
          keyValue: "",
          provider: "",
          isActive: true,
          baseUrl: "",
          managementUrl: "",
          isDefault: false,
          isSystemApiKey: false,
        };
        setFormData(newKeyData);
        setInitialFormData(newKeyData);
      }
    }
  }, [isOpen, mode, selectedKey]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'isActive') {
      setFormData(prev => ({ ...prev, isActive: value === 'Active' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...formData };
      await onSave(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            {mode === "create" ? "Add New API Key" : "Edit API Key"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Name (Description)</label>
              <input type="text" name="description" value={formData.description || ""} onChange={handleChange} className={`w-full border ${errors.description ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500`} placeholder="e.g. Production Key" required />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key Value</label>
              <input type="text" name="keyValue" value={formData.keyValue || ""} onChange={handleChange} className={`w-full border ${errors.keyValue ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 font-mono`} placeholder={mode === "create" ? "sk-..." : "Leave blank to keep current"} required={mode === 'create'} />
              {errors.keyValue && <p className="text-red-500 text-xs mt-1">{errors.keyValue}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key Type</label>
                <select
                  name="provider"
                  value={formData.provider || ""}
                  onChange={handleChange}
                  className={`w-full border ${errors.provider ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500`}
                  required
                  disabled={isLoadingProviders}
                >
                  <option value="" disabled>
                    {isLoadingProviders ? "Loading providers..." : "Select a provider"}
                  </option>
                  {apiKeysProviderSet.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
                {errors.provider && <p className="text-red-500 text-xs mt-1">{errors.provider}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select name="isActive" value={formData.isActive ? "Active" : "Inactive"} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL<span className="text-gray-400 font-normal">(Required for local providers)</span></label>
              <input type="url" name="baseUrl" value={formData.baseUrl || ""} onChange={handleChange} className={`w-full border ${errors.baseUrl ? 'border-red-500' : 'border-gray-300'} rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 text-blue-600`} placeholder="https://..." />
              {errors.baseUrl && <p className="text-red-500 text-xs mt-1">{errors.baseUrl}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Management URL <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input type="url" name="managementUrl" value={formData.managementUrl || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 text-blue-600" placeholder="https://..." />
            </div>
            {mode === "create" && (
              <div className="pt-2 border-t border-gray-100 mt-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isDefault"
                    checked={!!formData.isDefault}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Make this the default API Key
                  </span>
                </label>
                {errors.isDefault && <p className="text-red-500 text-xs mt-1 ml-7">{errors.isDefault}</p>}
                <p className="text-xs text-gray-500 mt-1 ml-7">
                  If set, this API key will be used by default for operations that require it.
                </p>
              </div>
            )}
            {mode === "create" && userRole && userRole === "admin" && (
              <div className="pt-2 border-t border-gray-100 mt-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isSystemApiKey"
                    checked={!!formData.isSystemApiKey}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Make this a System API Key
                  </span>
                </label>
                {errors.isSystemApiKey && <p className="text-red-500 text-xs mt-1 ml-7">{errors.isSystemApiKey}</p>}
                <p className="text-xs text-gray-500 mt-1 ml-7">
                  System API keys can be used by all users who have system access enabled.
                </p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#3ab55b] text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center">
              {isSubmitting ? "Saving..." : (mode === "create" ? "Create Key" : "Save Changes")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
