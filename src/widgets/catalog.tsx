import { useState } from "react";
import type { FC, ComponentType } from "react";
import { Editor } from "@monaco-editor/react";
import { CodeEditorWidget } from "./CodeEditorWidget";
import type { SlotId, WidgetDefinition } from "./types";
import type { ProblemWidget } from "../models/Leia";

// Designer-side widget catalog. Mirrors the workbench widget catalog
// (leia-workbench-frontend/src/widgets/catalog.ts): it carries both the
// authoring info the instructor needs (label, available tools, default params,
// a per-widget params form) AND the runtime React component so the designer's
// activity "try" can mount the exact same widget the workbench does. Keep the
// widgetType / tool names in sync with the workbench.

export type { SlotId };

export const SLOT_OPTIONS: { id: SlotId; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "main", label: "Main (center)" },
];

export interface WidgetToolMeta {
  /** Fully-qualified tool name the model sees (e.g. "codeEditor_read"). */
  name: string;
  /** Human label shown in the editor. */
  label: string;
  /** Base description (lives in code); shown read-only as context. */
  description: string;
}

export interface WidgetParamsFormProps {
  value: Record<string, unknown> | undefined;
  onChange: (next: Record<string, unknown>) => void;
}

export interface DesignerWidgetEntry {
  widgetType: string;
  label: string;
  description: string;
  defaultParams: Record<string, unknown>;
  /** Tools this widget exposes. The instructor cannot edit their schema —
   *  only enable/disable them and add per-activity usage guidance. */
  tools: WidgetToolMeta[];
  /** Authoring form for the widget's params (problem statement, tests, ...). */
  ParamsForm: FC<WidgetParamsFormProps>;
  /** Runtime component mounted in the designer "try" (and the workbench). */
  Component: ComponentType<any>;
}

// ---------------------------------------------------------------------------
// codeEditor — ported from the workbench WidgetsConfigPanel param form.
// ---------------------------------------------------------------------------

interface CodeEditorParams {
  fnName: string;
  description: string;
  starter: { javascript: string; python: string };
  tests: Array<{ name: string; args: unknown[]; expected: unknown }>;
}

const CODE_EDITOR_DEFAULT: CodeEditorParams = {
  fnName: "twoSum",
  description:
    "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.",
  starter: {
    javascript:
      "function twoSum(nums, target) {\n    // your code here\n    return [];\n}\n",
    python: "def twoSum(nums, target):\n    # your code here\n    return []\n",
  },
  tests: [
    { name: "[2,7,11,15], target=9", args: [[2, 7, 11, 15], 9], expected: [0, 1] },
    { name: "[3,2,4], target=6", args: [[3, 2, 4], 6], expected: [1, 2] },
    { name: "[3,3], target=6", args: [[3, 3], 6], expected: [0, 1] },
  ],
};

function asCodeEditorParams(value: Record<string, unknown> | undefined): CodeEditorParams {
  const def = CODE_EDITOR_DEFAULT;
  if (!value) return def;
  const v = value as Partial<CodeEditorParams>;
  return {
    fnName: typeof v.fnName === "string" ? v.fnName : def.fnName,
    description: typeof v.description === "string" ? v.description : def.description,
    starter: {
      javascript: v.starter?.javascript ?? def.starter.javascript,
      python: v.starter?.python ?? def.starter.python,
    },
    tests: Array.isArray(v.tests) ? v.tests : def.tests,
  };
}

const CodeEditorParamsForm: FC<WidgetParamsFormProps> = ({ value, onChange }) => {
  const params = asCodeEditorParams(value);

  const update = (patch: Partial<CodeEditorParams>) => {
    onChange({ ...params, ...patch });
  };

  const updateStarter = (lang: keyof CodeEditorParams["starter"], code: string) => {
    update({ starter: { ...params.starter, [lang]: code } });
  };

  const addTest = () => {
    update({
      tests: [...params.tests, { name: `test ${params.tests.length + 1}`, args: [], expected: null }],
    });
  };

  const removeTest = (idx: number) => {
    update({ tests: params.tests.filter((_, i) => i !== idx) });
  };

  const updateTest = (idx: number, patch: Partial<CodeEditorParams["tests"][number]>) => {
    update({
      tests: params.tests.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    });
  };

  return (
    <div className="mt-2 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700">Function name</label>
        <input
          type="text"
          value={params.fnName}
          onChange={(e) => update({ fnName: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
          placeholder="twoSum"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700">Problem description</label>
        <textarea
          value={params.description}
          onChange={(e) => update({ description: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          rows={3}
          placeholder="Given an array..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700">JavaScript starter</label>
          <div className="mt-1 border border-gray-300 rounded overflow-hidden">
            <Editor
              height="120px"
              defaultLanguage="javascript"
              value={params.starter.javascript}
              onChange={(v) => updateStarter("javascript", v ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Python starter</label>
          <div className="mt-1 border border-gray-300 rounded overflow-hidden">
            <Editor
              height="120px"
              defaultLanguage="python"
              value={params.starter.python}
              onChange={(v) => updateStarter("python", v ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-gray-700">Tests</label>
          <button
            type="button"
            onClick={addTest}
            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            + Add test
          </button>
        </div>
        {params.tests.length === 0 ? (
          <div className="text-xs text-gray-400 italic mt-2">No tests defined.</div>
        ) : (
          <ul className="mt-2 space-y-2">
            {params.tests.map((t, i) => (
              <TestRow
                key={i}
                test={t}
                onChange={(patch) => updateTest(i, patch)}
                onRemove={() => removeTest(i)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

interface TestRowProps {
  test: CodeEditorParams["tests"][number];
  onChange: (patch: Partial<CodeEditorParams["tests"][number]>) => void;
  onRemove: () => void;
}

function TestRow({ test, onChange, onRemove }: TestRowProps) {
  const [argsDraft, setArgsDraft] = useState<string>(() => JSON.stringify(test.args));
  const [argsErr, setArgsErr] = useState<string | null>(null);
  const [expectedDraft, setExpectedDraft] = useState<string>(() => JSON.stringify(test.expected));
  const [expectedErr, setExpectedErr] = useState<string | null>(null);

  const commitArgs = (s: string) => {
    setArgsDraft(s);
    try {
      const parsed = JSON.parse(s);
      if (!Array.isArray(parsed)) throw new Error("Must be a JSON array (the function call arguments)");
      setArgsErr(null);
      onChange({ args: parsed });
    } catch (e) {
      setArgsErr(e instanceof Error ? e.message : String(e));
    }
  };

  const commitExpected = (s: string) => {
    setExpectedDraft(s);
    try {
      const parsed = JSON.parse(s);
      setExpectedErr(null);
      onChange({ expected: parsed });
    } catch (e) {
      setExpectedErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <li className="border border-gray-200 rounded p-2 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={test.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="test name"
          className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-600 hover:text-red-800 px-2"
          title="Remove test"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-600">args (JSON array)</label>
          <input
            type="text"
            value={argsDraft}
            onChange={(e) => commitArgs(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
            placeholder='[[2,7,11,15], 9]'
          />
          {argsErr && <div className="text-[11px] text-red-600 mt-1">{argsErr}</div>}
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600">expected (JSON)</label>
          <input
            type="text"
            value={expectedDraft}
            onChange={(e) => commitExpected(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
            placeholder="[0, 1]"
          />
          {expectedErr && <div className="text-[11px] text-red-600 mt-1">{expectedErr}</div>}
        </div>
      </div>
    </li>
  );
}

// Generic JSON params editor — fallback for widgets without a dedicated form.
const JsonParamsForm: FC<WidgetParamsFormProps> = ({ value, onChange }) => {
  const [draft, setDraft] = useState<string>(() => JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);

  const apply = () => {
    try {
      const parsed = draft.trim() === "" ? {} : JSON.parse(draft);
      setErr(null);
      onChange(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <div className="border border-gray-300 rounded overflow-hidden">
        <Editor
          height="180px"
          defaultLanguage="json"
          value={draft}
          onChange={(v) => setDraft(v ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true }}
        />
      </div>
      {err && <div className="text-xs text-red-600 mt-1">JSON error: {err}</div>}
      <button
        type="button"
        onClick={apply}
        className="mt-2 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Apply
      </button>
    </div>
  );
};

export const WIDGET_CATALOG: DesignerWidgetEntry[] = [
  {
    widgetType: "codeEditor",
    label: "Code editor",
    description:
      "Monaco code editor. LEIA can read, comment and rewrite code while the student works, and run the configured test suite.",
    defaultParams: CODE_EDITOR_DEFAULT as unknown as Record<string, unknown>,
    tools: [
      { name: "codeEditor_read", label: "Read code", description: "Reads the current content of the editor." },
      {
        name: "codeEditor_applyDiff",
        label: "Apply edits",
        description: "Edits the student's code with search-and-replace operations (e.g. add comments, fix bugs).",
      },
      { name: "codeEditor_runTests", label: "Run tests", description: "Runs the configured test suite against the student's code." },
    ],
    ParamsForm: CodeEditorParamsForm,
    Component: CodeEditorWidget,
  },
];

export function findWidgetEntry(widgetType: string): DesignerWidgetEntry | undefined {
  return WIDGET_CATALOG.find((e) => e.widgetType === widgetType);
}

// Resolves a problem's declarative widget list into mountable WidgetDefinitions
// for the designer "try". Unknown widget types are dropped.
export function resolveWidgetDefinitions(widgets: ProblemWidget[] | undefined): WidgetDefinition[] {
  if (!Array.isArray(widgets)) return [];
  return widgets
    .map((w) => {
      const entry = findWidgetEntry(w.widgetType);
      if (!entry) return null;
      const slot: SlotId = w.slot ?? "main";
      return {
        id: `${w.widgetType}-${slot}`,
        slot,
        Component: entry.Component,
        props: w.params ? { params: w.params } : undefined,
      } as WidgetDefinition;
    })
    .filter((w): w is WidgetDefinition => w !== null);
}

export { JsonParamsForm };
