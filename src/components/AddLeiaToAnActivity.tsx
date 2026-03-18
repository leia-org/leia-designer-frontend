import React, { useEffect, useState } from "react";
import type { SingleValue } from "react-select";
import CreatableSelect from "react-select/creatable";
import type { Experiment } from "../models/Experiment";
import type { Leia } from "../models/Leia";
import api from "../lib/axios";

type SelectOption = {
  value: string;
  label: string;
};

// Prefijo para distinguir opciones nuevas de IDs reales
const NEW_OPTION_PREFIX = "__new__";

interface AddLeiaToAnActivityProps {
  isOpen: boolean;
  selectedLeia: Leia | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddLeiaToAnActivity: React.FC<AddLeiaToAnActivityProps> = ({
  isOpen,
  selectedLeia,
  onClose,
  onSuccess,
}) => {
  const [draftExperiments, setDraftExperiments] = useState<Experiment[] | null>(
    null,
  );
  const [loadingDraftExperiments, setLoadingDraftExperiments] = useState(false);
  const [errorLoadingDraftExperiments, setErrorLoadingDraftExperiments] =
    useState<string | null>(null);
  const [selectedDraftExperimentId, setSelectedDraftExperimentId] = useState<
    string | null
  >(null);
  const [creatingNewExperiment, setCreatingNewExperiment] = useState(false);
  const [addingLeiaToExperiment, setAddingLeiaToExperiment] = useState(false);
  const [pendingNewName, setPendingNewName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDraftExperiments = async () => {
    setErrorLoadingDraftExperiments(null);
    try {
      setLoadingDraftExperiments(true);
      const response = await api.get<Experiment[]>("/api/v1/experiments/user/me", {
        params: { visibility: "private" },
      });
      setDraftExperiments(response.data || []);
    } catch {
      setErrorLoadingDraftExperiments("Could not load draft activities");
    } finally {
      setLoadingDraftExperiments(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedDraftExperimentId(null);
    setPendingNewName(null);
    setActionError(null);
    loadDraftExperiments();
  }, [isOpen]);

  if (!isOpen) return null;

  const options: SelectOption[] =
    draftExperiments?.map((experiment) => ({
      value: experiment.id,
      label: experiment.name,
    })) || [];

  // Valor mostrado en el select
  const selectedOption: SelectOption | null = pendingNewName
    ? { value: `${NEW_OPTION_PREFIX}${pendingNewName}`, label: pendingNewName }
    : selectedDraftExperimentId
    ? {
        value: selectedDraftExperimentId,
        label:
          draftExperiments?.find((exp) => exp.id === selectedDraftExperimentId)
            ?.name || "",
      }
    : null;

  const handleChange = (newValue: SingleValue<SelectOption>) => {
    if (!newValue) {
      setPendingNewName(null);
      setSelectedDraftExperimentId(null);
      return;
    }
    // Si es una opción nueva (creada con el prefijo), no propagamos al padre aún
    if (newValue.value.startsWith(NEW_OPTION_PREFIX)) {
      setPendingNewName(newValue.label);
      setSelectedDraftExperimentId(null);
    } else {
      setPendingNewName(null);
      setSelectedDraftExperimentId(newValue.value);
    }
  };

  const handleCreateOption = (inputValue: string) => {
    // Solo guardamos el nombre, NO llamamos a onCreateExperiment todavía
    setPendingNewName(inputValue);
    setSelectedDraftExperimentId(null);
  };

  const handleAddLeiaToExperiment = async (experimentId: string) => {
    if (!selectedLeia) return;
    await api.post(`/api/v1/experiments/${experimentId}/leias`, {
      leia: selectedLeia.id,
    });
  };

  const handleCreateExperiment = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    setCreatingNewExperiment(true);
    try {
      const response = await api.post<Experiment>("/api/v1/experiments", {
        name: trimmedName,
      });
      setDraftExperiments((prev) => [...(prev || []), response.data]);
      setSelectedDraftExperimentId(response.data.id);
      return response.data.id;
    } finally {
      setCreatingNewExperiment(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedLeia) return;
    setActionError(null);

    try {
      setAddingLeiaToExperiment(true);
      let targetExperimentId = selectedDraftExperimentId;

      if (!targetExperimentId && pendingNewName) {
        targetExperimentId = await handleCreateExperiment(pendingNewName);
      }

      if (!targetExperimentId) {
        setActionError("Select or create an activity first");
        return;
      }

      await handleAddLeiaToExperiment(targetExperimentId);
      handleClose();
      onSuccess?.();
    } catch {
      setActionError("Could not add LEIA to activity");
    } finally {
      setAddingLeiaToExperiment(false);
    }
  };

  const handleClose = () => {
    setPendingNewName(null);
    onClose();
  };

  const canConfirm =
    (!!selectedDraftExperimentId || !!pendingNewName) &&
    !!selectedLeia &&
    !addingLeiaToExperiment &&
    !creatingNewExperiment;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
        <div className="p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-semibold mb-4">
            Add {selectedLeia?.metadata.name || ""} LEIA to an Activity
          </h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select an Activity
            </label>

            {errorLoadingDraftExperiments ? (
              <div className="space-y-3">
                <div className="border border-red-300 rounded-md px-3 py-2 bg-red-50">
                  <p className="text-sm text-red-600">
                    {errorLoadingDraftExperiments}
                  </p>
                </div>
                <button
                  onClick={loadDraftExperiments}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <CreatableSelect
                value={selectedOption}
                onChange={handleChange}
                onCreateOption={handleCreateOption}
                options={options}
                placeholder={
                  loadingDraftExperiments
                    ? "Loading activities..."
                    : "Choose or create an activity..."
                }
                isClearable
                isDisabled={creatingNewExperiment || loadingDraftExperiments}
                isLoading={creatingNewExperiment || loadingDraftExperiments}
                formatCreateLabel={(inputValue) =>
                  `Create new activity: "${inputValue}"`
                }
                createOptionPosition="first"
                className="react-select-container"
                classNamePrefix="react-select"
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: "38px",
                    borderColor: "#d1d5db",
                    "&:hover": { borderColor: "#9ca3af" },
                    "&:focus-within": {
                      borderColor: "#3b82f6",
                      boxShadow: "0 0 0 1px #3b82f6",
                    },
                  }),
                }}
              />
            )}

            {creatingNewExperiment && (
              <div className="mt-2 flex items-center text-sm text-blue-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                Creating new activity...
              </div>
            )}

            {actionError && (
              <p className="mt-2 text-sm text-red-600">{actionError}</p>
            )}

            {/* Indicador visual de que es una actividad nueva pendiente */}
            {pendingNewName && !creatingNewExperiment && (
              <p className="mt-2 text-sm text-blue-600">
                New activity "{pendingNewName}" will be created on confirm.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {addingLeiaToExperiment || creatingNewExperiment ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  {creatingNewExperiment ? "Creating..." : "Adding..."}
                </>
              ) : (
                "Add to Activity"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};