import React from "react";
import { useAuth } from "../context/useAuth";
import type { Label, Leia } from "../models/Leia";
import { useState } from "react";
import api from "../lib/axios";
interface LabelAddModalProps {
  leia: Leia;
  onClose: () => void;
  onSave: (leiaId: string, labelsIds: string[]) => void;
  allLabels: Label[];
  currentLabels: Label[];
  onLabelCreated: (label: Label) => void;
}

export const LabelAddModal: React.FC<LabelAddModalProps> = ({ leia, onClose, onSave, allLabels, currentLabels, onLabelCreated }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(currentLabels.map(l => l._id))
    );
    const add = (id: string) => setSelectedIds(prev => new Set([...prev, id]));
    const remove = (id: string) => setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    const { user: currentUser } = useAuth();
    const [search, setSearch] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newLabel, setNewLabel] = useState({ name: '', color: '#2563eb', secundaryColor: '#bfdbfe', isGlobal: false });
    const selected = allLabels.filter(l => selectedIds.has(l._id));
    const available = allLabels.filter(
    l => !selectedIds.has(l._id) && l.name.toLowerCase().includes(search.toLowerCase())
    );
    const [createError, setCreateError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const handleCreateLabel = async () => {
    if (!newLabel.name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post('/api/v1/labels', newLabel);
      const created: Label = res.data;
      onLabelCreated(created);
      add(created._id);
      setIsCreating(false);
      setNewLabel({ name: '', color: '#2563eb', secundaryColor: '#bfdbfe', isGlobal: false });
    } catch {
      setCreateError('Error creating label. Please try again.');
    } finally {
      setCreating(false);
    }
  };
    
    return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-base font-medium text-gray-900">Manage labels</p>
            <p className="text-sm text-gray-500">{leia.metadata.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-4">Current labels</p>
          <div className="flex flex-wrap gap-1.5 min-h-8">
            {selected.length === 0 && <span className="text-sm text-gray-400">No labels assigned</span>}
            {selected.map(l => (
              <span key={l._id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border border-gray-200"
                style={{ backgroundColor: l.color, color: l.secundaryColor }}>
                {l.name}
                <button onClick={() => remove(l._id)} className="opacity-70 hover:opacity-100">✕</button>
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mb-4">
          <p className="text-sm text-gray-500 mb-4">Add label</p>
          <input
            type="text"
            placeholder="Search labels..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto">
            {available.length === 0 && <p className="text-sm text-gray-400 py-2">No labels found</p>}
            {available.map(l => (
              <button key={l._id} onClick={() => add(l._id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                <span className="w-2.5 h-2.5 rounded-full border flex-shrink-0"
                  style={{ backgroundColor: l.color, borderColor: l.secundaryColor }} />
                <span className="text-sm text-gray-700">{l.name}</span>
              </button>
            ))}
          </div>
          {!isCreating && (
            <button onClick={() => setIsCreating(true)}
              className="mt-2 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
              <span>+</span> Create new label
            </button>
          )}
        </div>

        {/* Formulario crear label */}
        {isCreating && (
          <>
            <div className="border-t border-gray-200 px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Create new label</h3>
              <p className="text-sm text-gray-500 mb-4">Add a label and reuse it in your LEIAs.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newLabel.name}
                    onChange={e => setNewLabel(prev => ({ ...prev, name: e.target.value }))}
                    placeholder=""
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Background colour</label>
                    <input type="color" value={newLabel.color}
                      onChange={e => setNewLabel(prev => ({ ...prev, color: e.target.value }))}
                      className="h-10 w-full border border-gray-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Text colour</label>
                    <input type="color" value={newLabel.secundaryColor}
                      onChange={e => setNewLabel(prev => ({ ...prev, secundaryColor: e.target.value }))}
                      className="h-10 w-full border border-gray-300 rounded-lg bg-white" />
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preview</label>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full border border-gray-200"
                    style={{ backgroundColor: newLabel.color || '#f3f4f6', color: newLabel.secundaryColor || '#111827' }}>
                    {newLabel.name || 'Preview'}
                  </span>
                </div>

                {currentUser?.role === "admin" && (
                  <div>
                    <p className="block text-sm font-medium text-gray-700 mb-2">Visibility</p>
                    <button
                      type="button"
                      onClick={() => setNewLabel(prev => ({ ...prev, isGlobal: !prev.isGlobal }))}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                        newLabel.isGlobal
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{newLabel.isGlobal ? "Global" : "Private"}</span>
                      <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          newLabel.isGlobal ? "bg-blue-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            newLabel.isGlobal ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                )}

                {createError && <p className="text-sm text-red-600">{createError}</p>}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
              <button onClick={() => { setIsCreating(false); setCreateError(null); }}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateLabel} disabled={creating}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                {creating ? 'Saving...' : 'Save label'}
              </button>
            </div>
          </>
        )}
        {!isCreating && (
          <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
            <button onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => onSave(leia.id, Array.from(selectedIds))}
              className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">
              Save changes
            </button>
          </div>
        )}

      </div>
    </div>
  );
};