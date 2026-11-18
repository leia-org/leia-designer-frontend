import { useState } from "react";
import { Alert, Avatar, Button, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { isAxiosError } from "axios";
import api from "../lib/axios";
import type { ActivityStage, Experiment } from "../models/Experiment";

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

  const move = (index: number, offset: number) => {
    const next = [...stages];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setDraft(next.map((stage, position) =>
      next.slice(0, position).some(({ id }) => id === stage.previousStageId)
        ? stage
        : { ...stage, previousStageId: null },
    ));
  };

  const add = () => {
    setDraft([...stages, {
      id: crypto.randomUUID(),
      previousStageId: null,
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
        const references = entries.some(({ leia }) => typeof leia === "object" &&
          /{{\s*previousStage\b/.test(leia?.spec?.behaviour?.spec?.description ?? ""));
        const flow = stage.orchestration;
        const sourceIndex = stages.findIndex(({ id }) => id === stage.previousStageId);
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
                {references && sourceIndex >= 0 && ` · Uses outputs from Stage ${sourceIndex + 1}`}
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
                    onClick={() => setDraft(stages.filter(({ id }) => id !== stage.id).map((other) =>
                      other.previousStageId === stage.id ? { ...other, previousStageId: null } : other,
                    ))}>
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
                {references && index === 0 && <Alert severity="error">Move this stage after its source stage.</Alert>}
                {references && index > 0 && (
                  <TextField select size="small" label="Source of previous stage outputs" value={stage.previousStageId ?? ""}
                    disabled={saving} required error={!stage.previousStageId}
                    helperText={!stage.previousStageId ? "Choose an earlier stage before publishing the activity." : undefined}
                    onChange={(event) => change(stage.id, { previousStageId: event.target.value || null })}>
                    <MenuItem value="">None</MenuItem>
                    {stages.slice(0, index).map((earlier, earlierIndex) => (
                      <MenuItem key={earlier.id} value={earlier.id}>Stage {earlierIndex + 1}</MenuItem>
                    ))}
                  </TextField>
                )}
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
