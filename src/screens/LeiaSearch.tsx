import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  SwatchIcon,
  LightBulbIcon,
  PuzzlePieceIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import api from "../lib/axios";
import { SearchFilter } from "../components/shared/SearchFilter";
import { Header } from "../components/shared/Header";
import type { Leia, Persona, Problem, Behaviour } from "../models/Leia";
import type { Experiment } from "../models/Experiment";
import { ToastContainer, toast } from "react-toastify";
import CreatableSelect from "react-select/creatable";
import { LeiaViewModal } from "../components/LeiaViewModal";
import { useAuth } from "../context";

type VersionFilter = "" | "latest";

export const LeiaSearch: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuth().user;

  const [queryText, setQueryText] = useState("");
  const [versionFilter, setVersionFilter] = useState<VersionFilter>("latest");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "private" | "public"
  >("all");
  const [leias, setLeias] = useState<Leia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializingId, setInitializingId] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (queryText.trim()) p.text = queryText.trim();
    if (versionFilter) p.version = versionFilter;
    if (visibilityFilter !== "all") p.visibility = visibilityFilter;
    return p;
  }, [queryText, versionFilter, visibilityFilter]);

  const [draftExperiments, setDraftExperiments] = useState<Experiment[] | null>(
    null
  );
  const [loadingDraftExperiments, setLoadingDraftExperiments] = useState(false);
  const [errorLoadingDraftExperiments, setErrorLoadingDraftExperiments] =
    useState<string | null>(null);
  const [selectedDraftExperimentId, setSelectedDraftExperimentId] = useState<
    string | null
  >(null);
  const [addingLeiaToExperiment, setAddingLeiaToExperiment] = useState(false);
  const [selectedLeia, setSelectedLeia] = useState<Leia | null>(null);

  const [creatingNewExperiment, setCreatingNewExperiment] = useState(false);
  const [showExperimentsModal, setShowExperimentsModal] = useState(false);

  // Estados para el modal de visualización de LEIA
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const fetchLeias = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get<Leia[]>("/api/v1/leias", {
          params,
          signal: controller.signal,
        });
        if (!active) return;
        setLeias(response.data || []);
      } catch (err: any) {
        if (!active) return;
        if (err?.name === "CanceledError") return;
        setError("Could not load LEIAs");
      } finally {
        if (active) setLoading(false);
      }
    };

    const t = setTimeout(fetchLeias, 300);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(t);
    };
  }, [params]);

  const handlePersonalize = async (leia: Leia) => {
    try {
      const [personaResp, problemResp, behaviourResp] = await Promise.all([
        api.get<Persona>(`/api/v1/personas/${leia.spec.persona.id}`),
        api.get<Problem>(`/api/v1/problems/${leia.spec.problem.id}`),
        api.get<Behaviour>(`/api/v1/behaviours/${leia.spec.behaviour.id}`),
      ]);

      navigate("/create", {
        state: {
          preset: {
            persona: personaResp.data,
            problem: problemResp.data,
            behaviour: behaviourResp.data,
          },
        },
      });
    } catch {
      setError("Could not load preset data");
    }
  };

  const handleTest = async (leia: Leia) => {
    try {
      setInitializingId(leia.id);
      const response = await api.post("/api/v1/runner/initialize", {
        spec: leia.spec,
      });
      const { sessionId } = response.data || {};
      if (sessionId) {
        navigate(`/chat/${sessionId}`, {
          state: {
            problemDescription: leia.spec?.problem?.spec?.description || "",
          },
        });
      } else {
        setError("Could not start chat session");
      }
    } catch {
      setError("Error starting chat session");
    } finally {
      setInitializingId(null);
    }
  };

  const loadDraftExperiments = async () => {
    setErrorLoadingDraftExperiments(null);
    try {
      setLoadingDraftExperiments(true);
      const response = await api.get<Experiment[]>(
        "/api/v1/experiments/user/me",
        {
          params: { visibility: "private" },
        }
      );
      setDraftExperiments(response.data);
    } catch {
      setErrorLoadingDraftExperiments("Could not load draft experiments");
    } finally {
      setLoadingDraftExperiments(false);
    }
  };

  const handleOpenExperimentsModal = () => {
    if (!draftExperiments) {
      loadDraftExperiments();
    }
    setShowExperimentsModal(true);
  };

  const handleCloseExperimentsModal = () => {
    setShowExperimentsModal(false);
    setSelectedDraftExperimentId(null);
    setSelectedLeia(null);
  };

  const handleCreateExperiment = async (inputValue: string) => {
    if (!inputValue.trim()) return;

    try {
      setCreatingNewExperiment(true);
      const response = await api.post<Experiment>("/api/v1/experiments", {
        name: inputValue.trim(),
      });

      setDraftExperiments((prev) => [...(prev || []), response.data]);

      setSelectedDraftExperimentId(response.data.id);

      toast.success("Activity '" + response.data.name + "' created", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error("Could not create new activity: " + error.message, {
          position: "bottom-right",
          autoClose: 5000,
        });
      }
    } finally {
      setCreatingNewExperiment(false);
    }
  };

  const handleAddLeiaToExperiment = async () => {
    if (!selectedDraftExperimentId || !selectedLeia) return;
    try {
      setAddingLeiaToExperiment(true);
      await api.post(`/api/v1/experiments/${selectedDraftExperimentId}/leias`, {
        leia: selectedLeia.id,
      });
      toast.success("LEIA added to activity successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
      handleCloseExperimentsModal();
    } catch (error) {
      if (error instanceof Error) {
        toast.error("Could not add LEIA to activity: " + error.message, {
          position: "bottom-right",
          autoClose: 5000,
        });
      }
    } finally {
      setAddingLeiaToExperiment(false);
    }
  };

  const handleViewLeiaContent = useCallback((leia: Leia) => {
    setSelectedLeia(leia);
    setIsViewModalOpen(true);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header
        title="Search"
        description="Discover and test existing LEIA configurations"
      />
      <ToastContainer />
      {showExperimentsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseExperimentsModal();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4">
            <div
              className="p-6"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <h2 className="text-xl font-semibold mb-4">
                Add {selectedLeia?.metadata.name || ""} LEIA to an Activity
              </h2>

              {/* Activity Selector */}
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
                ) : draftExperiments && draftExperiments.length === 0 ? (
                  <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                    <p className="text-sm text-gray-600">No activities found</p>
                  </div>
                ) : (
                  <CreatableSelect
                    value={
                      selectedDraftExperimentId
                        ? {
                            value: selectedDraftExperimentId,
                            label:
                              draftExperiments?.find(
                                (exp) => exp.id === selectedDraftExperimentId
                              )?.name || "",
                          }
                        : null
                    }
                    onChange={(newValue) =>
                      setSelectedDraftExperimentId(newValue?.value || null)
                    }
                    onCreateOption={handleCreateExperiment}
                    options={
                      draftExperiments?.map((experiment) => ({
                        value: experiment.id,
                        label: experiment.name,
                      })) || []
                    }
                    placeholder={
                      loadingDraftExperiments
                        ? "Loading activities..."
                        : "Choose or create an activity..."
                    }
                    isClearable
                    isDisabled={
                      creatingNewExperiment || loadingDraftExperiments
                    }
                    isLoading={creatingNewExperiment || loadingDraftExperiments}
                    formatCreateLabel={(inputValue) =>
                      `Create activity: "${inputValue}"`
                    }
                    createOptionPosition="first"
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: "38px",
                        borderColor: "#d1d5db",
                        "&:hover": {
                          borderColor: "#9ca3af",
                        },
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
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseExperimentsModal}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddLeiaToExperiment}
                  disabled={
                    !selectedDraftExperimentId ||
                    !selectedLeia ||
                    addingLeiaToExperiment
                  }
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {addingLeiaToExperiment ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      Adding...
                    </>
                  ) : (
                    "Add to Activity"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto pt-6 px-6 w-full mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div className="flex-1">
            <SearchFilter
              placeholder="Search by name or description"
              value={queryText}
              onChange={setQueryText}
              className="max-w-xl"
            />
          </div>
          <div className="flex gap-4">
            <div className="min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Visibility
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={visibilityFilter}
                onChange={(e) =>
                  setVisibilityFilter(
                    e.target.value as "all" | "private" | "public"
                  )
                }
              >
                <option value="all">All</option>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Version
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={versionFilter}
                onChange={(e) =>
                  setVersionFilter(e.target.value as VersionFilter)
                }
              >
                <option value="latest">Latest only</option>
                <option value="">All</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 mt-6 pb-6 w-full">
            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-16 text-center text-gray-500">Loading…</div>
            ) : leias.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                No LEIAs found
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 bg-white rounded-md border border-gray-200">
                {leias.map((leia) => {
                  const description =
                    leia.spec?.problem?.spec?.description ||
                    leia.spec?.persona?.spec?.description ||
                    "";
                  return (
                    <li
                      key={leia.id}
                      className="flex items-start justify-between gap-4 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-medium text-gray-900 truncate">
                              {leia.metadata.name}
                            </h3>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                              v{leia.metadata.version}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                leia.isPublished
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {leia.isPublished ? "Published" : "Unpublished"}
                            </span>
                          </div>
                          {/* User information moved back to the right without margin */}
                          {leia.user && leia.user.email && leia.user.role && (
                            <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
                              <span>{leia.user.email}</span>
                              <span className="flex items-center gap-1">
                                <span
                                  className={`inline-block w-2 h-2 rounded-full ${
                                    leia.user.role === "admin"
                                      ? "bg-purple-500"
                                      : "bg-green-500"
                                  }`}
                                ></span>
                                {leia.user.role === "admin"
                                  ? "Administrator"
                                  : "Instructor"}
                              </span>
                            </div>
                          )}
                        </div>
                        {description && (
                          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                            {description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          className="group relative px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 overflow-hidden transition-all duration-300 w-10 hover:w-40"
                          onClick={() => handlePersonalize(leia)}
                        >
                          <SwatchIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="absolute left-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                            Design from this
                          </span>
                        </button>
                        <button
                          className="group relative px-2.5 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-2 overflow-hidden transition-all duration-300 w-10 hover:w-20"
                          onClick={() => handleViewLeiaContent(leia)}
                          title="View LEIA content"
                        >
                          <EyeIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="absolute left-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                            View
                          </span>
                        </button>
                        <button
                          className={`group relative px-2.5 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-2 overflow-hidden transition-all duration-300 ${
                            initializingId === leia.id
                              ? "w-30"
                              : "w-10 hover:w-20"
                          }`}
                          onClick={() => handleTest(leia)}
                          disabled={initializingId === leia.id}
                        >
                          <LightBulbIcon className="w-4 h-4 flex-shrink-0" />
                          <span
                            className={`absolute left-10 transition-opacity duration-300 whitespace-nowrap ${
                              initializingId === leia.id
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            {initializingId === leia.id ? "Starting…" : "Try"}
                          </span>
                        </button>
                        {user?.role === "admin" && (
                          <button
                            className={`group relative px-2.5 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-2 overflow-hidden transition-all duration-300 ${
                              selectedLeia?.id === leia.id
                                ? "w-42"
                                : "w-10 hover:w-38"
                            }`}
                            onClick={() => {
                              setSelectedLeia(leia);
                              handleOpenExperimentsModal();
                            }}
                          >
                            <PuzzlePieceIcon className="w-4 h-4 flex-shrink-0" />
                            <span
                              className={`absolute left-10 transition-opacity duration-300 whitespace-nowrap ${
                                selectedLeia?.id === leia.id
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              {selectedLeia?.id === leia.id
                                ? "Adding to Activity"
                                : "Add to Activity"}
                            </span>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white via-white to-transparent pointer-events-none"></div>
      </div>

      {/* LEIA View Modal */}
      {selectedLeia && (
        <LeiaViewModal
          leia={selectedLeia}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedLeia(null);
          }}
        />
      )}
    </div>
  );
};

export default LeiaSearch;
