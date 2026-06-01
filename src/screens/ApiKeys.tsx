import React, { useState } from "react";
import { Header } from "../components/shared/Header";
import { toast, ToastContainer } from "react-toastify";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { ApiKeyCard } from "../components/apikeys/ApiKeyCard";
import { ApiKeyFormModal } from "../components/apikeys/ApiKeyFormModal";
import { ApiKeyMarkDefaultModal } from "../components/apikeys/ApiKeyMarkDefaultModal";
import type { ApiKey, ApiKeyFormData } from "../models/ApiKeys";
import { useApiKeys } from "../hooks/useApiKeys";
import { useAuth } from "../context";


export const ApiKeysPage: React.FC = () => {
  const {user} = useAuth();
  const { apiKeys, isLoading, toggleDefault, savingIds, deleteKey, saveKey, refetch } = useApiKeys();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMarkDefaultModalOpen, setIsMarkDefaultModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // --- Handlers ---
  const confirmMarkDefault = async () => {
    if (!selectedKey) return;
    try {
      const updatedKey = await toggleDefault(selectedKey);
      toast.success(updatedKey.isDefault ? "API Key set as default" : "API Key removed as default");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update default status");
    } finally {
      setIsMarkDefaultModalOpen(false);
      setSelectedKey(null);
    }
  };
  const openCreateModal = () => {
    setFormMode("create");
    setSelectedKey(null);
    setValidationErrors({});
    setIsFormModalOpen(true);
  };

  const openEditModal = (key: ApiKey) => {
    setFormMode("edit");
    setSelectedKey(key);
    setValidationErrors({});
    setIsFormModalOpen(true);
  };

  const openMarkDefaultModal = (key: ApiKey) => {
    setSelectedKey(key);
    setIsMarkDefaultModalOpen(true);
  }

  const handleSaveKey = async (formData: Partial<ApiKey>) => {
    try {
      setValidationErrors({});
      const isCreate = formMode === "create";
      const isSystemKey = isCreate ? formData.isSystemApiKey : selectedKey?.isSystemApiKey;
      const baseUrl = isSystemKey
        ? `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apiKeys/system`
        : `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apikeys`;

      const url = isCreate ? baseUrl : `${baseUrl}/${selectedKey?.id}`;
      const method = isCreate ? "POST" : "PUT";
      const cleanManagementUrl = formData.managementUrl?.trim() || undefined;

      const payload: ApiKeyFormData = {
        description: formData.description,
        keyValue: formData.keyValue,
        provider: formData.provider,
        baseUrl: formData.baseUrl,
        managementUrl: cleanManagementUrl,
        isActive: formData.isActive,
      };
      if (isCreate) {
        payload.isDefault = formData.isDefault;
      }
      await saveKey(url, method, payload);
      await refetch();
      toast.success(isCreate ? "API Key created successfully!" : "API Key updated!");
      setIsFormModalOpen(false);
    } catch (err) {
      console.error(err);
      console.log('Errores de validación recibidos:', err);
      const receivedValidationErrors =
        err instanceof Error && "validationErrors" in err
          ? err.validationErrors
          : undefined;
      if (receivedValidationErrors && typeof receivedValidationErrors === "object") {
        setValidationErrors(receivedValidationErrors as Record<string, string>);
        toast.error("Please correct the errors in the form.");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to save API Key");
      }
      throw err;
    }
  };

  const confirmDelete = async () => {
    if (!selectedKey) return;
    try {
      const baseUrl = selectedKey.isSystemApiKey
        ? `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apiKeys/system`
        : `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apikeys`;

      const url = `${baseUrl}/${selectedKey.id}`;

      await deleteKey(url, selectedKey.id);
      toast.success("API Key deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete API Key");
    } finally {
      setIsDeleteModalOpen(false);
      setSelectedKey(null);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 font-medium">Loading your API Keys...</p>
        </div>
      );
    }
    if (apiKeys.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 border-dashed shadow-sm">
          <svg className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-gray-500 mb-4 text-center max-w-sm">
            You don't have any custom API Keys configured yet. Add one to get started.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200"
          >
            Create your first key
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {apiKeys.map((key) => (
          <ApiKeyCard
            key={key.id}
            apiKey={key}
            userRole={user?.role}
            onEdit={() => openEditModal(key)}
            onDelete={() => { setSelectedKey(key); setIsDeleteModalOpen(true); }}
            onToggleDefault={() => openMarkDefaultModal(key)}
            isSaving={!!savingIds?.[key.id]}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="My API Keys"
        description="Manage your model configurations and programmatic access keys."
      />
      <ToastContainer />

      {/* Contenido Principal */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-8 mt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My API Keys</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your model configurations and programmatic access keys.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add New Key
          </button>
        </div>

        {renderContent()}
      </div>

      {/* --- MODAL FORMULARIO (Creación / Edición) --- */}
      <ApiKeyFormModal
        isOpen={isFormModalOpen}
        mode={formMode}
        userRole={user?.role}
        selectedKey={selectedKey}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedKey(null);
        }}
        onSave={handleSaveKey}
        errors={validationErrors}
      />

      {/* --- MODAL DE ELIMINACIÓN --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Delete API Key?</h3>
                <button onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedKey(null);
                }} className="text-gray-400 hover:text-gray-500"><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete the key <span className="font-semibold text-gray-800">"{selectedKey?.description}"</span>?
                This action cannot be undone and any application using this key will stop working immediately.
              </p>

              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">Cancel</button>
                <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* --- MODAL MARCAR/DESMARCAR DEFAULT --- */}
      {isMarkDefaultModalOpen && (<ApiKeyMarkDefaultModal
        apiKey={selectedKey}
        onClose={() => { setIsMarkDefaultModalOpen(false); setSelectedKey(null); }}
        onConfirm={confirmMarkDefault}
      />)}
    </div>
  );
};
