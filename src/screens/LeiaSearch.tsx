import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  SwatchIcon,
  LightBulbIcon,
  PuzzlePieceIcon,
  EyeIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import api from "../lib/axios";
import { SearchFilter } from "../components/shared/SearchFilter";
import type { Leia, Persona, Problem, Behaviour } from "../models/Leia";
import type { Experiment } from "../models/Experiment";
import { ToastContainer, toast } from "react-toastify";
import CreatableSelect from "react-select/creatable";
import { LeiaViewModal } from "../components/LeiaViewModal";
import { DeleteLeiaModal } from "../components/DeleteLeiaModal";
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

  // Estados para eliminación de LEIAs
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    leia: Leia | null;
  }>({
    isOpen: false,
    leia: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{
    message: string;
    data?: Array<{ id: string; name: string }>;
  } | null>(null);

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
      setErrorLoadingDraftExperiments("Could not load draft activities");
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

  // Funciones de eliminación de LEIAs
  const handleDeleteLeia = useCallback((leia: Leia) => {
    setDeleteModal({
      isOpen: true,
      leia,
    });
    setDeleteError(null);
  }, []);

  const confirmDeleteLeia = async (leia: Leia) => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.delete(`/api/v1/leias/${leia.id}`);

      // Refrescar la lista de LEIAs
      const response = await api.get<Leia[]>("/api/v1/leias", { params });
      setLeias(response.data || []);

      // Cerrar modal
      setDeleteModal({
        isOpen: false,
        leia: null,
      });

      toast.success("LEIA deleted successfully");
    } catch (error: unknown) {
      const err = {
        message: "An error occurred while deleting the resource",
        data: [] as Array<{ id: string; name: string }>,
      };

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: {
            status?: number;
            data?: {
              message?: string;
              data?: Array<{ id: string; name: string }>;
            };
          };
        };

        if (axiosError.response?.status === 403) {
          err.message = "You do not have permission to delete this LEIA";
        } else if (axiosError.response?.status === 404) {
          err.message = "LEIA not found";
        } else if (axiosError.response?.status === 400) {
          err.message = `Cannot delete LEIA: it is being used in ${axiosError.response.data?.data?.length
            } activi${axiosError.response.data?.data?.length === 1 ? "ty" : "ties"
            }.`;
          err.data = axiosError.response.data?.data || [];
        } else if (axiosError.response?.data?.message) {
          err.message = axiosError.response.data.message;
        }
      }

      setDeleteError(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeDeleteModal = useCallback(() => {
    setDeleteModal({
      isOpen: false,
      leia: null,
    });
    setDeleteError(null);
  }, []);

  // Función para determinar si el usuario puede eliminar una LEIA
  const canDeleteLeia = useCallback(
    (leia: Leia) => {
      return (
        user &&
        (user.role === "admin" || (leia.user && user.id === leia.user.id))
      );
    },
    [user]
  );

  return (
    <div className="h-full flex flex-col bg-white">
      <ToastContainer />

      {/* Experiments Modal */}
      {showExperimentsModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseExperimentsModal();
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Add to Activity
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Select an activity to add "{selectedLeia?.metadata.name}" to.
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Activity
                </label>

                {errorLoadingDraftExperiments ? (
                  <div className="space-y-3">
                    <div className="border border-red-200 rounded-lg px-3 py-2 bg-red-50">
                      <p className="text-sm text-red-600">
                        {errorLoadingDraftExperiments}
                      </p>
                    </div>
                    <button
                      onClick={loadDraftExperiments}
                      className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Try Again
                    </button>
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
                        ? "Loading..."
                        : "Select or create activity..."
                    }
                    isClearable
                    isDisabled={
                      creatingNewExperiment || loadingDraftExperiments
                    }
                    isLoading={creatingNewExperiment || loadingDraftExperiments}
                    formatCreateLabel={(inputValue) =>
                      `Create "${inputValue}"`
                    }
                    createOptionPosition="first"
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: "40px",
                        borderColor: "#E5E7EB",
                        borderRadius: "0.5rem",
                        boxShadow: "none",
                        "&:hover": {
                          borderColor: "#D1D5DB",
                        },
                        "&:focus-within": {
                          borderColor: "#6366F1",
                          boxShadow: "0 0 0 1px #6366F1",
                        },
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: "0.5rem",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                      })
                    }}
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleCloseExperimentsModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
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
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                >
                  {addingLeiaToExperiment && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  )}
                  Add to Activity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Filters Toolbar */}
        <div className="border-b border-gray-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <SearchFilter
                  placeholder="Search exercises..."
                  value={queryText}
                  onChange={setQueryText}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Visibility</span>
                <select
                  className="border-gray-200 rounded-md text-sm text-gray-600 focus:ring-indigo-500 focus:border-indigo-500 py-1.5 pl-3 pr-8 bg-gray-50/50 hover:bg-gray-50"
                  value={visibilityFilter}
                  onChange={(e) =>
                    setVisibilityFilter(
                      e.target.value as "all" | "private" | "public"
                    )
                  }
                >
                  <option value="all">All View</option>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div className="h-4 w-px bg-gray-200"></div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Version</span>
                <select
                  className="border-gray-200 rounded-md text-sm text-gray-600 focus:ring-indigo-500 focus:border-indigo-500 py-1.5 pl-3 pr-8 bg-gray-50/50 hover:bg-gray-50"
                  value={versionFilter}
                  onChange={(e) =>
                    setVersionFilter(e.target.value as VersionFilter)
                  }
                >
                  <option value="latest">Latest</option>
                  <option value="">All History</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto bg-gray-50/50">
          <div className="px-8 py-6">
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
                <div className="p-1 bg-red-100 rounded-full text-red-600">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Exercise Name & Description
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">
                      Owner
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                          <span className="text-sm text-gray-500">Loading exercises...</span>
                        </div>
                      </td>
                    </tr>
                  ) : leias.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500 text-sm">
                        No exercises found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    leias.map((leia) => {
                      const description =
                        leia.spec?.problem?.spec?.description ||
                        leia.spec?.persona?.spec?.description ||
                        "";

                      return (
                        <tr key={leia.id} className="hover:bg-gray-50/80 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                                  {leia.metadata.name}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                  v{leia.metadata.version}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-1 max-w-lg">
                                {description || "No description available"}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${leia.isPublished ? 'bg-green-500' : 'bg-amber-400'}`}></span>
                              <span className="text-xs text-gray-600 font-medium">
                                {leia.isPublished ? "Published" : "Draft"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {leia.user && (
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 border border-gray-200">
                                  {leia.user.email?.[0].toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-900 font-medium">{leia.user.email?.split('@')[0]}</span>
                                  <span className="text-[10px] text-gray-400 capitalize">{leia.user.role}</span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handlePersonalize(leia)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="Use as template"
                              >
                                <SwatchIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleViewLeiaContent(leia)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="View details"
                              >
                                <EyeIcon className="w-4 h-4" />
                              </button>
                              <button
                                className={`p-1.5 rounded transition-colors ${initializingId === leia.id
                                  ? "text-indigo-600 bg-indigo-50"
                                  : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                                  }`}
                                onClick={() => handleTest(leia)}
                                disabled={initializingId === leia.id}
                                title="Test"
                              >
                                <LightBulbIcon className="w-4 h-4" />
                              </button>
                              {user?.role === "admin" && (
                                <button
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  onClick={() => {
                                    setSelectedLeia(leia);
                                    handleOpenExperimentsModal();
                                  }}
                                  title="Add to Activity"
                                >
                                  <PuzzlePieceIcon className="w-4 h-4" />
                                </button>
                              )}
                              {canDeleteLeia(leia) && (
                                <button
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  onClick={() => handleDeleteLeia(leia)}
                                  title="Delete"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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

      {/* LEIA Delete Modal */}
      <DeleteLeiaModal
        isOpen={deleteModal.isOpen}
        leia={deleteModal.leia}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteLeia}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};

export default LeiaSearch;
