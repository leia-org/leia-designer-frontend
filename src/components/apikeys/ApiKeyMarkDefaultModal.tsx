
        import React, { useState } from "react";
        import { XMarkIcon } from "@heroicons/react/24/solid";
        import type { ApiKey } from "../../models/ApiKeys";

        interface ApiKeyMarkDefaultModalProps {
          apiKey: ApiKey | null;
          onClose: () => void;
          onConfirm: () => Promise<void> | void;
        }

        export const ApiKeyMarkDefaultModal: React.FC<ApiKeyMarkDefaultModalProps> = ({ apiKey, onClose, onConfirm }) => {
          const [loading, setLoading] = useState(false);

          const handleConfirm = async () => {
            if (!apiKey) return;
            try {
              setLoading(true);
              await onConfirm();
            } catch (err) {
              console.error(err);
            } finally {
              setLoading(false);
            }
          };

          if (!apiKey) return null;

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden transform transition-all">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {apiKey.isDefault ? '¿Desea quitar esta clave como predeterminada?' : '¿Desea marcar esta clave como predeterminada?'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500" aria-label="Cerrar">
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <p className="text-sm text-gray-600 mb-6">
                    {apiKey.isDefault
                      ? `¿Está seguro de que desea quitar "${apiKey.description}" como clave predeterminada?`
                      : `¿Desea marcar "${apiKey.description}" como su clave predeterminada? Esto desmarcará la clave que esté marcada actualmente.`}
                  </p>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} disabled={loading} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">Cancelar</button>
                    <button onClick={handleConfirm} disabled={loading} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium">
                      {loading ? 'Procesando...' : (apiKey.isDefault ? 'Quitar como predeterminada' : 'Marcar como predeterminada')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        };

        export default ApiKeyMarkDefaultModal;
