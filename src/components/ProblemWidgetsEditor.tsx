import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import {
  Box,
  Button,
  Collapse,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  WIDGET_CATALOG,
  SLOT_OPTIONS,
  findWidgetEntry,
  JsonParamsForm,
} from "../widgets/catalog";
import type { SlotId } from "../widgets/catalog";
import type { ProblemWidget, ProblemWidgetTool } from "../models/Leia";

interface ProblemWidgetsEditorProps {
  widgets: ProblemWidget[];
  onChange: (next: ProblemWidget[]) => void;
}

function getToolEntry(widget: ProblemWidget, toolName: string): ProblemWidgetTool {
  return widget.tools?.find((tool) => tool.name === toolName) ?? {
    name: toolName,
    enabled: true,
    usage: "",
  };
}

function upsertTool(
  widget: ProblemWidget,
  toolName: string,
  patch: Partial<ProblemWidgetTool>,
): ProblemWidgetTool[] {
  const existing = widget.tools ?? [];
  const index = existing.findIndex((tool) => tool.name === toolName);
  const base: ProblemWidgetTool =
    index >= 0 ? existing[index] : { name: toolName, enabled: true, usage: "" };
  const updated = { ...base, ...patch };
  return index >= 0
    ? existing.map((tool, itemIndex) => (itemIndex === index ? updated : tool))
    : [...existing, updated];
}

export function ProblemWidgetsEditor({ widgets, onChange }: ProblemWidgetsEditorProps) {
  const addWidget = () => {
    const defaultType = WIDGET_CATALOG[0]?.widgetType;
    if (!defaultType) return;
    const entry = findWidgetEntry(defaultType);
    const taken = new Set(widgets.map((widget) => widget.slot));
    const nextSlot = (SLOT_OPTIONS.find((slot) => !taken.has(slot.id))?.id ?? "right") as SlotId;
    onChange([...widgets, { widgetType: defaultType, slot: nextSlot, params: entry?.defaultParams }]);
  };

  return (
    <Box sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="subtitle2">Widgets &amp; tools</Typography>
        <Button type="button" variant="contained" size="small" startIcon={<AddIcon />} onClick={addWidget}>
          Add widget
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        Widgets the workbench mounts for this activity. Each widget exposes tool calls LEIA can use in both voice
        (Luke) and text mode. You configure the widget and when LEIA should use each tool — the tool&apos;s behaviour
        itself is fixed by the platform.
      </Typography>

      {widgets.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 2, fontStyle: "italic" }}>
          No widgets configured.
        </Typography>
      ) : (
        <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", p: 0, m: 0, mt: 2 }}>
          {widgets.map((widget, index) => (
            <WidgetRow
              key={index}
              widget={widget}
              onChange={(patch) => onChange(widgets.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))}
              onRemove={() => onChange(widgets.filter((_, itemIndex) => itemIndex !== index))}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

interface WidgetRowProps {
  widget: ProblemWidget;
  onChange: (patch: Partial<ProblemWidget>) => void;
  onRemove: () => void;
}

function WidgetRow({ widget, onChange, onRemove }: WidgetRowProps) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const entry = findWidgetEntry(widget.widgetType);
  const ParamsForm = entry?.ParamsForm ?? JsonParamsForm;

  return (
    <Paper component="li" variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        <TextField
          select
          label="Widget"
          value={widget.widgetType}
          onChange={(event) => {
            const nextEntry = findWidgetEntry(event.target.value);
            onChange({ widgetType: event.target.value, params: nextEntry?.defaultParams, tools: undefined });
          }}
          fullWidth
        >
          {WIDGET_CATALOG.map((catalogEntry) => (
            <MenuItem key={catalogEntry.widgetType} value={catalogEntry.widgetType}>
              {catalogEntry.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Slot"
          value={widget.slot ?? "right"}
          onChange={(event) => onChange({ slot: event.target.value as SlotId })}
          fullWidth
        >
          {SLOT_OPTIONS.map((slot) => (
            <MenuItem key={slot.id} value={slot.id}>
              {slot.label}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="button"
            color="error"
            size="small"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            onClick={onRemove}
          >
            Remove widget
          </Button>
        </Box>
      </Stack>

      {entry && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          {entry.description}
        </Typography>
      )}

      <Box sx={{ mt: 1.5 }}>
        <Button
          type="button"
          color="primary"
          size="small"
          startIcon={paramsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setParamsOpen((open) => !open)}
        >
          Configure problem &amp; tests
        </Button>
        <Collapse in={paramsOpen} unmountOnExit>
          <Box sx={{ mt: 1.5 }}>
            <ParamsForm value={widget.params} onChange={(params) => onChange({ params })} />
            {entry && (
              <Button
                type="button"
                color="inherit"
                size="small"
                startIcon={<RestartAltIcon />}
                sx={{ mt: 1.5 }}
                onClick={() => onChange({ params: entry.defaultParams })}
              >
                Reset to default
              </Button>
            )}
          </Box>
        </Collapse>
      </Box>

      {entry && entry.tools.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Button
            type="button"
            color="primary"
            size="small"
            startIcon={toolsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setToolsOpen((open) => !open)}
          >
            Tools ({entry.tools.length})
          </Button>
          <Collapse in={toolsOpen} unmountOnExit>
            <Stack component="ul" spacing={1} sx={{ listStyle: "none", p: 0, m: 0, mt: 1.5 }}>
              {entry.tools.map((tool) => {
                const state = getToolEntry(widget, tool.name);
                const enabled = state.enabled !== false;
                return (
                  <Paper component="li" key={tool.name} variant="outlined" sx={{ p: 1.25, bgcolor: "surfaces.subtle" }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={enabled}
                          onChange={(event) => onChange({ tools: upsertTool(widget, tool.name, { enabled: event.target.checked }) })}
                        />
                      }
                      label={
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Typography variant="caption" fontWeight={600}>{tool.label}</Typography>
                          <Typography className="mono" variant="caption" color="text.disabled">{tool.name}</Typography>
                        </Stack>
                      }
                      sx={{ m: 0 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, ml: 5 }}>
                      {tool.description}
                    </Typography>
                    <TextField
                      value={state.usage ?? ""}
                      disabled={!enabled}
                      onChange={(event) => onChange({ tools: upsertTool(widget, tool.name, { usage: event.target.value }) })}
                      placeholder="When should LEIA use this tool in this activity? (optional)"
                      multiline
                      rows={2}
                      fullWidth
                      sx={{ mt: 1, pl: 5 }}
                    />
                  </Paper>
                );
              })}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Paper>
  );
}
