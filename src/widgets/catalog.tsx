import { useState } from "react";
import type { FC, ComponentType } from "react";
import { Editor } from "@monaco-editor/react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Autocomplete, Box, Button, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import { CodeEditorWidget } from "./CodeEditorWidget";
import type { SlotId, WidgetDefinition } from "./types";
import type { EditorLanguage, ProblemDef } from "./codeEditor/types";
import { DEFAULT_PROBLEM } from "./codeEditor/problem";
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
  language: EditorLanguage;
  starter: ProblemDef["starter"];
  tests: Array<{ name: string; args: unknown[]; expected: unknown }>;
}

const LANGUAGE_OPTIONS: { value: EditorLanguage; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "rust", label: "Rust" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "go", label: "Go" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "ruby", label: "Ruby" },
  { value: "r", label: "R" },
  { value: "matlab", label: "MATLAB" },
  { value: "dart", label: "Dart" },
  { value: "scala", label: "Scala" },
  { value: "perl", label: "Perl" },
  { value: "lua", label: "Lua" },
  { value: "objective-c", label: "Objective-C" },
  { value: "assembly", label: "Assembly" },
  { value: "sql", label: "SQL" },
  { value: "plsql", label: "PL/SQL" },
  { value: "haskell", label: "Haskell" },
  { value: "elixir", label: "Elixir" },
  { value: "erlang", label: "Erlang" },
  { value: "clojure", label: "Clojure" },
  { value: "fsharp", label: "F#" },
  { value: "vb", label: "Visual Basic" },
  { value: "delphi", label: "Delphi (Object Pascal)" },
  { value: "fortran", label: "Fortran" },
  { value: "cobol", label: "COBOL" },
  { value: "julia", label: "Julia" },
  { value: "groovy", label: "Groovy" },
  { value: "bash", label: "Bash" },
  { value: "powershell", label: "PowerShell" },
  { value: "solidity", label: "Solidity" },
  { value: "zig", label: "Zig" },
  { value: "nim", label: "Nim" },
  { value: "ocaml", label: "OCaml" },
  { value: "prolog", label: "Prolog" },
  { value: "scheme", label: "Scheme" },
  { value: "lisp", label: "Lisp" },
  { value: "scratch", label: "Scratch" },
  { value: "gdscript", label: "GDScript" },
  { value: "apex", label: "Apex" },
  { value: "abap", label: "ABAP" },
  { value: "v", label: "V" },
  { value: "crystal", label: "Crystal" },
  { value: "d", label: "D" },
  { value: "text", label: "Plain text" },
];

const CODE_EDITOR_DEFAULT: CodeEditorParams = {
  fnName: DEFAULT_PROBLEM.fnName,
  language: DEFAULT_PROBLEM.language ?? "javascript",
  description: DEFAULT_PROBLEM.description,
  starter: DEFAULT_PROBLEM.starter,
  tests: DEFAULT_PROBLEM.tests,
};

function asCodeEditorParams(value: Record<string, unknown> | undefined): CodeEditorParams {
  const def = CODE_EDITOR_DEFAULT;
  if (!value) return def;
  const v = value as Partial<CodeEditorParams>;
  const language = LANGUAGE_OPTIONS.some((option) => option.value === v.language)
    ? v.language as EditorLanguage
    : "javascript";
  return {
    fnName: typeof v.fnName === "string" ? v.fnName : def.fnName,
    description: typeof v.description === "string" ? v.description : def.description,
    language,
    starter: { ...def.starter, ...(v.starter ?? {}) },
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
  const supportsTests = params.language === "javascript" || params.language === "python";
  const monacoLang = isText ? "plaintext" : params.language;

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Autocomplete
        options={LANGUAGE_OPTIONS}
        value={LANGUAGE_OPTIONS.find((option) => option.value === params.language) ?? null}
        onChange={(_, option) => {
          if (option) update({ language: option.value });
        }}
        renderInput={(inputParams) => (
          <TextField {...inputParams} label="Language" placeholder="Search language..." size="small" />
        )}
        fullWidth
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        The student works in this language and cannot change it. Tests are currently available only for JavaScript and Python; other languages provide syntax highlighting only.
      </Typography>

      {!isText && (
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

      {supportsTests && (
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

export const WIDGET_CATALOG: DesignerWidgetEntry[] = [
  {
    widgetType: "codeEditor",
    label: "Editor",
    description:
      "Monaco editor with templates for 50 programming, scripting, query and visual languages. LEIA can read, comment and rewrite the content while the student works; tests run for JavaScript and Python.",
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
