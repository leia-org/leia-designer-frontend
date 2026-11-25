import { useState } from "react";
import { Alert, Avatar, Button, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { isAxiosError } from "axios";
import api from "../lib/axios";
import type { ActivityStage, Experiment, StageOutput } from "../models/Experiment";
import {
  getStageOutputSource,
  STAGE_OUTPUT_PATTERNS,
  stageHasEmptyTranscription,
} from "../lib/activityStages";

const STAGE_OUTPUTS: ReadonlyArray<{
  key: StageOutput;
  label: string;
  summary: string;
  pattern: RegExp;
}> = [
  {
    key: "conversation",
    label: "Source of conversation output",
    summary: "Conversation",
    pattern: STAGE_OUTPUT_PATTERNS.conversation,
  },
  {
    key: "submitedSolution",
    label: "Source of submitted solution output",
    summary: "Submitted solution",
    pattern: STAGE_OUTPUT_PATTERNS.submitedSolution,
  },
  {
    key: "problem",
    label: "Source of previous stage problem",
    summary: "Problem",
    pattern: STAGE_OUTPUT_PATTERNS.problem,
  },
];

const getOutputSource = getStageOutputSource;

interface ActivityStagesEditorProps {
  experiment: Experiment;
  onSaved: (experiment: Experiment) => void;
}

export function ActivityStagesEditor({ experiment, onSaved }: ActivityStagesEditorProps) {
  const [draft, setDraft] = useState<ActivityStage[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stages = draft ?? experiment.stages ?? [];

  const change = (id: string, fields: Partial<ActivityStage>) => {
    setDraft(stages.map((stage) => stage.id === id ? { ...stage, ...fields } : stage));
  };

  const changeOutputSource = (stage: ActivityStage, output: StageOutput, value: string) => {
    change(stage.id, {
      outputSources: {
        conversation: getOutputSource(stage, "conversation"),
        submitedSolution: getOutputSource(stage, "submitedSolution"),
        problem: getOutputSource(stage, "problem"),
        [output]: value || null,
      },
    });
  };

  const move = (index: number, offset: number) => {
    const next = [...stages];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setDraft(next.map((stage, position) => {
      const earlierIds = new Set(next.slice(0, position).map(({ id }) => id));
      const keepEarlier = (sourceId: string | null) =>
        sourceId && earlierIds.has(sourceId) ? sourceId : null;
      return {
        ...stage,
        outputSources: {
          conversation: keepEarlier(getOutputSource(stage, "conversation")),
          submitedSolution: keepEarlier(getOutputSource(stage, "submitedSolution")),
          problem: keepEarlier(getOutputSource(stage, "problem")),
        },
      };
    }));
  };

  const add = () => {
    setDraft([...stages, {
      id: crypto.randomUUID(),
      outputSources: { conversation: null, submitedSolution: null, problem: null },
      orchestration: {
        mode: "single", maxInternalTurns: 2,
        openingLeiaId: null, problemLeiaId: null, sharedTask: "",
      },
    }]);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await api.patch<Experiment>(`/api/v1/experiments/${experiment.id}/stages`, { stages });
      onSaved(data);
      setDraft(null);
    } catch (err) {
      setError((isAxiosError(err) && err.response?.data?.message) || "Could not save stages");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ p: 2.5, bgcolor: "surfaces.subtle" }}>
      <Typography variant="subtitle1" fontWeight={600}>Activity stages</Typography>
      {!experiment.isPublished && (
        <Typography variant="body2" color="text.secondary">
          Save the stages, then assign LEIAs from the LEIA library.
        </Typography>
      )}
      {stages.map((stage, index) => {
        const entries = experiment.leias.filter((entry) => entry.stageId === stage.id);
        const options = entries.map((entry, entryIndex) => ({
          id: entry.id,
          label: (typeof entry.leia === "object" && entry.leia?.metadata.name) || `LEIA ${entryIndex + 1}`,
        }));
        const getStageTemplates = (leia: unknown) => {
          if (!leia || typeof leia !== "object") return [];
          const spec = (leia as {
            spec?: {
              behaviour?: { spec?: { description?: string } };
              rubric?: { spec?: { evaluationPrompt?: string } };
            };
          }).spec;
          return [spec?.behaviour?.spec?.description ?? "", spec?.rubric?.spec?.evaluationPrompt ?? ""];
        };
        const hasAnyReference = entries.some(({ leia }) =>
          getStageTemplates(leia).some((template) => /{{\s*previousStage\b/.test(template)));
        const referencedOutputs = STAGE_OUTPUTS.filter(({ pattern }) => entries.some(({ leia }) =>
          getStageTemplates(leia).some((template) => pattern.test(template))));
        const flow = stage.orchestration;
        const publishedSourcesSummary = referencedOutputs.map(({ key, summary }) => {
          const sourceIndex = stages.findIndex(({ id }) => id === getOutputSource(stage, key));
          return sourceIndex >= 0 ? ` · ${summary} from Stage ${sourceIndex + 1}` : "";
        }).join("");
        return (
          <Stack key={stage.id} spacing={1.5} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Avatar role="img" aria-label={`Stage ${index + 1}`}
                sx={{ width: 28, height: 28, flexShrink: 0, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 14, fontWeight: 600 }}>
                {index + 1}
              </Avatar>
              <Typography fontWeight={600} color={options.length ? "text.primary" : "text.secondary"}>
                {options.map(({ label }) => label).join(", ") || "No LEIAs assigned"}
              </Typography>
            </Stack>
            {experiment.isPublished ? (
              <Typography variant="body2" color="text.secondary">
                {flow.mode === "multi" ? "MultiLEIA" : "Single LEIA assignment"}
                {publishedSourcesSummary}
              </Typography>
            ) : (
              <>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <IconButton size="small" aria-label="Move up" title="Move up"
                    disabled={saving || index === 0} onClick={() => move(index, -1)}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" aria-label="Move down" title="Move down"
                    disabled={saving || index === stages.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" aria-label="Remove stage" title="Remove stage"
                    disabled={saving || entries.length > 0 || stages.length === 1}
                    onClick={() => setDraft(stages.filter(({ id }) => id !== stage.id).map((other) => {
                      const clearRemoved = (sourceId: string | null) =>
                        sourceId === stage.id ? null : sourceId;
                      const conversation = clearRemoved(getOutputSource(other, "conversation"));
                      const submitedSolution = clearRemoved(getOutputSource(other, "submitedSolution"));
                      const problem = clearRemoved(getOutputSource(other, "problem"));
                      if (
                        other.outputSources?.conversation !== stage.id &&
                        other.outputSources?.submitedSolution !== stage.id &&
                        other.outputSources?.problem !== stage.id
                      ) {
                        return other;
                      }
                      return {
                        ...other,
                        outputSources: { conversation, submitedSolution, problem },
                      };
                    }))}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField select size="small" label="Conversation mode" value={flow.mode} disabled={saving}
                  onChange={(event) => change(stage.id, {
                    orchestration: { ...flow, mode: event.target.value === "multi" ? "multi" : "single" },
                  })}>
                  <MenuItem value="single">Single LEIA assignment</MenuItem>
                  <MenuItem value="multi" disabled={entries.length < 2 || entries.some((entry) => entry.configuration?.mode === "transcription")}>
                    MultiLEIA conversation
                  </MenuItem>
                </TextField>
                {flow.mode === "multi" && (
                  <>
                    {entries.some(({ leia }) => {
                      if (!leia || typeof leia !== "object") return false;
                      const dynamics = (leia.spec?.behaviour?.spec as {
                        conversationDynamics?: {
                          leiaSpeaksFirst?: { enabled?: boolean };
                          stoppingCondition?: { enabled?: boolean };
                        };
                      } | undefined)?.conversationDynamics;
                      const widgets = (leia.spec?.problem?.spec as { widgets?: unknown[] } | undefined)?.widgets;
                      return Boolean(
                        dynamics?.leiaSpeaksFirst?.enabled ||
                        dynamics?.stoppingCondition?.enabled ||
                        (Array.isArray(widgets) && widgets.length > 0),
                      );
                    }) && (
                      <Alert severity="info">
                        Conversation dynamics and problem widgets are only active in single-LEIA stages and will be ignored in MultiLEIA mode.
                      </Alert>
                    )}
                    {(["openingLeiaId", "problemLeiaId"] as const).map((field) => (
                      <TextField key={field} select size="small" label={field === "openingLeiaId" ? "Preferred first LEIA" : "Shared problem"}
                        disabled={saving} value={flow[field] ?? options[0]?.id ?? ""}
                        onChange={(event) => change(stage.id, { orchestration: { ...flow, [field]: event.target.value } })}>
                        {options.map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
                      </TextField>
                    ))}
                    <TextField select size="small" label="Maximum LEIA messages per round" value={flow.maxInternalTurns}
                      disabled={saving} onChange={(event) => change(stage.id, {
                        orchestration: { ...flow, maxInternalTurns: Number(event.target.value) },
                      })}>
                      {Array.from({ length: 8 }, (_, turn) => <MenuItem key={turn} value={turn + 1}>{turn + 1}</MenuItem>)}
                    </TextField>
                    <TextField size="small" multiline label="Shared task" value={flow.sharedTask} disabled={saving}
                      onChange={(event) => change(stage.id, { orchestration: { ...flow, sharedTask: event.target.value } })} />
                  </>
                )}
                {hasAnyReference && index === 0 && <Alert severity="error">Move this stage after its source stage.</Alert>}
                {index > 0 && referencedOutputs.map(({ key, label }) => {
                  const sourceId = getOutputSource(stage, key);
                  const sourceIndex = sourceId ? stages.findIndex(({ id }) => id === sourceId) : -1;
                  const emptyTranscriptionSource =
                    key === "conversation" &&
                    Boolean(sourceId) &&
                    stageHasEmptyTranscription(experiment, sourceId!);
                  return (
                    <TextField key={key} select size="small" label={label} value={sourceId ?? ""}
                      disabled={saving} required error={!sourceId || emptyTranscriptionSource}
                      helperText={
                        !sourceId
                          ? "Choose an earlier stage before publishing or replicating the activity."
                          : emptyTranscriptionSource && sourceIndex >= 0
                            ? `Add transcription chat messages to Stage ${sourceIndex + 1} before publishing or replicating.`
                            : undefined
                      }
                      onChange={(event) => changeOutputSource(stage, key, event.target.value)}>
                      <MenuItem value="">None</MenuItem>
                      {stages.slice(0, index).map((earlier, earlierIndex) => (
                        <MenuItem key={earlier.id} value={earlier.id}>
                          Stage {earlierIndex + 1}
                        </MenuItem>
                      ))}
                    </TextField>
                  );
                })}
              </>
            )}
          </Stack>
        );
      })}
      {error && <Alert severity="error">{error}</Alert>}
      {!experiment.isPublished && (
        <Stack direction="row" justifyContent="space-between">
          <Button disabled={saving} onClick={add}>Add stage</Button>
          <Button variant="contained" disabled={!draft || saving}
            onClick={() => void save()}>{saving ? "Saving..." : "Save stages"}</Button>
        </Stack>
      )}
    </Stack>
  );
}
