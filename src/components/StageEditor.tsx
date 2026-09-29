import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  ActivityOrchestration,
  Experiment,
  Stage,
} from "../models/Experiment";
import api from "../lib/axios";

const kinds: Stage["type"][] = [
  "LEIAStage",
  "MultiLEIAStage",
  "StaticContentStage",
];
const labels = {
  LEIAStage: "LEIA",
  MultiLEIAStage: "MultiLEIA",
  StaticContentStage: "Static content",
};
const orchestrationDefaults: ActivityOrchestration = {
  mode: "multi",
  maxInternalTurns: 2,
  openingLeiaId: null,
  problemLeiaId: null,
  sharedTask: "",
};

// Existing assignment activities remain unchanged until their author saves a stage flow.
function initialStages(experiment: Experiment): Stage[] {
  if (experiment.stages) return experiment.stages;
  if (experiment.orchestration?.mode === "multi")
    return [
      {
        id: `multi-${experiment.id}`,
        version: 1,
        type: "MultiLEIAStage",
        title: "MultiLEIA",
        config: {
          leiaIds: experiment.leias.map((entry) => entry.id),
          orchestration: experiment.orchestration,
        },
      },
    ];
  return experiment.leias.map((entry, index) => ({
    id: `leia-${entry.id}`,
    version: 1,
    type: "LEIAStage",
    title:
      typeof entry.leia === "object"
        ? entry.leia.metadata?.name || `Stage ${index + 1}`
        : `Stage ${index + 1}`,
    config: { leiaId: entry.id },
  }));
}

export function StageEditor({
  experiment,
  onSaved,
}: {
  experiment: Experiment;
  onSaved: (value: Experiment) => void;
}) {
  const [stages, setStages] = useState<Stage[]>(() =>
    initialStages(experiment),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setStages(initialStages(experiment));
    setError("");
  }, [experiment]);
  const selected = stages.find((stage) => stage.id === selectedId);
  const locked = experiment.isPublished || saving;
  const name = (id: string) => {
    const entry = experiment.leias.find((candidate) => candidate.id === id);
    return entry && typeof entry.leia === "object"
      ? entry.leia.metadata?.name || id
      : id;
  };
  const add = (type: Stage["type"], index = stages.length) => {
    if (locked) return;
    const stage: Stage = {
      id: crypto.randomUUID(),
      type,
      version: 1,
      title: labels[type],
      config:
        type === "StaticContentStage"
          ? { content: "" }
          : type === "LEIAStage"
            ? { leiaId: experiment.leias[0]?.id || "" }
            : {
                leiaIds: experiment.leias.map((entry) => entry.id),
                orchestration: { ...orchestrationDefaults },
              },
    };
    setStages((previous) => [
      ...previous.slice(0, index),
      stage,
      ...previous.slice(index),
    ]);
    setSelectedId(stage.id);
  };
  const move = (id: string, index: number) => {
    if (locked) return;
    setStages((previous) => {
      const source = previous.findIndex((stage) => stage.id === id);
      if (source < 0) return previous;
      const next = previous.filter((stage) => stage.id !== id);
      next.splice(
        Math.max(0, Math.min(index, next.length)),
        0,
        previous[source],
      );
      return next;
    });
  };
  const update = (change: Partial<Stage>) =>
    setStages((previous) =>
      previous.map((stage) =>
        stage.id === selectedId ? { ...stage, ...change } : stage,
      ),
    );
  const config = (change: Partial<Stage["config"]>) =>
    selected && update({ config: { ...selected.config, ...change } });
  const orchestration = {
    ...orchestrationDefaults,
    ...selected?.config.orchestration,
  };
  const drop = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const type = event.dataTransfer.getData(
      "application/stage-type",
    ) as Stage["type"];
    if (kinds.includes(type)) add(type, index);
    else move(event.dataTransfer.getData("application/stage-id"), index);
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(
        (
          await api.patch<Experiment>(
            `/api/v1/experiments/${experiment.id}/stages`,
            { stages },
          )
        ).data,
      );
    } catch (error: unknown) {
      setError(
        (
          error as {
            response?: { data?: { message?: string; error?: string } };
          }
        ).response?.data?.message ||
          (error as { response?: { data?: { error?: string } } }).response?.data
            ?.error ||
          "Could not save stages",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Box sx={{ p: 2.5 }}>
      <Typography variant="h6">Activity stages</Typography>
      {!experiment.stages && (
        <Alert severity="info" sx={{ my: 2 }}>
          Save this flow to convert the activity to sequential stages. Each
          participant will follow the stages in order.
        </Alert>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "180px minmax(200px, 1fr) minmax(260px, 1fr)",
          },
          gap: 2,
          mt: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Add a stage
          </Typography>
          <Stack spacing={1}>
            {kinds.map((type) => (
              <Button
                key={type}
                disabled={locked}
                draggable={!locked}
                variant="outlined"
                onDragStart={(event) =>
                  event.dataTransfer.setData("application/stage-type", type)
                }
                onClick={() => add(type)}
              >
                {labels[type]}
              </Button>
            ))}
          </Stack>
        </Paper>
        <Paper
          variant="outlined"
          aria-label="Stage canvas"
          sx={{ p: 2, minHeight: 260 }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => drop(event, stages.length)}
        >
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Stage sequence
          </Typography>
          {!stages.length && (
            <Typography color="text.secondary">
              Drop stages here, or use Add a stage.
            </Typography>
          )}
          <Stack spacing={1}>
            {stages.map((stage, index) => (
              <Paper
                key={stage.id}
                variant="outlined"
                draggable={!locked}
                onDragStart={(event) =>
                  event.dataTransfer.setData("application/stage-id", stage.id)
                }
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(event, index)}
                sx={{
                  p: 1,
                  borderColor:
                    selectedId === stage.id ? "primary.main" : "divider",
                }}
              >
                <Button
                  fullWidth
                  sx={{ justifyContent: "flex-start" }}
                  onClick={() => setSelectedId(stage.id)}
                >
                  {index + 1}. {stage.title}
                </Button>
                <Typography variant="caption">{labels[stage.type]}</Typography>
                {!locked && (
                  <Stack direction="row">
                    <Button
                      size="small"
                      aria-label={`Move ${stage.title} up`}
                      disabled={!index}
                      onClick={() => move(stage.id, index - 1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="small"
                      aria-label={`Move ${stage.title} down`}
                      disabled={index === stages.length - 1}
                      onClick={() => move(stage.id, index + 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      color="error"
                      size="small"
                      onClick={() => {
                        setStages(
                          stages.filter((item) => item.id !== stage.id),
                        );
                        if (stage.id === selectedId) setSelectedId(null);
                      }}
                    >
                      Remove
                    </Button>
                  </Stack>
                )}
              </Paper>
            ))}
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Stage configuration
          </Typography>
          {!selected ? (
            <Typography color="text.secondary">
              Select a stage on the canvas.
            </Typography>
          ) : (
            <Stack spacing={2}>
              <TextField
                disabled={locked}
                label="Title"
                value={selected.title}
                onChange={(event) => update({ title: event.target.value })}
              />
              {selected.type === "StaticContentStage" ? (
                <TextField
                  disabled={locked}
                  label="Content (Markdown)"
                  multiline
                  minRows={8}
                  value={selected.config.content || ""}
                  onChange={(event) => config({ content: event.target.value })}
                />
              ) : (
                <>
                  {!experiment.leias.length && (
                    <Alert severity="info">
                      Add LEIAs to this activity to select them here.
                    </Alert>
                  )}
                  {selected.type === "LEIAStage" ? (
                    <TextField
                      select
                      disabled={locked}
                      label="LEIA"
                      value={selected.config.leiaId || ""}
                      onChange={(event) =>
                        config({ leiaId: event.target.value })
                      }
                    >
                      {experiment.leias.map((entry) => (
                        <MenuItem key={entry.id} value={entry.id}>
                          {name(entry.id)}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <>
                      <TextField
                        select
                        disabled={locked}
                        label="LEIAs"
                        SelectProps={{ multiple: true }}
                        value={selected.config.leiaIds || []}
                        onChange={(event) => {
                          const ids =
                            typeof event.target.value === "string"
                              ? event.target.value.split(",")
                              : event.target.value;
                          config({
                            leiaIds: ids,
                            orchestration: {
                              ...orchestration,
                              openingLeiaId: null,
                              problemLeiaId: null,
                            },
                          });
                        }}
                      >
                        {experiment.leias.map((entry) => (
                          <MenuItem key={entry.id} value={entry.id}>
                            {name(entry.id)}
                          </MenuItem>
                        ))}
                      </TextField>
                      {(["openingLeiaId", "problemLeiaId"] as const).map(
                        (key) => (
                          <TextField
                            key={key}
                            select
                            disabled={locked}
                            label={
                              key === "openingLeiaId"
                                ? "First speaker"
                                : "Shared problem"
                            }
                            value={orchestration[key] || ""}
                            onChange={(event) =>
                              config({
                                orchestration: {
                                  ...orchestration,
                                  [key]: event.target.value || null,
                                },
                              })
                            }
                          >
                            <MenuItem value="">First selected LEIA</MenuItem>
                            {(selected.config.leiaIds || []).map((id) => (
                              <MenuItem key={id} value={id}>
                                {name(id)}
                              </MenuItem>
                            ))}
                          </TextField>
                        ),
                      )}
                      <TextField
                        disabled={locked}
                        type="number"
                        label="Maximum messages per round"
                        inputProps={{ min: 1, max: 8 }}
                        value={orchestration.maxInternalTurns}
                        onChange={(event) =>
                          config({
                            orchestration: {
                              ...orchestration,
                              maxInternalTurns: Number(event.target.value),
                            },
                          })
                        }
                      />
                      <TextField
                        disabled={locked}
                        label="Shared task"
                        multiline
                        value={orchestration.sharedTask}
                        onChange={(event) =>
                          config({
                            orchestration: {
                              ...orchestration,
                              sharedTask: event.target.value,
                            },
                          })
                        }
                      />
                    </>
                  )}
                </>
              )}
              <Typography variant="caption">
                Produces:{" "}
                {selected.type === "StaticContentStage"
                  ? "content"
                  : "previousConversation, previousSolution"}
              </Typography>
              <Typography variant="caption">
                Reference an artifact using {"{{previousStage.artifactName}}"}.
                Only artifacts from the immediately preceding stage are
                available.
              </Typography>
            </Stack>
          )}
        </Paper>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {!experiment.isPublished && (
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => void save()}
          sx={{ mt: 2 }}
        >
          {saving ? "Saving…" : "Save stages"}
        </Button>
      )}
    </Box>
  );
}
