import type React from "react";
import { lazy, memo, Suspense, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CloseIcon from "@mui/icons-material/Close";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { toast } from "react-toastify";
import type { Leia } from "../models/Leia";
import { useAuth } from "../context/useAuth";
import { useApiKeys } from "../hooks/useApiKeys";
import api from "../lib/axios";
import {
  buildLeiaInfographicPaths,
  buildOriginalAvatarPath,
  buildStoredImageCandidateSources,
} from "../lib/avatar";
import InfographicViewer from "./InfographicViewer";
import { Avatar } from "./shared/Avatar";
import { RubricPreview } from "./RubricPreview";

const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter").then((module) => ({ default: module.Prism })),
);

const LoadingCode = ({ label = "Loading..." }: { label?: string }) => (
  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 3 }}>
    <CircularProgress size={18} />
    <Typography variant="body2" color="text.secondary">{label}</Typography>
  </Stack>
);

const LazyCodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [prismStyle, setPrismStyle] = useState<object | null>(null);

  useEffect(() => {
    void import("react-syntax-highlighter/dist/esm/styles/prism").then((styles) => {
      setPrismStyle(styles.oneLight);
    });
  }, []);

  if (!prismStyle) return <LoadingCode />;

  return (
    <SyntaxHighlighter
      language={language}
      style={prismStyle}
      showLineNumbers
      wrapLines
      customStyle={{ borderRadius: "8px", fontSize: "14px", lineHeight: "1.5", margin: 0 }}
    >
      {code}
    </SyntaxHighlighter>
  );
};

const ContentSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Stack spacing={1}>
    <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
    <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "surfaces.subtle", border: "1px solid", borderColor: "divider" }}>
      {children}
    </Box>
  </Stack>
);

interface LeiaViewModalProps {
  leia: Leia | null;
  isOpen: boolean;
  onClose: () => void;
}

type AvatarRegenerationTarget = "leias" | "problems" | "personas";
type InfographicRegenerationTarget = "infographic" | "infographicSolution";
type RegenerationTarget = AvatarRegenerationTarget | InfographicRegenerationTarget | "all";
type ViewMode = "problem" | "persona" | "behaviour" | "rubric" | "infographics";

function getUserId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const userValue = value as { id?: unknown; _id?: unknown };
    if (typeof userValue.id === "string") return userValue.id;
    if (typeof userValue._id === "string") return userValue._id;
  }
  return null;
}

function cacheBustStoredImage(image?: string): string {
  if (!image) return "";
  const separator = image.includes("?") ? "&" : "?";
  return `${image}${separator}t=${Date.now()}`;
}

function getRegenerationError(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    return axiosError.response?.data?.message || "Could not regenerate the image";
  }
  return "Could not regenerate the image";
}

export const LeiaViewModal: React.FC<LeiaViewModalProps> = memo(({ leia, isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState<ViewMode>("problem");
  const [displayLeia, setDisplayLeia] = useState<Leia | null>(leia);
  const [regenerateAnchor, setRegenerateAnchor] = useState<HTMLElement | null>(null);
  const [regeneratingTarget, setRegeneratingTarget] = useState<RegenerationTarget | null>(null);
  const [imageApiKeyId, setImageApiKeyId] = useState<string>("");
  const { user } = useAuth();
  const {
    apiKeys,
    isLoading: isApiKeysLoading,
    error: apiKeysError,
    getDefaultKey,
  } = useApiKeys();

  const geminiApiKeys = useMemo(
    () => apiKeys.filter((key) => key.provider === "gemini"),
    [apiKeys],
  );

  useEffect(() => {
    if (isOpen && leia?.id) {
      setViewMode("problem");
      setDisplayLeia(leia);
      setRegenerateAnchor(null);
    }
  }, [isOpen, leia]);

  useEffect(() => {
    setImageApiKeyId((current) => {
      if (current && geminiApiKeys.some((key) => key.id === current)) return current;
      const defaultKey = getDefaultKey();
      if (defaultKey?.provider === "gemini") return defaultKey.id;
      return geminiApiKeys[0]?.id ?? "";
    });
  }, [geminiApiKeys, getDefaultKey]);

  if (!isOpen || !displayLeia) return null;

  const problemResource = displayLeia.spec?.problem;
  const personaResource = displayLeia.spec?.persona;
  const problem = problemResource?.spec;
  const persona = personaResource?.spec;
  const behaviour = displayLeia.spec?.behaviour?.spec;
  const rubric = displayLeia.spec?.rubric;
  const isAdmin = user?.role === "admin";
  const canRegenerateLeia = isAdmin || getUserId(displayLeia.user) === user?.id;
  const canRegenerateProblem = isAdmin || getUserId(problemResource?.user) === user?.id;
  const canRegeneratePersona = isAdmin || getUserId(personaResource?.user) === user?.id;
  const avatarRegenerationOptions = [
    ...(canRegenerateLeia ? [{ label: "LEIA avatar", target: "leias" as const }] : []),
    ...(canRegenerateProblem ? [{ label: "Problem avatar", target: "problems" as const }] : []),
    ...(canRegeneratePersona ? [{ label: "Persona avatar", target: "personas" as const }] : []),
  ];
  const infographicRegenerationOptions = canRegenerateLeia
    ? [
        { label: "Infographic", target: "infographic" as const },
        { label: "Infographic with solution", target: "infographicSolution" as const },
      ]
    : [];
  const canOpenRegenerate = avatarRegenerationOptions.length > 0
    || infographicRegenerationOptions.length > 0;
  const infographicCandidates = buildStoredImageCandidateSources(
    displayLeia.spec?.infographic,
    ...buildLeiaInfographicPaths(displayLeia.id, "infographic"),
  );
  const infographicSolutionCandidates = buildStoredImageCandidateSources(
    displayLeia.spec?.infographicSolution,
    ...buildLeiaInfographicPaths(displayLeia.id, "infographicSolution"),
  );

  const getTargetId = (target: AvatarRegenerationTarget): string | null => {
    if (target === "leias") return displayLeia.id;
    if (target === "problems") return problemResource?.id || null;
    return personaResource?.id || null;
  };

  const requireImageApiKey = (): string | null => {
    if (imageApiKeyId) return imageApiKeyId;
    toast.error("Select a Gemini API key before generating images", {
      position: "bottom-right",
      autoClose: 3000,
    });
    return null;
  };

  const regenerateAvatar = async (target: AvatarRegenerationTarget, selectedImageApiKeyId: string) => {
    const targetId = getTargetId(target);
    if (!targetId) {
      throw new Error("Could not find the selected resource");
    }
    const response = await api.post(`/api/v1/images/${target}/${targetId}/generate`, {
      apiKeyId: selectedImageApiKeyId,
    });
    const avatar = cacheBustStoredImage(response.data?.avatar);

    setDisplayLeia((currentLeia) => {
      if (!currentLeia || !avatar) return currentLeia;
      if (target === "leias") {
        return { ...currentLeia, spec: { ...currentLeia.spec, avatar } };
      }
      if (target === "problems") {
        return {
          ...currentLeia,
          spec: {
            ...currentLeia.spec,
            problem: {
              ...currentLeia.spec.problem,
              spec: { ...currentLeia.spec.problem.spec, avatar },
            },
          },
        };
      }
      return {
        ...currentLeia,
        spec: {
          ...currentLeia.spec,
          persona: {
            ...currentLeia.spec.persona,
            spec: { ...currentLeia.spec.persona.spec, avatar },
          },
        },
      };
    });
  };

  const regenerateInfographic = async (target: InfographicRegenerationTarget, selectedImageApiKeyId: string) => {
    const path = target === "infographic" ? "infographic" : "infographic-solution";
    const response = await api.post(
      `/api/v1/images/leias/${displayLeia.id}/${path}/generate`,
      { apiKeyId: selectedImageApiKeyId },
    );
    const image = cacheBustStoredImage(response.data?.[target]);

    setDisplayLeia((currentLeia) => {
      if (!currentLeia || !image) return currentLeia;
      return {
        ...currentLeia,
        spec: { ...currentLeia.spec, [target]: image },
      };
    });
  };

  const handleRegenerate = async (target: RegenerationTarget) => {
    const selectedImageApiKeyId = requireImageApiKey();
    if (!selectedImageApiKeyId) return;

    setRegeneratingTarget(target);
    setRegenerateAnchor(null);
    try {
      if (target === "all") {
        const targets = [
          ...avatarRegenerationOptions.map((option) => option.target),
          ...infographicRegenerationOptions.map((option) => option.target),
        ];
        let failedCount = 0;

        // These requests can update the same LEIA document. Run them in sequence
        // so their Mongoose saves do not race and report false failures.
        for (const item of targets) {
          try {
            if (item === "infographic" || item === "infographicSolution") {
              await regenerateInfographic(item, selectedImageApiKeyId);
            } else {
              await regenerateAvatar(item, selectedImageApiKeyId);
            }
          } catch {
            failedCount += 1;
          }
        }
        if (failedCount > 0) {
          toast.warning(`${targets.length - failedCount} of ${targets.length} images regenerated`, {
            position: "bottom-right",
            autoClose: 4000,
          });
          return;
        }
      } else if (target === "infographic" || target === "infographicSolution") {
        await regenerateInfographic(target, selectedImageApiKeyId);
      } else {
        await regenerateAvatar(target, selectedImageApiKeyId);
      }

      toast.success(target === "all" ? "All images regenerated successfully" : "Image regenerated successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch (error) {
      toast.error(getRegenerationError(error), {
        position: "bottom-right",
        autoClose: 3000,
      });
    } finally {
      setRegeneratingTarget(null);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      sx={{ "& .MuiDialog-paper": { height: { xs: "92vh", md: "80vh" }, maxHeight: "none" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
          <Avatar
            src={displayLeia.spec?.avatar}
            fallbackSrc={buildOriginalAvatarPath("leias", displayLeia.id)}
            alt={`${displayLeia.metadata?.name || "LEIA"} avatar`}
            label={displayLeia.metadata?.name || "LEIA"}
            size="md"
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>{displayLeia.metadata?.name || `LEIA ${displayLeia.id}`}</Typography>
            <Typography variant="body2" color="text.secondary">View LEIA content</Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          {canOpenRegenerate && (
            <>
              <ButtonGroup variant="outlined" size="small" disabled={regeneratingTarget !== null}>
                <Button
                  startIcon={regeneratingTarget ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={() => void handleRegenerate("all")}
                >
                  {regeneratingTarget ? "Regenerating" : "Regenerate all"}
                </Button>
                <Button
                  size="small"
                  onClick={(event) => setRegenerateAnchor(event.currentTarget)}
                  aria-label="Choose images to regenerate"
                  aria-haspopup="true"
                  aria-expanded={Boolean(regenerateAnchor)}
                  sx={{ px: 0.75 }}
                >
                  <ArrowDropDownIcon />
                </Button>
              </ButtonGroup>
              <Popover
                open={Boolean(regenerateAnchor)}
                anchorEl={regenerateAnchor}
                onClose={() => setRegenerateAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { mt: 1, width: 320, maxWidth: "calc(100vw - 32px)" } } }}
              >
                <Stack spacing={1.5} sx={{ p: 2 }}>
                  <Box>
                    <Typography variant="subtitle2">Regenerate images</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Select the Gemini key used to create the new image.
                    </Typography>
                  </Box>
                  <FormControl fullWidth size="small">
                    <InputLabel id="regenerate-image-api-key-label">Gemini API key</InputLabel>
                    <Select
                      labelId="regenerate-image-api-key-label"
                      value={imageApiKeyId}
                      label="Gemini API key"
                      onChange={(event) => setImageApiKeyId(event.target.value)}
                      disabled={isApiKeysLoading || geminiApiKeys.length === 0}
                    >
                      {geminiApiKeys.map((key) => (
                        <MenuItem key={key.id} value={key.id}>
                          {key.description}{key.isDefault ? " (default)" : ""}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {isApiKeysLoading && (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CircularProgress size={14} />
                      <Typography variant="caption" color="text.secondary">Loading API keys...</Typography>
                    </Stack>
                  )}
                  {apiKeysError && <Alert severity="error">{apiKeysError}</Alert>}
                  {!isApiKeysLoading && !apiKeysError && geminiApiKeys.length === 0 && (
                    <Alert severity="info">Add a Gemini API key to regenerate images.</Alert>
                  )}
                  {avatarRegenerationOptions.length > 0 && (
                    <Stack spacing={0.5}>
                      <Typography variant="overline" color="text.secondary">Avatars</Typography>
                      {avatarRegenerationOptions.map((option) => (
                        <Button
                          key={option.target}
                          color="inherit"
                          fullWidth
                          startIcon={<ImageOutlinedIcon />}
                          onClick={() => void handleRegenerate(option.target)}
                          disabled={!imageApiKeyId}
                          sx={{ justifyContent: "flex-start" }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </Stack>
                  )}
                  {avatarRegenerationOptions.length > 0 && infographicRegenerationOptions.length > 0 && <Divider />}
                  {infographicRegenerationOptions.length > 0 && (
                    <Stack spacing={0.5}>
                      <Typography variant="overline" color="text.secondary">Infographics</Typography>
                      {infographicRegenerationOptions.map((option) => (
                        <Button
                          key={option.target}
                          color="inherit"
                          fullWidth
                          startIcon={<ImageOutlinedIcon />}
                          onClick={() => void handleRegenerate(option.target)}
                          disabled={!imageApiKeyId}
                          sx={{ justifyContent: "flex-start" }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Popover>
            </>
          )}
          <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <Tabs
        value={viewMode}
        onChange={(_, value: ViewMode) => setViewMode(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ px: 2, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Tab value="problem" label="Problem" />
        <Tab value="persona" label="Persona" />
        {user?.role === "admin" && <Tab value="behaviour" label="Behaviour" />}
        {rubric && <Tab value="rubric" label="Rubric" />}
        <Tab value="infographics" label="Infographics" />
      </Tabs>
      <DialogContent sx={{ py: 3, display: "flex", flexDirection: "column" }}>
        {viewMode === "problem" && (
          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar
                src={problem?.avatar}
                fallbackSrc={buildOriginalAvatarPath("problems", problemResource?.id)}
                alt={`${problemResource?.metadata?.name || "Problem"} avatar`}
                label={problemResource?.metadata?.name || "Problem"}
                size="lg"
              />
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>{problemResource?.metadata?.name || "Problem"}</Typography>
                <Typography variant="caption" color="text.secondary">v{problemResource?.metadata?.version || "N/A"}</Typography>
              </Box>
            </Stack>
            <ContentSection title="Problem Description">
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {problem?.description || "No description available"}
              </Typography>
            </ContentSection>
            {problem?.details && (
              <ContentSection title="Details">
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{problem.details}</Typography>
              </ContentSection>
            )}
            {problem?.solution && (
              <ContentSection title="Solution">
                <Suspense fallback={<LoadingCode label="Loading syntax highlighter..." />}>
                  <LazyCodeBlock code={problem.solution} language={problem.solutionFormat} />
                </Suspense>
              </ContentSection>
            )}
            {problem?.initialSolution && (
              <ContentSection title="Initial Solution">
                <Suspense fallback={<LoadingCode label="Loading syntax highlighter..." />}>
                  <LazyCodeBlock code={problem.initialSolution} language={problem.solutionFormat} />
                </Suspense>
              </ContentSection>
            )}
            {problem?.evaluationPrompt && (
              <ContentSection title="Evaluation Prompt">
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{problem.evaluationPrompt}</Typography>
              </ContentSection>
            )}
            {problem?.process && (
              <ContentSection title="Process">
                <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                  {problem.process.map((step, index) => <Typography component="li" variant="body2" key={`${step}-${index}`} sx={{ mb: 0.75 }}>{step}</Typography>)}
                </Box>
              </ContentSection>
            )}
          </Stack>
        )}

        {viewMode === "persona" && (
          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar
                src={persona?.avatar}
                fallbackSrc={buildOriginalAvatarPath("personas", personaResource?.id)}
                alt={`${persona?.fullName || "Persona"} avatar`}
                label={persona?.fullName || personaResource?.metadata?.name || "Persona"}
                size="lg"
              />
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>{persona?.fullName || personaResource?.metadata?.name || "Persona"}</Typography>
                <Typography variant="caption" color="text.secondary">v{personaResource?.metadata?.version || "N/A"}</Typography>
              </Box>
            </Stack>
            <ContentSection title="Persona Information">
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2 }}>
                <Box><Typography variant="overline">Full Name</Typography><Typography variant="body2">{persona?.fullName || "N/A"}</Typography></Box>
                <Box><Typography variant="overline">First Name</Typography><Typography variant="body2">{persona?.firstName || "N/A"}</Typography></Box>
              </Box>
            </ContentSection>
            {persona?.description && <ContentSection title="Description"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{persona.description}</Typography></ContentSection>}
            {persona?.personality && <ContentSection title="Personality"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{persona.personality}</Typography></ContentSection>}
            <ContentSection title="Pronouns">
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2 }}>
                <Box><Typography variant="overline">Subject</Typography><Typography variant="body2">{persona?.subjectPronoum || "N/A"}</Typography></Box>
                <Box><Typography variant="overline">Object</Typography><Typography variant="body2">{persona?.objectPronoum || "N/A"}</Typography></Box>
                <Box><Typography variant="overline">Possessive</Typography><Typography variant="body2">{persona?.possesivePronoum || "N/A"}</Typography></Box>
                <Box><Typography variant="overline">Possessive Adj.</Typography><Typography variant="body2">{persona?.possesiveAdjective || "N/A"}</Typography></Box>
              </Box>
            </ContentSection>
          </Stack>
        )}

        {viewMode === "behaviour" && user?.role === "admin" && (
          <Stack spacing={2.5}>
            <ContentSection title="Behaviour Configuration">
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{behaviour?.description || "No description available"}</Typography>
            </ContentSection>
            {behaviour?.role && <ContentSection title="Role"><Typography variant="body2">{behaviour.role}</Typography></ContentSection>}
            {behaviour?.process && (
              <ContentSection title="Process">
                <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                  {behaviour.process.map((step, index) => <Typography component="li" variant="body2" key={`${step}-${index}`} sx={{ mb: 0.75 }}>{step}</Typography>)}
                </Box>
              </ContentSection>
            )}
            {behaviour?.tooltip && <ContentSection title="Initial Tooltip"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{behaviour.tooltip}</Typography></ContentSection>}
          </Stack>
        )}

        {viewMode === "rubric" && rubric && (
          <Stack spacing={2.5}>
            <Typography variant="subtitle1" fontWeight={700}>{rubric.metadata.name}</Typography>
            <RubricPreview markdown={rubric.spec.markdown} />
          </Stack>
        )}

        {viewMode === "infographics" && (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Infographics</Typography>
              <Typography variant="body2" color="text.secondary">
                Student and instructor versions generated for this LEIA.
              </Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
              <InfographicViewer
                candidateSources={infographicCandidates}
                title="Infographic"
              />
              <InfographicViewer
                candidateSources={infographicSolutionCandidates}
                title="Infographic with solution"
              />
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
});
