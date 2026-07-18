import { Header } from "../components/shared/Header";
//import { useAuth } from "../context/useAuth";
import { useEffect, useState } from "react";
import type { Label } from "../models/Leia";
import api from "../lib/axios";
import {TrashIcon, PencilIcon, ArrowRightIcon} from "@heroicons/react/24/outline";
export const LabelManagement = () => {
//const { user } = useAuth();
const [labels, setLabels] = useState<Label[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<Error | null>(null);
const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<Label | null>(null);
const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
const [labelToUpdate, setLabelToUpdate] = useState<Label | null>(null);
const [showMergeMessage, setShowMergeMessage] = useState(false);
const globalLabels = labels.filter((l) => l.isGlobal);
const privateLabels = labels.filter((l) => !l.isGlobal);
const [selectedLabels, setSelectedLabels] = useState<Set<Label>>(new Set());
const selectedLabelsArray = Array.from(selectedLabels);
const fromLabel = selectedLabelsArray[0];
const toLabel = selectedLabelsArray[1];
const LabelCard = ({
  label,
  onDelete,
  onEdit,
  showMergeMessage,
  isSelected,
  onSelect,
}: {
  label: Label;
  onDelete: () => void;
  onEdit: () => void;
  showMergeMessage: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <div
    onClick={showMergeMessage ? onSelect : undefined}
    className={`bg-white rounded-lg border p-4 flex flex-col items-center gap-2 transition-shadow
      ${showMergeMessage ? "cursor-pointer" : "hover:shadow-md"}
      ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500"
          : "border-gray-200"
      }
    `}
  >
    <div className="w-full flex justify-between items-center gap-2">
      <button
        className="text-blue-600 hover:underline shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        disabled={showMergeMessage}
      >
        <PencilIcon className="w-4 h-4" />
      </button>

      <span
        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-gray-200 whitespace-nowrap"
        style={{ backgroundColor: label.color, color: label.secundaryColor }}
      >
        {label.name}
      </span>

      <button
        className="text-red-600 hover:underline shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={showMergeMessage}
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  </div>
);
const fetchLabels = async () => {
    try {
      const response = await api.get<Label[]>("/api/v1/labels");
      setLabels(response.data);
    } catch (err) {
        console.error("Error fetching labels", err);
        setError(err as Error);
    } finally {
      setLoading(false);
    }
  };
useEffect(() => {
  fetchLabels();
}, []);
const handleDeleteLabel = async (labelId: string) => {
    try {
        await api.delete(`/api/v1/labels/${labelId}`);
        setLabels((prevLabels) => prevLabels.filter((l) => l._id !== labelId));
    } catch (err) {
        console.error("Error deleting label", err);
        setError(err as Error);
    }
};
const handleUpdateLabel = async (labelId: string) => {
  try {
    await api.put<Label>(`/api/v1/labels/${labelId}`,{
        name: labelToUpdate?.name,
        color: labelToUpdate?.color,
        secundaryColor: labelToUpdate?.secundaryColor,
        isGlobal: labelToUpdate?.isGlobal
    });
    fetchLabels(); // Refresh the labels after update
  } catch (err) {
    console.error("Error fetching label for update", err);
    setError(err as Error);
  }
};

const toggleSelect = (lab: Label) => {
  setSelectedLabels((prev) => {
    const next = new Set(prev);
    if (next.has(lab)) {
      next.delete(lab);
    } else {
      if (next.size >= 2) {
        return prev;
      }
      next.add(lab);
    }
    return next;
  });
};

const handleMergeLabels = async (sourceLabel: Label, targetLabel: Label) => {
  try {
    await api.post(`/api/v1/labels/${sourceLabel._id}/merge-into/${targetLabel._id}`, {
    });
    setSelectedLabels(new Set());
    setShowMergeMessage(false);
    fetchLabels(); // Refresh the labels after merge
  } catch (err) {
    console.error("Error merging labels", err);
    setError(err as Error);
  }
};
const handleMergeCancel = () => {
  setSelectedLabels(new Set());
  setShowMergeMessage(false);
};
if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error.message}</p>
          <button
            onClick={fetchLabels}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading labels...</p>
        </div>
      </div>
    );
  }
return (
  <div className="min-h-screen bg-gray-50">
    <Header
      title="Label Management"
      description="Manage labels "
    />

    <div className="container mx-auto px-6 py-8">
      <h2 className="text-2xl font-bold mb-6 text-center">Labels</h2>
      <button
        onClick={() => {
          setShowMergeMessage(true);

        }}
        className="mb-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
      >
        Merge Labels
      </button>
      {showMergeMessage && (
        <div className="mb-4 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700">
          <p className="text-sm">
            To merge labels, select the source label and then the target label. The source label will be merged into the target label.
          </p>
          <button
            onClick={() => setShowMergeMessage(false)}
            className="mt-2 text-sm text-red-600 underline"
          >
            Cancel
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-40">
  {/* Columna de labels globales */}
  <div>
    <h3 className="text-lg font-semibold mb-4 text-center">Global Labels</h3>
    <div className="flex flex-wrap gap-4">
        {globalLabels.map((l) => (
            <LabelCard
            key={l._id}
            label={l}
            onDelete={() => setShowDeleteConfirmation(l)}
            onEdit={() => { setLabelToUpdate(l); setShowUpdateConfirmation(true); }}
            showMergeMessage={showMergeMessage}
            isSelected={selectedLabels.has(l)}
            onSelect={() => toggleSelect(l)}
            />
        ))}
</div>
    {globalLabels.length === 0 && (
      <p className="text-center text-gray-400 text-sm mt-4">No global labels</p>
    )}
  </div>

  {/* Columna de labels privados */}
  <div>
    <h3 className="text-lg font-semibold mb-4 text-center">Private Labels</h3>
    <div className="flex flex-wrap gap-4">
      {privateLabels.map((l) => (
        <LabelCard
          key={l._id}
          label={l}
          onDelete={() => setShowDeleteConfirmation(l)}
          onEdit={() => { setLabelToUpdate(l); setShowUpdateConfirmation(true); }}
          showMergeMessage={showMergeMessage}
          isSelected={selectedLabels.has(l)}
          onSelect={() => toggleSelect(l)}
        />
      ))}
    </div>
    {privateLabels.length === 0 && (
      <p className="text-center text-gray-400 text-sm mt-4">No private labels</p>
    )}
  </div>
</div>
    </div>
    {showDeleteConfirmation && (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    onClick={(e) => {
      if (e.target === e.currentTarget) setShowDeleteConfirmation(null);
    }}
  >
    <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
      <div className="p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-2">Confirm Deletion</h2>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete the label {showDeleteConfirmation.name}? This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowDeleteConfirmation(null)}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              handleDeleteLabel(showDeleteConfirmation._id);
              setShowDeleteConfirmation(null);
            }}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    {showUpdateConfirmation && labelToUpdate && (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    onClick={(e) => {
      if (e.target === e.currentTarget) setShowUpdateConfirmation(false);
    }}
  >
    <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Update label</h3>
        <p className="text-sm text-gray-500 mb-4">Edit this label's properties.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={labelToUpdate.name}
              onChange={(e) =>
                setLabelToUpdate((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Background colour</label>
              <input
                type="color"
                value={labelToUpdate.color}
                onChange={(e) =>
                  setLabelToUpdate((prev) => (prev ? { ...prev, color: e.target.value } : prev))
                }
                className="h-10 w-full border border-gray-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Text colour</label>
              <input
                type="color"
                value={labelToUpdate.secundaryColor}
                onChange={(e) =>
                  setLabelToUpdate((prev) => (prev ? { ...prev, secundaryColor: e.target.value } : prev))
                }
                className="h-10 w-full border border-gray-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <label className="block text-sm font-medium text-gray-700 mb-1">Preview</label>
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full border border-gray-200"
              style={{
                backgroundColor: labelToUpdate.color || "#f3f4f6",
                color: labelToUpdate.secundaryColor || "#111827",
              }}
            >
              {labelToUpdate.name || "Preview"}
            </span>
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Visibility</p>
            <button
              type="button"
              onClick={() =>
                setLabelToUpdate((prev) => (prev ? { ...prev, isGlobal: !prev.isGlobal } : prev))
              }
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                labelToUpdate.isGlobal
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{labelToUpdate.isGlobal ? "Global" : "Private"}</span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  labelToUpdate.isGlobal ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    labelToUpdate.isGlobal ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
        <button
          onClick={() => setShowUpdateConfirmation(false)}
          className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (labelToUpdate) handleUpdateLabel(labelToUpdate._id);
            setShowUpdateConfirmation(false);
          }}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save label
        </button>
      </div>
    </div>
  </div>
)}
  {selectedLabels.size==2  && (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Merging Labels
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          The Label {fromLabel.name} will be merged into {toLabel.name}. The source label will be deleted and all its references will be updated to the target label. Are you sure you want to proceed?
        </p>

        <div className="flex items-center justify-center gap-3 mb-6">
          <span
            className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border border-gray-200 whitespace-nowrap"
            style={{
              backgroundColor: fromLabel.color,
              color: fromLabel.secundaryColor,
            }}
          >
            {fromLabel.name}
          </span>

          <ArrowRightIcon className="w-4 h-4 text-gray-400 shrink-0" />

          <span
            className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border border-gray-200 whitespace-nowrap"
            style={{
              backgroundColor: toLabel.color,
              color: toLabel.secundaryColor,
            }}
          >
            {toLabel.name}
          </span>
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            onClick={handleMergeCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => handleMergeLabels(fromLabel, toLabel)}
          >
            Yes, merge
          </button>
        </div>
      </div>
    </div>
  )}
  </div>
);
};