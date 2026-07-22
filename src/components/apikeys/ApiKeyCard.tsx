import React from "react";
import {
  PencilIcon,
  TrashIcon,
  LinkIcon,
  CubeTransparentIcon,
} from "@heroicons/react/24/solid";
import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import type { ApiKey } from "../../models/ApiKeys"; // Asegúrate de que esta ruta sea correcta en tu proyecto

interface ApiKeyCardProps {
  apiKey: ApiKey;
  userRole: string|undefined;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault?: (apiKey: ApiKey) => void;
  isSaving?: boolean;
}

export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({ apiKey, onEdit, userRole,onDelete, onToggleDefault, isSaving = false }) => {

  const handleToggleDefault = () => {
    if (onToggleDefault) {
      onToggleDefault(apiKey);
      return;
    }
  };
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 p-6 flex flex-col">

      {/* --- CABECERA --- */}
      <div className="flex justify-between items-start mb-5">
        <div className="overflow-hidden pr-4">
          <h3 className="text-xl font-bold text-gray-800 mb-2 truncate" title={apiKey.description}>
            {apiKey.description}
          </h3>

          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              apiKey.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {apiKey.isActive ? (
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              ) : (
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
              )}
              {apiKey.isActive ? 'Active' : 'Inactive'}
            </span>

            {apiKey.isDefault && (
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wide">
                Default
              </span>
            )}

            {apiKey.isSystemApiKey && (
              <span className="bg-gray-100 text-yellow-800 text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wide">
                System
              </span>
            )}
          </div>
        </div>

        <div className="flex space-x-2 flex-shrink-0">
          {!apiKey.isDefault && <button
            onClick={handleToggleDefault}
            title="Mark as Default"
            disabled={isSaving}
            className={`p-2 bg-white border border-gray-200 rounded-lg text-gray-500 transition-all shadow-sm ${isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:text-yellow-600 hover:bg-yellow-50 hover:border-yellow-200'}`}
          >
            {isSaving ? (
              <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg> // Cambiar por iconos
            ) : (
              <StarOutlineIcon className="h-5 w-5 text-gray-400" />
            )}
          </button>}

          {(!apiKey?.isSystemApiKey|| (userRole && userRole === 'admin')) && (
            <>
              <button
                onClick={onEdit}
                title="Edit API Key"
                className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={onDelete}
                title="Delete API Key"
                className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      <hr className="border-gray-100 mb-5" />

      {/* --- CUERPO (Datos) --- */}
      <div className="flex-1 space-y-5">

        {/* Valor de la API Key */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">API Key Value</label>
          <div className="flex items-center justify-between mt-1.5 bg-gray-50 border border-gray-200 rounded-lg p-2.5">

            <span className="text-sm font-mono text-gray-800 truncate">
              {apiKey.keyValue}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 bg-gray-50/50 rounded-lg p-4 border border-gray-100">
          <div className="flex items-start space-x-3">
            <CubeTransparentIcon className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="overflow-hidden">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">API Key Provider</p>
              <p className="text-sm text-gray-800 font-semibold mt-0.5 truncate">{apiKey.provider}</p>
            </div>
          </div>

          {apiKey.baseUrl &&(
            <div className="flex items-start space-x-3">
              <LinkIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="overflow-hidden">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Base URL</p>
                <a href={apiKey.baseUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 truncate hover:underline mt-0.5 block">
                  {apiKey.baseUrl}
                </a>
              </div>
            </div>
          )}

          {apiKey.managementUrl && (
            <div className="flex items-start space-x-3">
              <LinkIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="overflow-hidden">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Management URL</p>
                <a href={apiKey.managementUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 truncate hover:underline mt-0.5 block">
                  {apiKey.managementUrl}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
