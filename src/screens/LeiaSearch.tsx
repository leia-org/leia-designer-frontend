import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  SwatchIcon,
  LightBulbIcon,
  PuzzlePieceIcon,
  EyeIcon,
  TrashIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import api from "../lib/axios";
import { useApiKeys } from "../hooks/useApiKeys";
import { useProviders } from "../hooks/useProviders";
import { SearchFilter } from "../components/shared/SearchFilter";
import { Header } from "../components/shared/Header";
import { LeiaTryDropdown } from "../components/LeiaTryDropdown";
import type { Leia, Persona, Problem, Behaviour, Label } from "../models/Leia";
import { ToastContainer, toast } from "react-toastify";
import { LeiaViewModal } from "../components/LeiaViewModal";
import { DeleteLeiaModal } from "../components/DeleteLeiaModal";
import { AddLeiaToAnActivity } from "../components/AddLeiaToAnActivity";
import { useAuth } from "../context";
import { LabelAddModal } from "../components/LabelAddModal";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
type VersionFilter = "" | "latest";

export const LeiaSearch: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth().user;
  const {
    apiKeys,
    isLoading: isApiKeysLoading,
    error: apiKeysError,
    getDefaultKey,
  } = useApiKeys();
  const {
    apiKeyProvidersMapped,
    defaultModel,
    isLoading: isProvidersLoading,
    error: providersError,
  } = useProviders();

  const [queryText, setQueryText] = useState("");
  const [versionFilter, setVersionFilter] = useState<VersionFilter>("latest");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "private" | "public"
  >("all");
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [leias, setLeias] = useState<Leia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializingId, setInitializingId] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (queryText.trim()) p.text = queryText.trim();
    if (versionFilter) p.version = versionFilter;
    if (visibilityFilter !== "all") p.visibility = visibilityFilter;
    if (selectedLabelFilter) p.labelId = selectedLabelFilter;
    return p;
  }, [queryText, versionFilter, visibilityFilter, selectedLabelFilter]);

  const [selectedLeia, setSelectedLeia] = useState<Leia | null>(null);
  const [showExperimentsModal, setShowExperimentsModal] = useState(false);
  const [openLabelModalLeia, setOpenLabelModalLeia] = useState<Leia | null>(null);
  const [tryMenuOpenId, setTryMenuOpenId] = useState<string | null>(null);
  const [tryConfigByLeia, setTryConfigByLeia] = useState<
    Record<string, { modelName: string; apiKeyId: string | null }>
  >({});

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

  const tourRef = useRef<ReturnType<typeof driver> | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const startGuidedTour = useCallback((startStep: number = 0) => {
    let tour: ReturnType<typeof driver> | null = null;
    tourRef.current?.destroy();
    
    tour = driver({
          animate: true,
          smoothScroll: true,
          allowClose: true,
          showProgress: true,
          progressText: "Paso {{current}} de {{total}}",
          onNextClick: (_element, _step, options) => {
          const activeIndex = options.driver.getActiveIndex();

          if (activeIndex === 8) {
            setShowDropdown(true);
            window.setTimeout(() => {
              options.driver.moveNext();
            }, 300);
            return;
          }

          options.driver.moveNext();
        },
          steps: [
            {
          element: "#search-results",
          popover: {
            title: "Leias",
            description:
              "Here is the list of LEIAs you can use.",
            side: "bottom",
          },
        },
        {
          element: "#first-leia",
          popover: {
            title: "Leias",
            description:
              "Let's get into this first LEIA.",
            side: "bottom",
          },
        },
        {
          element: "#first-design-from-this-button",
          popover: {
            title: "Leias",
            description:
              "You can create your own LEIA based on this one with this button.",
            side: "bottom",
            onNextClick: () => {
            tour?.destroy();
            const firstLeia = leias[1];
            if (firstLeia){
            handlePersonalize(firstLeia, true);
            }
          },
        },
      },
      {
          element: "#first-leia",
          popover: {
            title: "Leias",
            description:
              "Let's continue",
            side: "bottom",
          },
        },
        {
          element: "#view-button",
          popover: {
            title: "View",
            description:
              "Another look at the LEIA content can be done with this button.",
            side: "bottom",
          },
        },
        {
          element: "#try-button",
          popover: {
            title: "Try",
            description:
              "You can also try your LEIA using this button.",
            side: "bottom",
          },
        },
        {
          element: "#activity-button",
          popover: {
            title: "Activity",
            description:
              "In order to continue with the Design process, you'll have to add the LEIA to an Activity",
            side: "bottom",
            onNextClick: () => {
            setShowExperimentsModal(true);
            window.setTimeout(() => {
            tourRef.current?.moveNext(); // avanza cuando ya está en el DOM
          }, 100);
          },
        },
      },
        {
          element: "#activity-modal",
          popover: {
            title: "Activity",
            description:
              "You can add the LEIA to an already created activity or into a new one",
            side: "bottom",
            onNextClick: () => {
            setShowExperimentsModal(false);
            window.setTimeout(() => {
            tourRef.current?.moveNext();
          }, 200);
          },
          },
        },
        {
          element: "#navigation-menu",
          popover: {
            title: "Menu",
            description:
              "Let's go to the main menu",
            side: "bottom",
        },
        },
        {
          element: "#myActivities-button",
          popover: {
            title: "Activity",
            description:
              "In this section you can find all your activities",
            side: "bottom",
            onNextClick: () => {
            tour?.destroy();
            navigate("/users/me/activities", {
              state: {
                isTour: true,
              },
            });
            },
          },
        },
          ],
        onDestroyed: () => {
          setShowDropdown(false);
        if (tourRef.current === tour) {
          tourRef.current = null;
        }
      }
      });
        tourRef.current = tour;
        tour.drive(startStep);
        if (tour.getActiveIndex() === 7) {
          setShowDropdown(true);
        }
        
  }, [leias]);

    useEffect(() => {
      const navigationState = location.state;
      if (!navigationState) return;
      if (navigationState.continueTour) {
        startGuidedTour(navigationState.continueTour);
        try {
        navigate(location.pathname, { replace: true, state: undefined });
      } catch (e) {
        console.error("Error clearing navigation state after starting tour:", e);}
    }
    }, [location.pathname, location.state, navigate, startGuidedTour]);



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
  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const response = await api.get<Label[]>("/api/v1/labels");
        setLabels(response.data || []);
      } catch (err) {
        console.error("Error fetching labels", err);
        setLabels([]);
      }
    };
    fetchLabels();
  }, []);
  const handlePersonalize = async (leia: Leia, fromTour: boolean) => {
    try {
      const [personaResp, problemResp, behaviourResp] = await Promise.all([
        api.get<Persona>(`/api/v1/personas/${leia.spec.persona.id}`),
        api.get<Problem>(`/api/v1/problems/${leia.spec.problem.id}`),
        api.get<Behaviour>(`/api/v1/behaviours/${leia.spec.behaviour.id}`),
      ]);
      navigate("/create", {
        state: {
          startTourFromSearch : fromTour,
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

  const getValidModels = useCallback(
    (apiKeyId: string | null | undefined) => {
      const models = Object.values(apiKeyProvidersMapped || {}).flat();
      if (!apiKeyId) return models;

      const apiKey = apiKeys.find((key) => key.id === apiKeyId);
      if (!apiKey || !apiKey.provider) return models;

      return apiKeyProvidersMapped[apiKey.provider] || [];
    },
    [apiKeyProvidersMapped, apiKeys]
  );

  const getValidApiKeys = useCallback(
    (modelName: string | null | undefined) => {
      if (!modelName) return apiKeys;

      const validProviders = Object.entries(apiKeyProvidersMapped || {})
        .filter(([, models]) => models.includes(modelName))
        .map(([provider]) => provider);

      return apiKeys.filter((key) => validProviders.includes(key.provider));
    },
    [apiKeyProvidersMapped, apiKeys]
  );

  const ensureTryConfig = useCallback(
    (leiaId: string) => {
      setTryConfigByLeia((prev) => {
        if (prev[leiaId]) return prev;

        const defaultKey = getDefaultKey();
        const validModels = getValidModels(defaultKey?.id);
        const resolvedDefaultModel =
          defaultModel && validModels.includes(defaultModel)
            ? defaultModel
            : "";

        return {
          ...prev,
          [leiaId]: {
            modelName: resolvedDefaultModel,
            apiKeyId: defaultKey?.id ?? null,
          },
        };
      });
    },
    [defaultModel, getDefaultKey, getValidModels]
  );

  const handleTryMenuToggle = useCallback(
    (leiaId: string) => {
      if (initializingId === leiaId) return;
      setTryMenuOpenId((prev) => (prev === leiaId ? null : leiaId));
      ensureTryConfig(leiaId);
    },
    [ensureTryConfig, initializingId]
  );

  const handleTryModelChange = useCallback(
    (leiaId: string, modelName: string) => {
      setTryConfigByLeia((prev) => {
        const current = prev[leiaId] || { modelName: "", apiKeyId: null };
        const validApiKeys = getValidApiKeys(modelName);
        const apiKeyId = validApiKeys.some((key) => key.id === current.apiKeyId)
          ? current.apiKeyId
          : null;

        return {
          ...prev,
          [leiaId]: {
            ...current,
            modelName,
            apiKeyId,
          },
        };
      });
    },
    [getValidApiKeys]
  );

  const handleTryApiKeyChange = useCallback(
    (leiaId: string, apiKeyId: string | null) => {
      setTryConfigByLeia((prev) => {
        const current = prev[leiaId] || { modelName: "", apiKeyId: null };
        const validModels = getValidModels(apiKeyId);
        const modelName = validModels.includes(current.modelName)
          ? current.modelName
          : "";

        return {
          ...prev,
          [leiaId]: {
            ...current,
            apiKeyId,
            modelName,
          },
        };
      });
    },
    [getValidModels]
  );

  const handleTest = async (
    leia: Leia,
    runnerConfiguration: { modelName: string; apiKeyId: string | null }
  ) => {
    try {
      setInitializingId(leia.id);
      const response = await api.post("/api/v1/runner/initialize", {
        spec: leia.spec,
        runnerConfiguration,
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

  const handleStartTry = async (leia: Leia) => {
    const config = tryConfigByLeia[leia.id];
    if (!config?.modelName || !config?.apiKeyId) {
      toast.error("Select a model and API key to start", {
        position: "bottom-right",
        autoClose: 3000,
      });
      return;
    }
    setTryMenuOpenId(null);
    await handleTest(leia, config);
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
  const updateLeiaLabels = async (leiaId: string, labelsIds: string[]) => {
      try {
        await api.patch(`/api/v1/leias/${leiaId}/labels`, {
          labelsIds: labelsIds,
        });
        // Refrescar la lista de LEIAs
      const response = await api.get<Leia[]>("/api/v1/leias", { params });
      setLeias(response.data || []);
      } catch (error) {
        console.error("Error updating labels:", error);
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
        dropdownTour={showDropdown}
        title="Search"
        description="Discover and test existing LEIA configurations"
        leftContent={
          <button
            type="button"
            onClick={() =>
              startGuidedTour()
            }
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <PlayIcon className="h-4 w-4" />
            Design tour
          </button>
        }
      />
      <ToastContainer />
      <AddLeiaToAnActivity
        isOpen={showExperimentsModal}
        idModal="activity-modal"
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
        <div className="flex items-end gap-4 mb-6">
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
                Label
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={selectedLabelFilter || ""}
                onChange={(e) =>
                  setSelectedLabelFilter(
                    e.target.value
                  )
                }
              >
                <option value="">All Labels</option>
                {labels.map((label) => (
                  <option key={label._id} value={label._id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </div>
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
          <div id="search-results" className="max-w-6xl mx-auto px-6 mt-6 pb-6 w-full">
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
              <ul  className="divide-y divide-gray-200 bg-white rounded-md border border-gray-200">
                {leias.map((leia, index) => {
                  const description =
                    leia.spec?.problem?.spec?.description ||
                    leia.spec?.persona?.spec?.description ||
                    "";
            
                  const labelData = leia.metadata?.labels;
                  const tryConfig = tryConfigByLeia[leia.id];
                  const tryModelName = tryConfig?.modelName ?? "";
                  const tryApiKeyId = tryConfig?.apiKeyId ?? null;
                  const validTryModels = getValidModels(tryApiKeyId);
                  const validTryApiKeys = getValidApiKeys(tryModelName);
                  const isTryMenuOpen = tryMenuOpenId === leia.id;
                  const isTryLoading = isProvidersLoading || isApiKeysLoading;
                  const canStartTry =
                    Boolean(tryModelName && tryApiKeyId) && !isTryLoading;
                  const showNoApiKeys =
                    !isTryLoading &&
                    !providersError &&
                    !apiKeysError &&
                    apiKeys.length === 0;
                  const showNoMatchingKeys =
                    !isTryLoading &&
                    Boolean(tryModelName) &&
                    validTryApiKeys.length === 0 &&
                    apiKeys.length > 0;

                  return (
                    <li
                      key={leia.id}
                      className="flex items-start justify-between gap-4 p-4"
                      id = {index === 1 ? "first-leia" : undefined}
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
                            {labelData?.length > 0 && labelData.map((label, index) => (
                              <span
                                key={label._id || `${leia.id}-${label.name}-${index}`}
                                className="px-2 py-0.5 text-xs font-medium rounded-full border border-gray-200"
                                style={{
                                  backgroundColor: label.color || "#f3f4f6",
                                  color: label.secundaryColor || "#111827",
                                }}
                                title={`Label: ${label.name}`}
                              >
                                {label.name} 
                                
                              </span>
                              
                            ))}
                            {user && (user.role === "admin" || (leia.user && user.id === leia.user.id)) && (
                              <button className="px-1.5 py-0.5 text-xs rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600" onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenLabelModalLeia(leia);
                                  }}>
                                    + Label
                                  </button>
                            )}
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
                          onClick={() => handlePersonalize(leia, false)}
                          id = {index === 1 ? "first-design-from-this-button" : undefined}
                          onMouseEnter={() => {
                            setTimeout(() => {
                              tourRef.current?.refresh();
                            }, 300);
                          }}
                          onMouseLeave={() => {
                            setTimeout(() => {
                              tourRef.current?.refresh();
                            }, 300);
                          }}
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
                          id= "view-button"
                          onMouseEnter={() => {
                            setTimeout(() => {
                              tourRef.current?.refresh();
                            }, 300);
                          }}
                          onMouseLeave={() => {
                            setTimeout(() => {
                              tourRef.current?.refresh();
                            }, 300);
                          }}
                        >
                          <EyeIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="absolute left-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                            View
                          </span>
                        </button>
                        <div className="relative">
                          <button
                            className={`group relative px-2.5 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-2 overflow-hidden transition-all duration-300 ${
                              initializingId === leia.id
                                ? "w-30"
                                : "w-10 hover:w-20"
                            }`}
                            onClick={() => handleTryMenuToggle(leia.id)}
                            disabled={initializingId === leia.id}
                            aria-expanded={isTryMenuOpen}
                            aria-haspopup="dialog"
                            id= "try-button"
                            onMouseEnter={() => {
                            setTimeout(() => {
                              tourRef.current?.refresh();
                            }, 300);
                          }}
                          onMouseLeave={() => {
                            setTimeout(() => {
                              tourRef.current?.refresh();
                            }, 300);
                          }}
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
                          <LeiaTryDropdown
                            isOpen={isTryMenuOpen}
                            onClose={() => setTryMenuOpenId(null)}
                            isLoading={isTryLoading}
                            providersError={providersError}
                            apiKeysError={apiKeysError}
                            modelValue={tryModelName}
                            apiKeyValue={tryApiKeyId}
                            models={validTryModels}
                            apiKeys={validTryApiKeys}
                            onModelChange={(value) =>
                              handleTryModelChange(leia.id, value)
                            }
                            onApiKeyChange={(value) =>
                              handleTryApiKeyChange(leia.id, value)
                            }
                            canStart={canStartTry}
                            onStart={() => handleStartTry(leia)}
                            isStarting={initializingId === leia.id}
                            showNoApiKeys={showNoApiKeys}
                            showNoMatchingKeys={showNoMatchingKeys}
                          />
                        </div>
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
                            id= "activity-button"
                            onMouseEnter={() => {
                            setTimeout(() => {
                              tourRef.current?.refresh();
                            }, 300);
                          }}
                          onMouseLeave={() => {
                            setTimeout(() => {
                              tourRef.current?.refresh();
                            }, 300);
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
      {/* Label Add Modal */}
      {openLabelModalLeia && (
        <LabelAddModal
          leia={openLabelModalLeia}
          allLabels={labels}
          currentLabels={openLabelModalLeia.metadata.labels || []}
          onLabelCreated={(created) => setLabels(prev => [...prev, created])}
          onClose={() => setOpenLabelModalLeia(null)}
          onSave={(leiaId, labelsIds) => {
            updateLeiaLabels(leiaId, labelsIds);
            setOpenLabelModalLeia(null);
          }}
        />
      )}
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
