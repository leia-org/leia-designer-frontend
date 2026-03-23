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
import { Header } from "../components/shared/Header";
import type { Leia, Persona, Problem, Behaviour } from "../models/Leia";
import { ToastContainer, toast } from "react-toastify";
import { LeiaViewModal } from "../components/LeiaViewModal";
import { DeleteLeiaModal } from "../components/DeleteLeiaModal";
import { AddLeiaToAnActivity } from "../components/AddLeiaToAnActivity";
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

  const [selectedLeia, setSelectedLeia] = useState<Leia | null>(null);
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

  const handleOpenExperimentsModal = () => {
    setShowExperimentsModal(true);
  };

  const handleCloseExperimentsModal = () => {
    setShowExperimentsModal(false);
    setSelectedLeia(null);
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
          err.message = `Cannot delete LEIA: it is being used in ${
            axiosError.response.data?.data?.length
          } activi${
            axiosError.response.data?.data?.length === 1 ? "ty" : "ties"
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
    <div className="flex flex-col h-screen bg-white">
      <Header
        title="Search"
        description="Discover and test existing LEIA configurations"
      />
      <ToastContainer />
      <AddLeiaToAnActivity
        isOpen={showExperimentsModal}
        selectedLeia={selectedLeia}
        onClose={handleCloseExperimentsModal}
        onSuccess={() => {
          toast.success("LEIA added to activity successfully", {
            position: "bottom-right",
            autoClose: 5000,
          });
          handleCloseExperimentsModal();
        }}
      />
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
                        {canDeleteLeia(leia) && (
                          <button
                            className="group relative px-2.5 py-2 text-sm rounded-md border border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700 flex items-center gap-2 overflow-hidden transition-all duration-300 w-10 hover:w-22"
                            onClick={() => handleDeleteLeia(leia)}
                            title="Delete LEIA"
                          >
                            <TrashIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="absolute left-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                              Delete
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
