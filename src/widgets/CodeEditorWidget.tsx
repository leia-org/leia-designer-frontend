import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useLukeTool } from "./useLukeTool";
import { useWidgetsContext } from "./WidgetsContext";
import { DEFAULT_PROBLEM } from "./codeEditor/problem";
import { resolveFiles } from "./codeEditor/files";
import { runJsTests } from "./codeEditor/jsRunner";
import { runPyTests } from "./codeEditor/pyRunner";
import type { EditorLanguage, ProblemDef, ProblemFile, TestRunSummary } from "./codeEditor/types";

// Minimal subsets of monaco's editor/model/namespace types that we actually
// use. Avoids pulling the heavy monaco-editor type package as a direct dep.
interface MinimalModel {
    getValue(): string;
    setValue(value: string): void;
}
interface MinimalEditor {
    getValue(): string;
    setValue(value: string): void;
    getModel(): MinimalModel | null;
    setModel(model: MinimalModel): void;
}
interface MinimalMonaco {
    editor: {
        createModel(value: string, language?: string, uri?: unknown): MinimalModel;
    };
    Uri: { parse(value: string): unknown };
}

interface DiffEdit {
    find: string;
    replace: string;
}

// Apply a list of {find, replace} edits to a file's current content.
// Each `find` must occur exactly once (otherwise the edit is rejected
// with a clear error so LEIA can retry with a more specific anchor).
function applyEdits(current: string, edits: DiffEdit[]): { next: string; errors: string[]; applied: number } {
    let next = current;
    const errors: string[] = [];
    let applied = 0;
    for (let i = 0; i < edits.length; i++) {
        const e = edits[i];
        if (typeof e?.find !== "string" || typeof e?.replace !== "string") {
            errors.push(`edit[${i}]: find/replace must both be strings`);
            continue;
        }
        if (e.find === "") {
            errors.push(`edit[${i}]: empty 'find' is not allowed — provide the exact text to replace`);
            continue;
        }
        const first = next.indexOf(e.find);
        if (first === -1) {
            errors.push(`edit[${i}]: 'find' text not present in editor`);
            continue;
        }
        const second = next.indexOf(e.find, first + 1);
        if (second !== -1) {
            errors.push(`edit[${i}]: 'find' text appears multiple times — make it more specific so it identifies a single location`);
            continue;
        }
        next = next.slice(0, first) + e.replace + next.slice(first + e.find.length);
        applied++;
    }
    return { next, errors, applied };
}

interface CodeEditorWidgetProps {
    /** Optional per-activity problem definition. Overrides DEFAULT_PROBLEM. */
    params?: Partial<ProblemDef>;
}

function mergeProblem(p?: Partial<ProblemDef>): ProblemDef {
    if (!p) return DEFAULT_PROBLEM;
    return {
        fnName: p.fnName ?? DEFAULT_PROBLEM.fnName,
        description: p.description ?? DEFAULT_PROBLEM.description,
        language: p.language ?? DEFAULT_PROBLEM.language ?? "javascript",
        starter: p.files ? undefined : {
            javascript: p.starter?.javascript ?? DEFAULT_PROBLEM.starter?.javascript ?? "",
            python: p.starter?.python ?? DEFAULT_PROBLEM.starter?.python ?? "",
            text: p.starter?.text ?? "",
            java: p.starter?.java ?? "",
        },
        files: p.files,
        tests: p.tests ?? DEFAULT_PROBLEM.tests,
    };
}

// Monaco language id for an editor language.
// "text" → plaintext (no highlighting), "java" → java (highlighting only, no execution).
const monacoLanguage = (lang: EditorLanguage): string => (lang === "text" ? "plaintext" : lang);

// A widget showing a (possibly multi-file) Monaco editor and exposing tools
// to LEIA: codeEditor_listFiles, codeEditor_read, codeEditor_applyDiff,
// codeEditor_runTests. Each file gets its own Monaco model, created once on
// mount, so switching tabs preserves content/undo history. The active file
// is shared via WidgetsContext so a sibling ProjectTreeWidget can open it.
//
// Code execution is intentionally LEIA-only: there is no Run button.
export function CodeEditorWidget({ params }: CodeEditorWidgetProps = {}) {
    const problem = useMemo(() => mergeProblem(params), [params]);
    const files = useMemo(() => resolveFiles(problem), [problem]);
    const isMultiFile = files.length > 1;

    // The file tests run against — the one matching the instructor's fixed
    // `language`, or the first file if that's ambiguous.
    const testFile = useMemo<ProblemFile>(
        () => files.find((f) => f.language === problem.language) ?? files[0],
        [files, problem.language],
    );
    const hasTests = testFile.language !== "text" && testFile.language !== "java" && problem.tests.length > 0;

    const { activeFile, setActiveFile } = useWidgetsContext();
    const editorRef = useRef<MinimalEditor | null>(null);
    const monacoRef = useRef<MinimalMonaco | null>(null);
    const modelsRef = useRef<Record<string, MinimalModel>>({});
    const tabBarRef = useRef<HTMLDivElement | null>(null);
    const [running, setRunning] = useState(false);
    const [lastRun, setLastRun] = useState<TestRunSummary | null>(null);
    // Ordered list of paths shown as tabs, in "open order" (not `files`
    // order) so a reopened file lands at the end (VSCode semantics). Closing
    // only hides a tab — the model stays alive, so LEIA can still read/edit
    // a closed file, and any setActiveFile call reopens its tab.
    const [openFiles, setOpenFiles] = useState<string[]>(
        () => files.map((f) => f.path),
    );
    // Used only for Monaco's initial model — deliberately not reactive.
    // Switching files goes through `setModel` on already-labeled models;
    // passing a reactive `language` prop here would race monaco-react's own
    // setModelLanguage call against our model-swap effect and can relabel
    // the wrong file.
    const [initialMonacoLanguage] = useState(() => monacoLanguage(files[0].language));

    // Claim an active file on mount if none is set yet (fresh session) or
    // the current one doesn't belong to this widget's file list.
    useEffect(() => {
        if (!activeFile || !files.some((f) => f.path === activeFile)) {
            setActiveFile(files[0]?.path ?? null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reopen the active file's tab if it was closed (append, not restore
    // position — see the openFiles comment above).
    useEffect(() => {
        if (!activeFile) return;
        setOpenFiles((prev) => (prev.includes(activeFile) ? prev : [...prev, activeFile]));
    }, [activeFile]);

    // Scroll the active tab into view so switching files via the project
    // tree or a LEIA tool doesn't leave the selection off-screen.
    useEffect(() => {
        if (!activeFile || !tabBarRef.current) return;
        const tab = tabBarRef.current.querySelector<HTMLElement>(`[data-tab-path="${CSS.escape(activeFile)}"]`);
        tab?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }, [activeFile, openFiles]);

    // React to activeFile changes from any source (local tabs or a sibling
    // ProjectTreeWidget) by swapping the model actually shown in the editor.
    useEffect(() => {
        if (!activeFile) return;
        const model = modelsRef.current[activeFile];
        const ed = editorRef.current;
        if (model && ed && ed.getModel() !== model) {
            ed.setModel(model);
        }
    }, [activeFile]);

    // Hides a tab (model stays alive) and picks the fallback active tab in
    // the same setState — doing this in a separate effect keyed on
    // `openFiles` would race the "reopen" effect above and could snap a
    // just-reopened tab back to whatever was active before it.
    const closeFile = useCallback((path: string) => {
        setOpenFiles((prev) => {
            const idx = prev.indexOf(path);
            if (prev.length <= 1 || idx === -1) return prev;
            const next = prev.filter((p) => p !== path);
            if (activeFile === path) {
                const fallback = next[Math.min(idx, next.length - 1)];
                if (fallback) setActiveFile(fallback);
            }
            return next;
        });
    }, [activeFile, setActiveFile]);

    const handleMount: OnMount = (ed, monaco) => {
        editorRef.current = ed as unknown as MinimalEditor;
        monacoRef.current = monaco as unknown as MinimalMonaco;
        for (const f of files) {
            modelsRef.current[f.path] = monacoRef.current.editor.createModel(
                f.content,
                monacoLanguage(f.language),
                monacoRef.current.Uri.parse(`file:///${f.path}`),
            );
        }
        const initial = modelsRef.current[activeFile ?? files[0].path] ?? modelsRef.current[files[0].path];
        (ed as unknown as MinimalEditor).setModel(initial);
        // Seed the bridge so a Send Solution click before the first
        // keystroke still hands over the starter.
        try {
            localStorage.setItem("mermaid_code", initial.getValue());
        } catch { /* ignore quota / SSR */ }
    };

    const getFileContent = useCallback((path: string): string => {
        return modelsRef.current[path]?.getValue() ?? files.find((f) => f.path === path)?.content ?? "";
    }, [files]);

    async function runTests(): Promise<TestRunSummary> {
        const code = getFileContent(testFile.path);
        const start = performance.now();
        setRunning(true);
        try {
            if (!hasTests) {
                const summary: TestRunSummary = { passed: 0, failed: 0, total: 0, results: [], durationMs: 0 };
                setLastRun(summary);
                return summary;
            }
            const out = testFile.language === "python"
                ? await runPyTests(code, problem.fnName, problem.tests)
                : await runJsTests(code, problem.fnName, problem.tests);
            const durationMs = Math.round(performance.now() - start);
            const results = out.results ?? [];
            const passed = results.filter((r) => r.ok).length;
            const summary: TestRunSummary = {
                passed,
                failed: results.length - passed,
                total: results.length,
                results,
                error: out.error,
                durationMs,
            };
            setLastRun(summary);
            return summary;
        } finally {
            setRunning(false);
        }
    }

    useLukeTool(
        "codeEditor_runTests",
        "Runs the test suite against the user's current code and returns whether each test passed. Call this when the user asks you to check / run / verify their solution, or when they say things like 'I think I got it' / 'try it'. Returns { passed, failed, total, language, results: [{name, ok, error?, expected?, actual?}], error? }.",
        { type: "object", properties: {} },
        async () => {
            const summary = await runTests();
            return { ...summary, language: testFile.language, fnName: problem.fnName, file: testFile.path };
        },
    );

    useLukeTool(
        "codeEditor_listFiles",
        "Lists the files open in the editor. Returns { files: [{path, language}], activeFile }. Call this first in a multi-file exercise so you know what exists before reading or editing a specific file.",
        { type: "object", properties: {} },
        async () => ({
            files: files.map((f) => ({ path: f.path, language: f.language })),
            activeFile,
        }),
    );

    useLukeTool(
        "codeEditor_read",
        "Reads the current content of a file in the editor. Returns { content, language, path, fnName }. Call this whenever the user mentions the editor / their code / 'this' / asks about what they wrote. Always read before suggesting edits.",
        {
            type: "object",
            properties: {
                file: { type: "string", description: "Path of the file to read (see codeEditor_listFiles). Defaults to the file currently open." },
            },
        },
        async (args) => {
            const raw = (args as { file?: unknown }).file;
            const path = typeof raw === "string" && files.some((f) => f.path === raw) ? raw : (activeFile ?? files[0].path);
            const file = files.find((f) => f.path === path) ?? files[0];
            return {
                content: getFileContent(path),
                language: file.language,
                path,
                fnName: problem.fnName,
            };
        },
    );

    useLukeTool(
        "codeEditor_applyDiff",
        "Edits a file with one or more search-and-replace operations. Each edit's `find` MUST appear exactly once in that file's current content (use enough surrounding context to make it unique). MUST be called whenever the user asks you to put / add / insert / write something in the editor — including hints, examples, explanations, snippets, pseudo-code, or comments. In those cases the help goes INSIDE the file as code comments (e.g. `// ...` or `# ...`), not as a chat reply. Also use it to fix bugs or rewrite code when explicitly authorized by the LEIA's behaviour. Returns { applied, errors, content, file }. Always call codeEditor_read first so you know the current text and can craft a unique `find` anchor.",
        {
            type: "object",
            properties: {
                file: { type: "string", description: "Path of the file to edit (see codeEditor_listFiles). Defaults to the file currently open." },
                edits: {
                    type: "array",
                    description: "List of edits to apply in order against the file's current content.",
                    items: {
                        type: "object",
                        properties: {
                            find: { type: "string", description: "Exact text to locate (must match a single occurrence)." },
                            replace: { type: "string", description: "Replacement text." },
                        },
                        required: ["find", "replace"],
                    },
                },
            },
            required: ["edits"],
        },
        async (args) => {
            const raw = (args as { file?: unknown }).file;
            const path = typeof raw === "string" && files.some((f) => f.path === raw) ? raw : (activeFile ?? files[0].path);
            const model = modelsRef.current[path];
            if (!model) return { applied: 0, errors: ["editor-not-mounted"], content: "", file: path };
            const editsRaw = (args as { edits?: unknown }).edits;
            if (!Array.isArray(editsRaw)) {
                return { applied: 0, errors: ["'edits' must be an array of {find, replace} objects"], content: model.getValue(), file: path };
            }
            const edits = editsRaw as DiffEdit[];
            const before = model.getValue();
            const { next, errors, applied } = applyEdits(before, edits);
            if (applied > 0) {
                model.setValue(next);
                setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
                if (path === activeFile) {
                    try { localStorage.setItem("mermaid_code", next); } catch { /* ignore */ }
                }
            }
            return { applied, errors, content: applied > 0 ? next : before, file: path };
        },
    );

    const activeFileMeta = files.find((f) => f.path === activeFile) ?? files[0];
    const singleFileFnLabel = !isMultiFile && testFile.language !== "text" && testFile.language !== "java"
        ? ` — ${problem.fnName}()`
        : "";

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 360 }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
                        Editor{singleFileFnLabel}
                    </span>
                </div>
                {problem.description && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>
                        {problem.description}
                    </div>
                )}
            </div>

            {isMultiFile && (
                <div
                    ref={tabBarRef}
                    className="leia-scrollbar"
                    onWheel={(e) => {
                        // Plain (non-shift) wheel scrolls the tab bar horizontally.
                        if (e.deltaY !== 0) {
                            e.currentTarget.scrollLeft += e.deltaY;
                        }
                    }}
                    style={{ display: "flex", overflowX: "auto", background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}
                >
                    {openFiles.map((path) => files.find((f) => f.path === path)).filter((f): f is ProblemFile => !!f).map((f) => {
                        const isActive = f.path === activeFile;
                        return (
                            <div
                                key={f.path}
                                data-tab-path={f.path}
                                onClick={() => setActiveFile(f.path)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "6px 6px 6px 12px",
                                    fontSize: 12,
                                    fontFamily: "monospace",
                                    whiteSpace: "nowrap",
                                    borderBottom: isActive ? "2px solid #60a5fa" : "2px solid transparent",
                                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                                    color: isActive ? "#e5e7eb" : "#94a3b8",
                                    cursor: "pointer",
                                }}
                            >
                                <span>{f.path}</span>
                                {openFiles.length > 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            closeFile(f.path);
                                        }}
                                        title={`Close ${f.path}`}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            color: "inherit",
                                            opacity: 0.55,
                                            cursor: "pointer",
                                            fontSize: 14,
                                            lineHeight: 1,
                                            padding: "0 2px",
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                <Editor
                    height="100%"
                    language={initialMonacoLanguage}
                    theme="vs-dark"
                    onMount={handleMount}
                    onChange={(value) => {
                        if (activeFile === activeFileMeta.path) {
                            try { localStorage.setItem("mermaid_code", value ?? ""); } catch { /* ignore */ }
                        }
                    }}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                    }}
                />
            </div>

            {hasTests && (
                <div className="leia-scrollbar" style={{ borderTop: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", padding: "8px 12px", color: "#e5e7eb", maxHeight: 220, overflowY: "auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <strong>Tests</strong>
                        {running && <span style={{ color: "#fbbf24" }}>running…</span>}
                        {!running && lastRun && (
                            <span style={{ color: lastRun.failed === 0 && !lastRun.error ? "#34d399" : "#f87171" }}>
                                {lastRun.error
                                    ? "error"
                                    : `${lastRun.passed} / ${lastRun.total} passed (${lastRun.durationMs} ms)`}
                            </span>
                        )}
                        {!running && !lastRun && (
                            <span style={{ color: "#94a3b8" }}>not run yet — ask LEIA to check your code</span>
                        )}
                    </div>
                    {lastRun?.error && (
                        <pre style={{ marginTop: 6, fontSize: 12, color: "#fca5a5", whiteSpace: "pre-wrap" }}>{lastRun.error}</pre>
                    )}
                    {lastRun?.results && lastRun.results.length > 0 && (
                        <ul style={{ marginTop: 6, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                            {lastRun.results.map((r, i) => (
                                <li key={i} style={{ fontSize: 12, color: r.ok ? "#86efac" : "#fca5a5" }}>
                                    <span style={{ marginRight: 6 }}>{r.ok ? "✓" : "✗"}</span>
                                    <span>{r.name}</span>
                                    {!r.ok && r.error && (
                                        <div style={{ marginLeft: 18, color: "#fca5a5", opacity: 0.85 }}>{r.error}</div>
                                    )}
                                    {!r.ok && !r.error && (
                                        <div style={{ marginLeft: 18, color: "#94a3b8", opacity: 0.85 }}>
                                            expected {JSON.stringify(r.expected)}, got {JSON.stringify(r.actual)}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
