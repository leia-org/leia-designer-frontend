import { useState } from "react";
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
  return (
    widget.tools?.find((t) => t.name === toolName) ?? {
      name: toolName,
      enabled: true,
      usage: "",
    }
  );
}

function upsertTool(
  widget: ProblemWidget,
  toolName: string,
  patch: Partial<ProblemWidgetTool>,
): ProblemWidgetTool[] {
  const existing = widget.tools ?? [];
  const idx = existing.findIndex((t) => t.name === toolName);
  const base: ProblemWidgetTool =
    idx >= 0 ? existing[idx] : { name: toolName, enabled: true, usage: "" };
  const updated = { ...base, ...patch };
  return idx >= 0
    ? existing.map((t, i) => (i === idx ? updated : t))
    : [...existing, updated];
}

// Editor for the problem's activity widgets. The instructor picks which
// widgets the activity exposes, configures their params (e.g. the code
// editor's problem statement + tests) and writes optional usage guidance for
// each tool. Tool SCHEMAS are never authored here — they live in the workbench
// widget catalog; this only references them by name.
export function ProblemWidgetsEditor({ widgets, onChange }: ProblemWidgetsEditorProps) {
  const addWidget = () => {
    const defaultType = WIDGET_CATALOG[0]?.widgetType;
    if (!defaultType) return;
    const entry = findWidgetEntry(defaultType);
    const taken = new Set(widgets.map((w) => w.slot));
    const nextSlot = (SLOT_OPTIONS.find((s) => !taken.has(s.id))?.id ?? "right") as SlotId;
    onChange([
      ...widgets,
      { widgetType: defaultType, slot: nextSlot, params: entry?.defaultParams },
    ]);
  };

  const removeAt = (idx: number) => {
    onChange(widgets.filter((_, i) => i !== idx));
  };

  const updateAt = (idx: number, patch: Partial<ProblemWidget>) => {
    onChange(widgets.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  };

  return (
    <div className="border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Widgets &amp; tools</label>
        <button
          type="button"
          onClick={addWidget}
          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          + Add widget
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Widgets the workbench mounts for this activity. Each widget exposes tool calls LEIA can use
        in both voice (Luke) and text mode. You configure the widget and when LEIA should use each
        tool — the tool's behaviour itself is fixed by the platform.
      </p>

      {widgets.length === 0 ? (
        <div className="text-xs text-gray-400 italic mt-3">No widgets configured.</div>
      ) : (
        <ul className="mt-3 space-y-3">
          {widgets.map((w, i) => (
            <WidgetRow
              key={i}
              widget={w}
              onChange={(patch) => updateAt(i, patch)}
              onRemove={() => removeAt(i)}
            />
          ))}
        </ul>
      )}
    </div>
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
    <li className="border border-gray-200 rounded p-2">
      <div className="flex items-center gap-2 text-sm">
        <select
          value={widget.widgetType}
          onChange={(e) => {
            const nextEntry = findWidgetEntry(e.target.value);
            onChange({
              widgetType: e.target.value,
              params: nextEntry?.defaultParams,
              tools: undefined,
            });
          }}
          className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
        >
          {WIDGET_CATALOG.map((c) => (
            <option key={c.widgetType} value={c.widgetType}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={widget.slot ?? "right"}
          onChange={(e) => onChange({ slot: e.target.value as SlotId })}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {SLOT_OPTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-600 hover:text-red-800 px-2"
          title="Remove widget"
        >
          ×
        </button>
      </div>

      {entry && <div className="text-xs text-gray-500 mt-1">{entry.description}</div>}

      {/* Params (problem statement, tests, ...) */}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setParamsOpen((v) => !v)}
          className="text-xs text-blue-600 hover:underline"
        >
          {paramsOpen ? "▾" : "▸"} Configure problem &amp; tests
        </button>
        {paramsOpen && (
          <div className="mt-2">
            <ParamsForm
              value={widget.params}
              onChange={(next) => onChange({ params: next })}
            />
            {entry && (
              <button
                type="button"
                onClick={() => onChange({ params: entry.defaultParams })}
                className="mt-3 text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Reset to default
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tool usage guidance */}
      {entry && entry.tools.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
          >
            {toolsOpen ? "▾" : "▸"} Tools ({entry.tools.length})
          </button>
          {toolsOpen && (
            <ul className="mt-2 space-y-2">
              {entry.tools.map((tool) => {
                const state = getToolEntry(widget, tool.name);
                const enabled = state.enabled !== false;
                return (
                  <li key={tool.name} className="border border-gray-100 rounded p-2 bg-gray-50">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) =>
                          onChange({
                            tools: upsertTool(widget, tool.name, { enabled: e.target.checked }),
                          })
                        }
                      />
                      <span>{tool.label}</span>
                      <span className="font-mono text-[11px] text-gray-400">{tool.name}</span>
                    </label>
                    <div className="text-[11px] text-gray-500 mt-1 ml-6">{tool.description}</div>
                    <textarea
                      value={state.usage ?? ""}
                      disabled={!enabled}
                      onChange={(e) =>
                        onChange({
                          tools: upsertTool(widget, tool.name, { usage: e.target.value }),
                        })
                      }
                      className="mt-1 ml-6 w-[calc(100%-1.5rem)] border border-gray-300 rounded px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-400"
                      rows={2}
                      placeholder="When should LEIA use this tool in this activity? (optional)"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
