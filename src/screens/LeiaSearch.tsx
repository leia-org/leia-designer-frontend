import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import api from "../lib/axios";
import { useApiKeys } from "../hooks/useApiKeys";
import { useProviders } from "../hooks/useProviders";
import { PageShell } from "../components/shared/PageShell";
import { LeiaTryDropdown } from "../components/LeiaTryDropdown";
import type { Leia, Persona, Problem, Behaviour, Label } from "../models/Leia";
import { ToastContainer, toast } from "react-toastify";
import { LeiaViewModal } from "../components/LeiaViewModal";
import { DeleteLeiaModal } from "../components/DeleteLeiaModal";
import { AddLeiaToAnActivity } from "../components/AddLeiaToAnActivity";
import { useAuth } from "../context";
import { LabelAddModal } from "../components/LabelAddModal";
import { Avatar } from "../components/shared/Avatar";
import { buildOriginalAvatarPath } from "../lib/avatar";
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
    providerProviderModuleMap,
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
  const [showActivityReplicationModal, setShowActivityReplicationModal] = useState(false);
  const [nameActivityReplication, setNameActivityReplication] = useState("");
  const [openLabelModalLeia, setOpenLabelModalLeia] = useState<Leia | null>(null);
  const [tryMenuOpenId, setTryMenuOpenId] = useState<string | null>(null);
  const [trySettingsAnchor, setTrySettingsAnchor] = useState<HTMLElement | null>(null);
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

  const handlePersonalize = useCallback(async (leia: Leia, fromTour: boolean) => {
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
  }, [navigate]);
    const startGuidedTour = useCallback((startStep: number = 0) => {
    let tour: ReturnType<typeof driver> | null = null;
    tourRef.current?.destroy();
    type StepWithRoles = Parameters<ReturnType<typeof driver>["setSteps"]>[0][number] & {
    roles?: string[];
    };
    const allSteps: StepWithRoles[] = [
            {
          element: "#search-results",
          roles: ["admin", "advanced", "instructor"],
          popover: {
            title: "Leias",
            description:
              "Here is the list of LEIAs you can use.",
            side: "bottom",
          },
        },
        {
          element: "#first-leia",
          roles: ["admin", "advanced", "instructor"],
          popover: {
            title: "Leias",
            description:
              "Let's get into this first LEIA.",
            side: "bottom",
          },
        },
        {
          element: "#first-design-from-this-button",
          roles: ["admin", "advanced", "instructor"],
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
          roles: ["admin", "advanced", "instructor"],
          popover: {
            title: "Leias",
            description:
              "Let's continue",
            side: "bottom",
          },
        },
        {
          element: "#view-button",
          roles: ["admin", "advanced", "instructor"],
          popover: {
            title: "View",
            description:
              "Another look at the LEIA content can be done with this button.",
            side: "bottom",
          },
        },
        {
          element: "#try-button",
          roles: ["admin", "advanced", "instructor"],
          popover: {
            title: "Try",
            description:
              "You can also try your LEIA using this button.",
            side: "bottom",
          },
        },
        {
          element: "#activity-button",
          roles: ["admin", "advanced"],
          popover: {
            title: "Activity",
            description:
              "In order to continue with the Design process, you'll have to add the LEIA to an Activity",
            side: "bottom",
            onNextClick: () => {
            setShowExperimentsModal(true);
            window.setTimeout(() => {
            tourRef.current?.moveNext();
          }, 100);
          },
        },
      },
        {
          element: "#activity-modal",
          roles: ["admin", "advanced"],
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
          roles: ["admin", "advanced", "instructor"],
          popover: {
            title: "Menu",
            description:
              "Let's go to the main menu",
            side: "bottom",
        },
        },
        {
          element: "#myApiKeys-button",
          roles: ["admin", "advanced", "instructor"],
          popover: {
            title: "API Keys",
            description:
              "In this section you can configure your API Keys with the models you like",
            side: "bottom",
          },
        },
        {
          element: "#myActivities-button",
          roles: ["admin", "advanced"],
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
        {
          roles: ["instructor"],
          popover: {
            title: "End of tour",
            description:
              "This is the end of the tour. Now you know everything you need to know to start using LEIA.",
            side: "bottom",
          },
        }
          ];
      const filteredSteps = allSteps.filter(
      ({ roles }) => !roles || roles.includes(user?.role ?? "")
      );
    tour = driver({
          animate: true,
          smoothScroll: true,
          allowClose: true,
          showProgress: true,
          progressText: "Paso {{current}} de {{total}}",
          steps: filteredSteps,
          onNextClick: (_element, _step, options) => {
          const activeIndex = options.driver.getActiveIndex();

          if (activeIndex === 8 && (user?.role === "advanced" || user?.role === "admin")) {
            setShowDropdown(true);
            window.setTimeout(() => {
              options.driver.moveNext();
            }, 300);
            return;
          }
          if (activeIndex === 6 && user?.role === "instructor") {
            setShowDropdown(true);
            window.setTimeout(() => {
              options.driver.moveNext();
            }, 300);
            return;
          }
          options.driver.moveNext();
        },
          
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
        

  }, [handlePersonalize, leias, navigate, user?.role]);

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
      const activeApiKeys = apiKeys.filter((key) => key.isActive !== false);
      if (!modelName) return activeApiKeys;

      const validProviders = Object.entries(apiKeyProvidersMapped || {})
        .filter(([, models]) => models.includes(modelName))
        .map(([provider]) => provider);

      return activeApiKeys.filter((key) =>
        validProviders.includes(key.provider)
      );
    },
    [apiKeyProvidersMapped, apiKeys]
  );

  const toolCapableProviders = useMemo(
    () =>
      Object.entries(providerProviderModuleMap || {})
        .filter(([, moduleName]) => moduleName === "openai-responses")
        .map(([provider]) => provider),
    [providerProviderModuleMap]
  );

  const toolCapableModels = useMemo(
    () =>
      toolCapableProviders.flatMap(
        (provider) => apiKeyProvidersMapped[provider] || []
      ),
    [apiKeyProvidersMapped, toolCapableProviders]
  );

  const leiaRequiresTools = useCallback(
    (leia: Leia) =>
      Array.isArray(leia.spec?.problem?.spec?.widgets) &&
      leia.spec.problem.spec.widgets.length > 0,
    []
  );

  const getTryModels = useCallback(
    (leia: Leia) =>
      leiaRequiresTools(leia) ? toolCapableModels : getValidModels(null),
    [getValidModels, leiaRequiresTools, toolCapableModels]
  );

  const getTryApiKeys = useCallback(
    (leia: Leia, modelName: string | null | undefined) => {
      const matchingKeys = getValidApiKeys(modelName);
      return leiaRequiresTools(leia)
        ? matchingKeys.filter((key) =>
            toolCapableProviders.includes(key.provider)
          )
        : matchingKeys;
    },
    [getValidApiKeys, leiaRequiresTools, toolCapableProviders]
  );

  const ensureTryConfig = useCallback(
    (leia: Leia) => {
      setTryConfigByLeia((prev) => {
        const existing = prev[leia.id];
        const validModels = getTryModels(leia);
        if (
          existing?.modelName &&
          existing.apiKeyId &&
          validModels.includes(existing.modelName) &&
          getTryApiKeys(leia, existing.modelName).some(
            (key) => key.id === existing.apiKeyId
          )
        ) {
          return prev;
        }

        const defaultKey = getDefaultKey();
        const candidateKeys = getTryApiKeys(leia, null);
        const key =
          defaultKey && candidateKeys.some((candidate) => candidate.id === defaultKey.id)
            ? defaultKey
            : candidateKeys[0] ?? null;
        const resolvedDefaultModel =
          key?.model && validModels.includes(key.model)
            ? key.model
            : defaultModel && validModels.includes(defaultModel)
              ? defaultModel
              : validModels[0] ?? "";

        return {
          ...prev,
          [leia.id]: {
            modelName: resolvedDefaultModel,
            apiKeyId: key?.id ?? null,
          },
        };
      });
    },
    [defaultModel, getDefaultKey, getTryApiKeys, getTryModels]
  );

  const closeTrySettings = useCallback(() => {
    setTryMenuOpenId(null);
    setTrySettingsAnchor(null);
  }, []);

  const handleTryMenuToggle = useCallback(
    (leia: Leia, anchor: HTMLElement) => {
      if (initializingId === leia.id) return;

      if (tryMenuOpenId === leia.id) {
        closeTrySettings();
        return;
      }

      setTryMenuOpenId(leia.id);
      setTrySettingsAnchor(anchor);
      ensureTryConfig(leia);
    },
    [closeTrySettings, ensureTryConfig, initializingId, tryMenuOpenId]
  );

  const handleTryModelChange = useCallback(
    (leia: Leia, modelName: string) => {
      setTryConfigByLeia((prev) => {
        const current = prev[leia.id] || { modelName: "", apiKeyId: null };
        const validApiKeys = getTryApiKeys(leia, modelName);
        const apiKeyId = validApiKeys.some((key) => key.id === current.apiKeyId)
          ? current.apiKeyId
          : (validApiKeys.find((key) => key.isDefault) || validApiKeys[0])?.id ?? null;

        return {
          ...prev,
          [leia.id]: {
            ...current,
            modelName,
            apiKeyId,
          },
        };
      });
    },
    [getTryApiKeys]
  );

  const handleTryApiKeyChange = useCallback(
    (leia: Leia, apiKeyId: string) => {
      setTryConfigByLeia((prev) => ({
        ...prev,
        [leia.id]: {
          ...(prev[leia.id] || { modelName: "" }),
          apiKeyId: apiKeyId || null,
        },
      }));
    },
    []
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
            leia,
            problemDescription: leia.spec?.problem?.spec?.description || "",
            personaAvatar: leia.spec?.persona?.spec?.avatar || "",
            personaName:
              leia.spec?.persona?.spec?.fullName ||
              leia.spec?.persona?.metadata?.name ||
              "Persona",
            problem: leia.spec?.problem,
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
    closeTrySettings();
    await handleTest(leia, config);
  };

  const handleDefaultTry = async (leia: Leia) => {
    const existing = tryConfigByLeia[leia.id];
    const validModels = getTryModels(leia);
    if (
      existing?.modelName &&
      existing.apiKeyId &&
      validModels.includes(existing.modelName) &&
      getTryApiKeys(leia, existing.modelName).some(
        (key) => key.id === existing.apiKeyId
      )
    ) {
      await handleTest(leia, existing);
      return;
    }

    const defaultKey = getDefaultKey();
    const candidateKeys = getTryApiKeys(leia, null);
    const key =
      defaultKey && candidateKeys.some((candidate) => candidate.id === defaultKey.id)
        ? defaultKey
        : candidateKeys[0] ?? null;
    const modelName =
      key?.model && validModels.includes(key.model)
        ? key.model
        : defaultModel && validModels.includes(defaultModel)
          ? defaultModel
          : validModels[0] ?? "";

    if (!key || !modelName) {
      ensureTryConfig(leia);
      setTryMenuOpenId(leia.id);
      return;
    }

    const config = { modelName, apiKeyId: key.id };
    setTryConfigByLeia((prev) => ({ ...prev, [leia.id]: config }));
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

  const closeActivityReplicationModal = useCallback(() => {
    setShowActivityReplicationModal(false);
    setSelectedLeia(null);
    setNameActivityReplication("");
  }, []);
  const handleQuickReplication = useCallback(async (leia?: Leia) => {
  const targetLeia = leia ?? selectedLeia;

  if (!targetLeia) {
    toast.error("No LEIA selected", {
      position: "bottom-right",
      autoClose: 3000,
    });
    return;
  }

  try {
    const leiaName = nameActivityReplication || targetLeia.metadata.name || "";
    const activityReplication = await api.post(`/api/v1/experiments/leia/`, {
      leiaName,
      leiaId: targetLeia.id,
    });
    toast.success("LEIA replicated successfully", {
      position: "bottom-right",
      autoClose: 3000,
    });

    const workbenchBaseUrl = import.meta.env.VITE_WORKBENCH_URL;
    const replicationUrl = `${workbenchBaseUrl.replace(
      /\/$/, "" )}/login?redirect=/replications/${encodeURIComponent(
      activityReplication.data.replication.id)}`;
    closeActivityReplicationModal();
    const newWindow = window.open(replicationUrl);

    if (!newWindow) {
      toast.error("Popup blocked or could not open replication", {
        position: "bottom-right",
        autoClose: 2000,
      });
    }
  } catch (error) {
    const axiosError = error as {
      response?: {
        status?: number;
        data?: {
          error?: string;
          data?: Array<{ id: string; name: string }>;
        };
      };
    };

    if (axiosError.response?.status === 409) {
      toast.info(axiosError.response?.data?.error, {
        position: "bottom-right",
        autoClose: 3000,
      });

      if (!nameActivityReplication) {
        setNameActivityReplication(targetLeia.metadata.name + "-v2");
      }
      setSelectedLeia(targetLeia);
      setShowActivityReplicationModal(true);
      return;
    }

    toast.error("Error replicating LEIA. Please try again.", {
      position: "bottom-right",
      autoClose: 3000,
    });
  }
}, [closeActivityReplicationModal, nameActivityReplication, selectedLeia]);

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
      if (!user) return false;
      if (user.role === "admin") return true;
      
      const leiaUserId = typeof leia.user === "object" ? leia.user?.id : leia.user;
      return user.id === leiaUserId;
    },
    [user]
  );


  return (
    <PageShell
      title="LEIA library"
      description="Browse, test, and design learning experiences"
      dropdownTour={showDropdown}
      actions={
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<PlayCircleOutlineIcon />} onClick={() => startGuidedTour()}>
            Design tour
          </Button>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => navigate("/create")}>
            New LEIA
          </Button>
        </Stack>
      }
      maxWidth={false}
      flush
    >
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
      {showActivityReplicationModal && (
        <Dialog open onClose={closeActivityReplicationModal} maxWidth="sm" fullWidth>
          <DialogTitle>Replicate activity</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Choose a name for the new activity and its Workbench replication.
              </Typography>
              <TextField
                autoFocus
                label="Activity and Replication name"
                value={nameActivityReplication}
                onChange={(event) => setNameActivityReplication(event.target.value)}
                placeholder="Activity replication name"
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button color="inherit" onClick={closeActivityReplicationModal}>Cancel</Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => void handleQuickReplication()}
              disabled={!nameActivityReplication.trim()}
            >
              Replicate
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            flexShrink: 0,
            px: { xs: 2, md: 4 },
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "center" }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name or description"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              inputProps={{ "aria-label": "Search LEIAs" }}
              sx={{ maxWidth: { lg: 520 } }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexShrink: 0 }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="label-filter-label">Label</InputLabel>
                <Select
                  labelId="label-filter-label"
                  label="Label"
                  value={selectedLabelFilter || ""}
                  onChange={(event) => setSelectedLabelFilter(event.target.value || null)}
                >
                  <MenuItem value="">All labels</MenuItem>
                  {labels.map((label) => (
                    <MenuItem key={label._id} value={label._id}>
                      {label.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="visibility-filter-label">Visibility</InputLabel>
                <Select
                  labelId="visibility-filter-label"
                  label="Visibility"
                  value={visibilityFilter}
                  onChange={(event) => setVisibilityFilter(event.target.value as "all" | "private" | "public")}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="private">Private</MenuItem>
                  <MenuItem value="public">Public</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 135 }}>
                <InputLabel id="version-filter-label">Version</InputLabel>
                <Select
                  labelId="version-filter-label"
                  label="Version"
                  value={versionFilter}
                  onChange={(event) => setVersionFilter(event.target.value as VersionFilter)}
                >
                  <MenuItem value="latest">Latest only</MenuItem>
                  <MenuItem value="">All versions</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, md: 4 }, py: 3 }}>
          <Box id="search-results" sx={{ width: "100%", maxWidth: 1280, mx: "auto" }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 10 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">Loading library…</Typography>
              </Stack>
            ) : leias.length === 0 ? (
              <Stack alignItems="center" spacing={1} sx={{ py: 10, color: "text.secondary" }}>
                <LibraryBooksOutlinedIcon sx={{ fontSize: 32, color: "text.disabled" }} />
                <Typography variant="body2">
                  {queryText || selectedLabelFilter || visibilityFilter !== "all" || !versionFilter
                    ? "No LEIAs match these filters."
                    : "No LEIAs found."}
                </Typography>
              </Stack>
            ) : (
              <Box
                component="ul"
                sx={{
                  m: 0,
                  p: 0,
                  listStyle: "none",
                  overflow: "visible",
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1.5,
                }}
              >
                {leias.map((leia, index) => {
                  const description =
                    leia.spec?.problem?.spec?.description ||
                    leia.spec?.persona?.spec?.description ||
                    "";
                  const leiaAvatar = leia.spec?.avatar || "";
                  const leiaAvatarFallback = buildOriginalAvatarPath(
                    "leias",
                    leia.id,
                  );
                  const labelData = leia.metadata?.labels || [];
                  const tryConfig = tryConfigByLeia[leia.id];
                  const tryModelName = tryConfig?.modelName ?? "";
                  const tryApiKeyId = tryConfig?.apiKeyId ?? null;
                  const requiresTools = leiaRequiresTools(leia);
                  const validTryModels = getTryModels(leia);
                  const validTryApiKeys = getTryApiKeys(leia, tryModelName);
                  const isTryMenuOpen = tryMenuOpenId === leia.id;
                  const isTryLoading = isProvidersLoading || isApiKeysLoading;
                  const canStartTry = Boolean(tryModelName && tryApiKeyId) && !isTryLoading;
                  const showNoApiKeys =
                    !isTryLoading &&
                    !providersError &&
                    !apiKeysError &&
                    apiKeys.every((key) => key.isActive === false);
                  const showNoMatchingKeys =
                    !isTryLoading &&
                    Boolean(tryModelName) &&
                    validTryApiKeys.length === 0 &&
                    apiKeys.length > 0;
                  const leiaUserId = typeof leia.user === "object" ? leia.user?.id : leia.user;
                  const canManageLabels = Boolean(
                    user && (user.role === "admin" || user.id === leiaUserId),
                  );

                  return (
                    <Box
                      component="li"
                      key={leia.id}
                      id={index === 1 ? "first-leia" : undefined}
                      sx={{
                        px: { xs: 2, md: 2.5 },
                        py: 2,
                        borderBottom: index < leias.length - 1 ? "1px solid" : 0,
                        borderColor: "divider",
                        display: "flex",
                        flexDirection: { xs: "column", xl: "row" },
                        alignItems: { xl: "center" },
                        justifyContent: "space-between",
                        gap: 2,
                        transition: "background-color 120ms ease",
                        "&:hover": { bgcolor: "surfaces.hover" },
                      }}
                    >
                      <Avatar
                        src={leiaAvatar}
                        fallbackSrc={leiaAvatarFallback}
                        alt={`${leia.metadata.name} avatar`}
                        label={leia.metadata.name}
                        size="md"
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                          <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>
                            {leia.metadata.name}
                          </Typography>
                          <Chip
                            label={"v" + leia.metadata.version}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: 11 }}
                          />
                          <Chip
                            label={leia.isPublished ? "Published" : "Unpublished"}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: 11,
                              bgcolor: leia.isPublished ? "rgba(22, 163, 74, 0.10)" : "rgba(217, 119, 6, 0.10)",
                              color: leia.isPublished ? "success.main" : "warning.main",
                            }}
                          />
                          {labelData.map((label) => (
                            <Chip
                              key={label._id}
                              label={label.name}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: 11,
                                bgcolor: label.color || "surfaces.subtle",
                                color: label.secundaryColor || "text.primary",
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            />
                          ))}
                          {canManageLabels && (
                            <Button
                              size="small"
                              onClick={() => setOpenLabelModalLeia(leia)}
                              sx={{ minWidth: 0, px: 0.75, fontSize: 11, textTransform: "none" }}
                            >
                              + Label
                            </Button>
                          )}
                        </Stack>

                        {description && (
                          <Typography
                            sx={{
                              mt: 0.75,
                              maxWidth: 760,
                              fontSize: 13,
                              color: "text.secondary",
                              lineHeight: 1.5,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {description}
                          </Typography>
                        )}

                        {leia.user?.email && (
                          <Stack direction="row" spacing={0.65} alignItems="center" sx={{ mt: 1, color: "text.disabled" }}>
                            <AccountCircleOutlinedIcon sx={{ fontSize: 15 }} />
                            <Typography sx={{ fontSize: 11.5 }}>{leia.user.email}</Typography>
                            {leia.user.role && (
                              <Typography sx={{ fontSize: 11.5 }}>· {leia.user.role}</Typography>
                            )}
                          </Stack>
                        )}
                      </Box>

                      <Stack
                        direction="row"
                        spacing={0.75}
                        useFlexGap
                        flexWrap="wrap"
                        alignItems="center"
                        sx={{ flexShrink: 0 }}
                      >
                        <Tooltip title="Design from this LEIA">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<PaletteOutlinedIcon />}
                            onClick={() => handlePersonalize(leia, false)}
                            id={index === 1 ? "first-design-from-this-button" : undefined}
                          >
                            Design from this
                          </Button>
                        </Tooltip>
                        <Tooltip title="View LEIA content">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityOutlinedIcon />}
                            onClick={() => handleViewLeiaContent(leia)}
                            id={index === 1 ? "view-button" : undefined}
                          >
                            View
                          </Button>
                        </Tooltip>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LightbulbOutlinedIcon />}
                            onClick={() => void handleDefaultTry(leia)}
                            disabled={initializingId === leia.id}
                            id={index === 1 ? "try-button" : undefined}
                            sx={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                          >
                            {initializingId === leia.id ? "Starting…" : "Test LEIA"}
                          </Button>
                          {!showNoApiKeys && (
                            <Tooltip title="Test settings">
                              <IconButton
                                size="small"
                                aria-label="Choose Test LEIA settings"
                                aria-expanded={isTryMenuOpen}
                                aria-haspopup="dialog"
                                onClick={(event) => handleTryMenuToggle(leia, event.currentTarget)}
                                disabled={initializingId === leia.id}
                                sx={{
                                  alignSelf: "stretch",
                                  border: "1px solid",
                                  borderLeft: 0,
                                  borderColor: "divider",
                                  borderRadius: 0,
                                  borderTopRightRadius: 6,
                                  borderBottomRightRadius: 6,
                                }}
                              >
                                <TuneOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <LeiaTryDropdown
                            isOpen={isTryMenuOpen}
                            anchorEl={trySettingsAnchor}
                            onClose={closeTrySettings}
                            isLoading={isTryLoading}
                            providersError={providersError}
                            apiKeysError={apiKeysError}
                            modelValue={tryModelName}
                            models={validTryModels}
                            apiKeys={validTryApiKeys}
                            apiKeyValue={tryApiKeyId}
                            apiKeyProvidersMapped={apiKeyProvidersMapped}
                            toolsRestricted={requiresTools}
                            onModelChange={(value) => handleTryModelChange(leia, value)}
                            onApiKeyChange={(value) => handleTryApiKeyChange(leia, value)}
                            canStart={canStartTry}
                            onStart={() => handleStartTry(leia)}
                            isStarting={initializingId === leia.id}
                            showNoApiKeys={showNoApiKeys}
                            showNoMatchingKeys={showNoMatchingKeys}
                          />
                        </Box>
                        {(user?.role === "admin" || user?.role === "advanced") && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ExtensionOutlinedIcon />}
                            onClick={() => {
                              setSelectedLeia(leia);
                              handleOpenExperimentsModal();
                            }}
                            id={index === 1 ? "activity-button" : undefined}
                          >
                            Add to activity
                          </Button>
                        )}
                        {(user?.role === "admin" || user?.role === "advanced") && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LibraryBooksOutlinedIcon />}
                            onClick={() => handleQuickReplication(leia)}
                          >
                            Quick replication
                          </Button>
                        )}
                        {canDeleteLeia(leia) && (
                          <Tooltip title="Delete LEIA">
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={"Delete " + leia.metadata.name}
                              onClick={() => handleDeleteLeia(leia)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
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
    </PageShell>
  );
};

export default LeiaSearch;
