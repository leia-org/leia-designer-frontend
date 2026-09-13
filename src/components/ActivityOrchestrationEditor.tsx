import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import type {
  ActivityOrchestration,
  Experiment,
} from "../models/Experiment";
import api from "../lib/axios";

interface ActivityOrchestrationEditorProps {
  experiment: Experiment;
  onSaved: (experiment: Experiment) => void;
}

const DEFAULT_ORCHESTRATION: ActivityOrchestration = {
  mode: "single",
  maxInternalTurns: 2,
  openingLeiaId: null,
  problemLeiaId: null,
  sharedTask: "",
};

const leiaName = (experiment: Experiment, leiaConfigId: string | null) => {
  const entry = experiment.leias.find((candidate) => candidate.id === leiaConfigId);
  if (!entry || typeof entry.leia !== "object") return "LEIA";
  return entry.leia.metadata?.name || "LEIA";
};

export const ActivityOrchestrationEditor = ({
  experiment,
  onSaved,
}: ActivityOrchestrationEditorProps) => {
  const initial = useMemo<ActivityOrchestration>(() => ({
    ...DEFAULT_ORCHESTRATION,
    ...experiment.orchestration,
    openingLeiaId:
      experiment.orchestration?.openingLeiaId || experiment.leias[0]?.id || null,
    problemLeiaId:
      experiment.orchestration?.problemLeiaId ||
      experiment.orchestration?.openingLeiaId ||
      experiment.leias[0]?.id ||
      null,
  }), [experiment]);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(initial);
    setError("");
  }, [initial]);

  const hasTranscription = experiment.leias.some(
    (entry) => entry.configuration?.mode === "transcription",
  );
  const canUseMultiLeia = experiment.leias.length >= 2 && !hasTranscription;
  const isDirty = JSON.stringify(value) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await api.patch<Experiment>(
        `/api/v1/experiments/${experiment.id}/orchestration`,
        value,
      );
      onSaved(response.data);
    } catch (requestError: unknown) {
      const message =
        requestError &&
        typeof requestError === "object" &&
        "response" in requestError
          ? ((requestError as { response?: { data?: { error?: string; message?: string } } })
              .response?.data?.error ||
            (requestError as { response?: { data?: { error?: string; message?: string } } })
              .response?.data?.message)
          : null;
      setError(message || "Could not save the activity conversation flow");
    } finally {
      setSaving(false);
    }
  };

  if (experiment.isPublished) {
    return (
      <Box sx={{ px: 2.5, py: 2, bgcolor: "surfaces.subtle" }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <AccountTreeOutlinedIcon color="primary" fontSize="small" />
          <Box>
            <Typography variant="subtitle2">
              {initial.mode === "multi" ? "MultiLEIA conversation" : "Single LEIA assignment"}
            </Typography>
            {initial.mode === "multi" && (
              <Typography variant="caption" color="text.secondary">
                Prefers {leiaName(experiment, initial.openingLeiaId)} as the fallback first speaker, uses the problem from {leiaName(experiment, initial.problemLeiaId)}, and lets the orchestrator route up to {initial.maxInternalTurns} LEIA messages before returning to the participant.
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2.5, py: 2.5, bgcolor: "surfaces.subtle" }}>
      <Stack spacing={2}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <AccountTreeOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={600}>
              Conversation flow
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Choose whether participants receive one LEIA or interact with all LEIAs.
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          label="Activity mode"
          value={value.mode}
          onChange={(event) => {
            const mode = event.target.value as "single" | "multi";
            setValue((previous) => ({
              ...previous,
              mode,
              openingLeiaId:
                mode === "multi"
                  ? previous.openingLeiaId || experiment.leias[0]?.id || null
                  : null,
              problemLeiaId:
                mode === "multi"
                  ? previous.problemLeiaId || experiment.leias[0]?.id || null
                  : null,
            }));
          }}
          sx={{ maxWidth: 320 }}
        >
          <MenuItem value="single">Single LEIA assignment</MenuItem>
          <MenuItem value="multi" disabled={!canUseMultiLeia}>
            MultiLEIA conversation
          </MenuItem>
        </TextField>

        {!canUseMultiLeia && (
          <Alert severity="info">
            MultiLEIA requires at least two LEIAs, all configured in standard text mode.
          </Alert>
        )}

        {value.mode === "multi" && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                size="small"
                label="Preferred first LEIA"
                value={value.openingLeiaId || ""}
                onChange={(event) =>
                  setValue((previous) => ({
                    ...previous,
                    openingLeiaId: event.target.value,
                  }))
                }
                sx={{ minWidth: 240 }}
              >
                {experiment.leias.map((entry, index) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {typeof entry.leia === "object"
                      ? entry.leia.metadata?.name
                      : `LEIA ${index + 1}`}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Maximum LEIA messages per round"
                value={value.maxInternalTurns}
                onChange={(event) =>
                  setValue((previous) => ({
                    ...previous,
                    maxInternalTurns: Number(event.target.value),
                  }))
                }
                sx={{ minWidth: 240 }}
              >
                {Array.from({ length: 8 }, (_, index) => index + 1).map((turns) => (
                  <MenuItem key={turns} value={turns}>
                    {turns}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              This is a safety limit. The orchestrator can stop after one message or route additional LEIAs when their roles add value.
            </Typography>
            <TextField
              select
              size="small"
              label="Shared problem"
              value={value.problemLeiaId || ""}
              onChange={(event) =>
                setValue((previous) => ({
                  ...previous,
                  problemLeiaId: event.target.value,
                }))
              }
              helperText="This problem provides the scenario, widgets, solution and evaluation for every LEIA."
              sx={{ maxWidth: 520 }}
            >
              {experiment.leias.map((entry, index) => (
                <MenuItem key={entry.id} value={entry.id}>
                  {typeof entry.leia === "object"
                    ? entry.leia.spec?.problem?.metadata?.name ||
                      entry.leia.metadata?.name
                    : `LEIA ${index + 1}`}
                </MenuItem>
              ))}
            </TextField>
            <Alert severity="info">
              Every LEIA keeps its own persona and behaviour. Its original problem is ignored in this activity, and the behaviour is applied to the shared problem instead.
            </Alert>
            <TextField
              label="Shared task"
              placeholder="Describe the common scenario and objective that every LEIA should know."
              value={value.sharedTask}
              onChange={(event) =>
                setValue((previous) => ({
                  ...previous,
                  sharedTask: event.target.value,
                }))
              }
              multiline
              minRows={2}
              maxRows={5}
              fullWidth
            />
          </Stack>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={!isDirty || saving || (value.mode === "multi" && !canUseMultiLeia)}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? "Saving..." : "Save flow"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
