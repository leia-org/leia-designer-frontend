import { useState } from "react";
import type { FC, ComponentType } from "react";
import { Editor } from "@monaco-editor/react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Box, Button, IconButton, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { CodeEditorWidget } from "./CodeEditorWidget";
import { CodeEditorWithTreeWidget } from "./CodeEditorWithTreeWidget";
import { MermaidViewerWidget } from "./MermaidViewerWidget";
import { ProjectTreeWidget } from "./ProjectTreeWidget";
import type { SlotId, WidgetDefinition } from "./types";
import type { EditorLanguage } from "./codeEditor/types";
import type { ProblemWidget } from "../models/Leia";
import { DESIGN_PATTERN_OPTIONS } from "./designPatterns";

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
  language: EditorLanguage;
  starter: { javascript: string; python: string; text?: string; java?: string };
  tests: Array<{ name: string; args: unknown[]; expected: unknown }>;
}

const CODE_EDITOR_DEFAULT: CodeEditorParams = {
  fnName: "twoSum",
  language: "javascript",
  description:
    "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.",
  starter: {
    javascript:
      "function twoSum(nums, target) {\n    // your code here\n    return [];\n}\n",
    python: "def twoSum(nums, target):\n    # your code here\n    return []\n",
    text: "",
    java: "",
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
  const language: EditorLanguage =
    v.language === "python" || v.language === "text" || v.language === "java" ? v.language : "javascript";
  return {
    fnName: typeof v.fnName === "string" ? v.fnName : def.fnName,
    description: typeof v.description === "string" ? v.description : def.description,
    language,
    starter: {
      javascript: v.starter?.javascript ?? def.starter.javascript,
      python: v.starter?.python ?? def.starter.python,
      text: v.starter?.text ?? def.starter.text ?? "",
      java: v.starter?.java ?? def.starter.java ?? "",
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

  const isText = params.language === "text";
  const isJava = params.language === "java";
  const noTests = isText || isJava;
  const monacoLang = isText ? "plaintext" : params.language;

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField
        select
        label="Language"
        size="small"
        value={params.language}
        onChange={(event) => update({ language: event.target.value as EditorLanguage })}
        fullWidth
      >
        <MenuItem value="javascript">JavaScript</MenuItem>
        <MenuItem value="python">Python</MenuItem>
        <MenuItem value="java">Java</MenuItem>
        <MenuItem value="text">Plain text</MenuItem>
      </TextField>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        The student works in this language and cannot change it. Plain text and Java have no tests/execution.
      </Typography>

      {!noTests && (
        <TextField
          label="Function name"
          value={params.fnName}
          onChange={(event) => update({ fnName: event.target.value })}
          placeholder="twoSum"
          fullWidth
          sx={{ "& .MuiInputBase-input": { fontFamily: "'JetBrains Mono Variable', monospace" } }}
        />
      )}

      <TextField
        label={isText ? "Statement / instructions" : "Problem description"}
        value={params.description}
        onChange={(event) => update({ description: event.target.value })}
        placeholder="Given an array..."
        multiline
        rows={3}
        fullWidth
      />

      <Box>
        <Typography variant="caption" fontWeight={600}>
          {isText ? "Starter text" : "Starter code"}
        </Typography>
        <Paper variant="outlined" sx={{ mt: 0.75, overflow: "hidden" }}>
          <Editor
            height="120px"
            language={monacoLang}
            path={`starter.${params.language}`}
            value={params.starter[params.language] ?? ""}
            onChange={(nextValue) => updateStarter(params.language, nextValue ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }}
          />
        </Paper>
      </Box>

      {!noTests && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="caption" fontWeight={600}>Tests</Typography>
            <Button type="button" size="small" variant="contained" startIcon={<AddIcon />} onClick={addTest}>
              Add test
            </Button>
          </Stack>
          {params.tests.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1, fontStyle: "italic" }}>
              No tests defined.
            </Typography>
          ) : (
            <Stack component="ul" spacing={1} sx={{ listStyle: "none", m: 0, mt: 1, p: 0 }}>
              {params.tests.map((test, index) => (
                <TestRow
                  key={index}
                  test={test}
                  onChange={(patch) => updateTest(index, patch)}
                  onRemove={() => removeTest(index)}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Stack>
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

  const commitArgs = (draft: string) => {
    setArgsDraft(draft);
    try {
      const parsed = JSON.parse(draft);
      if (!Array.isArray(parsed)) throw new Error("Must be a JSON array (the function call arguments)");
      setArgsErr(null);
      onChange({ args: parsed });
    } catch (error) {
      setArgsErr(error instanceof Error ? error.message : String(error));
    }
  };

  const commitExpected = (draft: string) => {
    setExpectedDraft(draft);
    try {
      const parsed = JSON.parse(draft);
      setExpectedErr(null);
      onChange({ expected: parsed });
    } catch (error) {
      setExpectedErr(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Paper component="li" variant="outlined" sx={{ p: 1.25 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <TextField
          value={test.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Test name"
          size="small"
          fullWidth
        />
        <IconButton aria-label="Remove test" color="error" size="small" onClick={onRemove}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1, mt: 1 }}>
        <TextField
          label="args (JSON array)"
          value={argsDraft}
          onChange={(event) => commitArgs(event.target.value)}
          placeholder="[[2,7,11,15], 9]"
          error={Boolean(argsErr)}
          helperText={argsErr}
          size="small"
          fullWidth
          sx={{ "& .MuiInputBase-input": { fontFamily: "'JetBrains Mono Variable', monospace" } }}
        />
        <TextField
          label="expected (JSON)"
          value={expectedDraft}
          onChange={(event) => commitExpected(event.target.value)}
          placeholder="[0, 1]"
          error={Boolean(expectedErr)}
          helperText={expectedErr}
          size="small"
          fullWidth
          sx={{ "& .MuiInputBase-input": { fontFamily: "'JetBrains Mono Variable', monospace" } }}
        />
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// mermaidViewer — student-editable Mermaid source + live preview. LEIA only
// reads it (mermaid_read); it never authors the diagram for the student.
// ---------------------------------------------------------------------------

interface MermaidViewerParams {
  title: string;
  initialCode: string;
}

const MERMAID_VIEWER_DEFAULT: MermaidViewerParams = {
  title: "UML Diagram",
  initialCode: "",
};

function asMermaidViewerParams(value: Record<string, unknown> | undefined): MermaidViewerParams {
  const def = MERMAID_VIEWER_DEFAULT;
  if (!value) return def;
  const v = value as Partial<MermaidViewerParams>;
  return {
    title: typeof v.title === "string" ? v.title : def.title,
    initialCode: typeof v.initialCode === "string" ? v.initialCode : def.initialCode,
  };
}

const MermaidViewerParamsForm: FC<WidgetParamsFormProps> = ({ value, onChange }) => {
  const params = asMermaidViewerParams(value);
  const update = (patch: Partial<MermaidViewerParams>) => onChange({ ...params, ...patch });

  return (
    <div className="mt-2 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700">Panel title</label>
        <input
          type="text"
          value={params.title}
          onChange={(e) => update({ title: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          placeholder="UML Diagram"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">Starter Mermaid source (optional)</label>
        <div className="mt-1 border border-gray-300 rounded overflow-hidden">
          <Editor
            height="120px"
            language="plaintext"
            path="mermaidViewer.initialCode"
            value={params.initialCode}
            onChange={(v) => update({ initialCode: v ?? "" })}
            options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }}
          />
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Left empty by default — the student writes the diagram from scratch. LEIA cannot edit this
          panel; it can only read what the student has drawn so far.
        </p>
      </div>
    </div>
  );
};

// Generic JSON params editor — fallback for widgets without a dedicated form.
const JsonParamsForm: FC<WidgetParamsFormProps> = ({ value, onChange }) => {
  const [draft, setDraft] = useState<string>(() => JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);

  const apply = () => {
    try {
      const parsed = draft.trim() === "" ? {} : JSON.parse(draft);
      setErr(null);
      onChange(parsed);
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Box>
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Editor
          height="180px"
          defaultLanguage="json"
          value={draft}
          onChange={(nextValue) => setDraft(nextValue ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true }}
        />
      </Paper>
      {err && <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>JSON error: {err}</Typography>}
      <Button type="button" variant="contained" size="small" sx={{ mt: 1 }} onClick={apply}>
        Apply
      </Button>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// projectTree — read-only-to-LEIA file/folder structure, clickable-to-the-
// student. See src/widgets/ProjectTreeWidget.tsx.
// ---------------------------------------------------------------------------

const PROJECT_TREE_DEFAULT = {
  title: "Project",
  tree: [
    {
      name: "src",
      type: "folder",
      children: [
        { name: "Solution.java", type: "file", path: "Solution.java" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// codeEditorWithTree — Editor + Project Tree stacked in one panel with a
// resizable divider. Reuses the two forms above section by section; no new
// params shape, just { codeEditor, projectTree } nesting the existing ones.
// ---------------------------------------------------------------------------

const CODE_EDITOR_WITH_TREE_DEFAULT = {
  codeEditor: CODE_EDITOR_DEFAULT,
  projectTree: PROJECT_TREE_DEFAULT,
};

// Mirrors ResourceEditor.tsx's Problem-level pattern selector (both backed by
// designPatterns.ts) so the code shown and the pattern graded can't diverge.
const SCENARIO_PATTERN_OPTIONS = DESIGN_PATTERN_OPTIONS;

interface ScenarioSourceValue {
  pattern?: string;
  repoOwner?: string;
  repoName?: string;
  ref?: string;
}

const CodeEditorWithTreeParamsForm: FC<WidgetParamsFormProps> = ({ value, onChange }) => {
  const v = (value ?? {}) as {
    codeEditor?: Record<string, unknown>;
    projectTree?: Record<string, unknown>;
    scenarioSource?: ScenarioSourceValue;
  };
  const source = v.scenarioSource;

  const updateSource = (patch: Partial<ScenarioSourceValue>) => {
    onChange({ ...v, scenarioSource: { ...source, ...patch } });
  };

  // Drops scenarioSource entirely (not just the pattern) — the widget treats
  // "no pattern" as "use the static config below".
  const clearSource = () => {
    const rest = { ...v };
    delete rest.scenarioSource;
    onChange(rest);
  };

  return (
    <div className="mt-2 space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-gray-800">Scenario source (optional)</h4>
        <p className="text-[11px] text-gray-500">
          When a pattern is selected, the Editor and Project Tree below are ignored — files are
          fetched instead from the scenario repo. Each student session gets one of the 4 scenario
          variants for this pattern, picked once and kept for the whole session.
        </p>
        <label className="block text-xs font-medium text-gray-700 mt-2">Design pattern</label>
        <select
          value={source?.pattern ?? ""}
          onChange={(e) => {
            const pattern = e.target.value;
            if (!pattern) clearSource();
            else updateSource({ pattern });
          }}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="">— none (use static config below) —</option>
          {SCENARIO_PATTERN_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {source?.pattern && (
          <details className="mt-2">
            <summary className="text-[11px] text-gray-500 cursor-pointer">Advanced: repo override</summary>
            <div className="mt-1 space-y-1">
              <input
                type="text"
                placeholder="repoOwner (default: benjimrfl)"
                value={source?.repoOwner ?? ""}
                onChange={(e) => updateSource({ repoOwner: e.target.value || undefined })}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
              />
              <input
                type="text"
                placeholder="repoName (default: leia-design-pattern-escenarios)"
                value={source?.repoName ?? ""}
                onChange={(e) => updateSource({ repoName: e.target.value || undefined })}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
              />
              <input
                type="text"
                placeholder="ref (default: main)"
                value={source?.ref ?? ""}
                onChange={(e) => updateSource({ ref: e.target.value || undefined })}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
          </details>
        )}
      </div>

      <div className="pt-3 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-800">
          Editor{source?.pattern && <span className="font-normal text-gray-400"> (fallback — ignored while a scenario source is set)</span>}
        </h4>
        <CodeEditorParamsForm
          value={v.codeEditor}
          onChange={(next) => onChange({ ...v, codeEditor: next })}
        />
      </div>
      <div className="pt-3 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-800">
          Project Tree{source?.pattern && <span className="font-normal text-gray-400"> (fallback — ignored while a scenario source is set)</span>}
        </h4>
        <p className="text-[11px] text-gray-500">
          Authored as JSON (matches ProjectTreeWidget.tsx: {"{"} title?, tree: [{"{"}name, type, path?, children?{"}"}] {"}"}).
        </p>
        <JsonParamsForm
          value={v.projectTree}
          onChange={(next) => onChange({ ...v, projectTree: next })}
        />
      </div>
    </div>
  );
};

export const WIDGET_CATALOG: DesignerWidgetEntry[] = [
  {
    widgetType: "codeEditor",
    label: "Editor",
    description:
      "Monaco editor (JavaScript, Python or plain text). LEIA can read, comment and rewrite the content while the student works, and run the configured test suite.",
    defaultParams: CODE_EDITOR_DEFAULT as unknown as Record<string, unknown>,
    tools: [
      {
        name: "codeEditor_listFiles",
        label: "List files",
        description: "Lists the files open in the editor (multi-file problems authored via the Code Editor / JSON tab).",
      },
      { name: "codeEditor_read", label: "Read code", description: "Reads the current content of a file in the editor." },
      {
        name: "codeEditor_applyDiff",
        label: "Apply edits",
        description: "Edits a file with search-and-replace operations (e.g. add comments, fix bugs).",
      },
      { name: "codeEditor_runTests", label: "Run tests", description: "Runs the configured test suite against the student's code." },
    ],
    ParamsForm: CodeEditorParamsForm,
    Component: CodeEditorWidget,
  },
  {
    widgetType: "mermaidViewer",
    label: "UML Diagram",
    description:
      "Student-editable Mermaid source with a live preview. Only the student draws the diagram — LEIA can read it (for Socratic feedback) but has no tool to author or edit it.",
    defaultParams: MERMAID_VIEWER_DEFAULT as unknown as Record<string, unknown>,
    tools: [
      {
        name: "mermaid_read",
        label: "Read diagram",
        description: "Reads the Mermaid source the student is currently drawing, to give feedback on it.",
      },
    ],
    ParamsForm: MermaidViewerParamsForm,
    Component: MermaidViewerWidget,
  },
  {
    widgetType: "projectTree",
    label: "Project Tree",
    description:
      "Read-only file/folder structure for realistic project context. Files that also exist in a sibling Editor widget are clickable and switch its active file; LEIA can read the tree but not change it.",
    defaultParams: PROJECT_TREE_DEFAULT as unknown as Record<string, unknown>,
    tools: [
      {
        name: "projectTree_read",
        label: "Read project tree",
        description: "Reads the file/folder structure shown to the student, for referencing realistic project context.",
      },
    ],
    // No dedicated form yet — author the tree as JSON (matches the shape in
    // ProjectTreeWidget.tsx: { title?, tree: [{name, type, path?, children?}] }).
    ParamsForm: JsonParamsForm,
    Component: ProjectTreeWidget,
  },
  {
    widgetType: "codeEditorWithTree",
    label: "Editor + Project Tree (combined)",
    description:
      "A single panel combining the Editor and Project Tree, stacked with a resizable divider. Same tools and behavior as the two separate widgets — just one slot instead of two. Optionally, pick a design pattern to serve one of its 4 scenario variants from the scenario repo (randomized once per student session) instead of authoring files by hand.",
    defaultParams: CODE_EDITOR_WITH_TREE_DEFAULT as unknown as Record<string, unknown>,
    tools: [
      {
        name: "codeEditor_listFiles",
        label: "List files",
        description: "Lists the files open in the editor (multi-file problems authored via the Code Editor / JSON tab).",
      },
      { name: "codeEditor_read", label: "Read code", description: "Reads the current content of a file in the editor." },
      {
        name: "codeEditor_applyDiff",
        label: "Apply edits",
        description: "Edits a file with search-and-replace operations (e.g. add comments, fix bugs).",
      },
      { name: "codeEditor_runTests", label: "Run tests", description: "Runs the configured test suite against the student's code." },
      {
        name: "projectTree_read",
        label: "Read project tree",
        description: "Reads the file/folder structure shown to the student, for referencing realistic project context.",
      },
    ],
    ParamsForm: CodeEditorWithTreeParamsForm,
    Component: CodeEditorWithTreeWidget,
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
