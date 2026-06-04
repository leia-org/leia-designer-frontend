import { useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useLukeTool } from "./useLukeTool";
import { DEFAULT_PROBLEM } from "./codeEditor/problem";
import { runJsTests } from "./codeEditor/jsRunner";
import { runPyTests } from "./codeEditor/pyRunner";
import type { ProblemDef, TestRunSummary } from "./codeEditor/types";

// Minimal subset of monaco's IStandaloneCodeEditor that we actually use.
interface MinimalEditor {
    getValue(): string;
    setValue(value: string): void;
}

interface DiffEdit {
    find: string;
    replace: string;
}

// Apply a list of {find, replace} edits to the editor's current content.
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

type Lang = "javascript" | "python";

interface CodeEditorWidgetProps {
    /** Optional per-activity problem definition. Overrides DEFAULT_PROBLEM. */
    params?: Partial<ProblemDef>;
}

function mergeProblem(p?: Partial<ProblemDef>): ProblemDef {
    if (!p) return DEFAULT_PROBLEM;
    return {
        fnName: p.fnName ?? DEFAULT_PROBLEM.fnName,
        description: p.description ?? DEFAULT_PROBLEM.description,
        starter: {
            javascript: p.starter?.javascript ?? DEFAULT_PROBLEM.starter.javascript,
            python: p.starter?.python ?? DEFAULT_PROBLEM.starter.python,
        },
        tests: p.tests ?? DEFAULT_PROBLEM.tests,
    };
}

// A widget showing a Monaco editor and exposing three tools to LEIA:
// codeEditor_read, codeEditor_applyDiff, codeEditor_runTests.
export function CodeEditorWidget({ params }: CodeEditorWidgetProps = {}) {
    const problem = useMemo(() => mergeProblem(params), [params]);
    const editorRef = useRef<MinimalEditor | null>(null);
    const [language, setLanguage] = useState<Lang>("javascript");
    const [running, setRunning] = useState(false);
    const [lastRun, setLastRun] = useState<TestRunSummary | null>(null);

    // Re-seed the editor when the user switches language so they get
    // the right starter without losing their work in the other lang.
    const draftsRef = useRef<Record<Lang, string>>({
        javascript: problem.starter.javascript,
        python: problem.starter.python,
    });

    const onLanguageChange = (next: Lang) => {
        const ed = editorRef.current;
        if (ed) draftsRef.current[language] = ed.getValue();
        setLanguage(next);
        if (ed) ed.setValue(draftsRef.current[next]);
    };

    async function runTests(): Promise<TestRunSummary> {
        const code = editorRef.current?.getValue() ?? draftsRef.current[language];
        const start = performance.now();
        setRunning(true);
        try {
            const out = language === "javascript"
                ? await runJsTests(code, problem.fnName, problem.tests)
                : await runPyTests(code, problem.fnName, problem.tests);
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
        "Runs the test suite against the user's current code in the editor and returns whether each test passed. Call this when the user asks you to check / run / verify their solution, or when they say things like 'I think I got it' / 'try it'. Returns { passed, failed, total, language, results: [{name, ok, error?, expected?, actual?}], error? }.",
        { type: "object", properties: {} },
        async () => {
            const summary = await runTests();
            return { ...summary, language, fnName: problem.fnName };
        },
    );

    useLukeTool(
        "codeEditor_read",
        "Reads the current content of the in-page Monaco code editor. Returns { content, language, fnName }. Call this whenever the user mentions the editor / their code / 'this' / asks about what they wrote. Always read before suggesting edits.",
        { type: "object", properties: {} },
        async () => ({
            content: editorRef.current?.getValue() ?? draftsRef.current[language],
            language,
            fnName: problem.fnName,
        }),
    );

    useLukeTool(
        "codeEditor_applyDiff",
        "Edits the user's code with one or more search-and-replace operations. Each edit's `find` MUST appear exactly once in the current code (use enough surrounding context to make it unique). MUST be called whenever the user asks you to put / add / insert / write something in the editor — including hints, examples, explanations, snippets, pseudo-code, or comments. In those cases the help goes INSIDE the editor as code comments (e.g. `// ...` or `# ...`), not as a chat reply. Also use it to fix bugs or rewrite code when explicitly authorized by the LEIA's behaviour. Returns { applied, errors, content }. Always call codeEditor_read first so you know the current text and can craft a unique `find` anchor.",
        {
            type: "object",
            properties: {
                edits: {
                    type: "array",
                    description: "List of edits to apply in order against the editor's current content.",
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
            const ed = editorRef.current;
            if (!ed) return { applied: 0, errors: ["editor-not-mounted"], content: "" };
            const editsRaw = (args as { edits?: unknown }).edits;
            if (!Array.isArray(editsRaw)) {
                return { applied: 0, errors: ["'edits' must be an array of {find, replace} objects"], content: ed.getValue() };
            }
            const edits = editsRaw as DiffEdit[];
            const before = ed.getValue();
            const { next, errors, applied } = applyEdits(before, edits);
            if (applied > 0) {
                ed.setValue(next);
                draftsRef.current[language] = next;
            }
            return { applied, errors, content: applied > 0 ? next : before };
        },
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 360 }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Code editor — {problem.fnName}()</span>
                    <select
                        value={language}
                        onChange={(e) => onLanguageChange(e.target.value as Lang)}
                        style={{ marginLeft: "auto", background: "rgba(0,0,0,0.3)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "2px 6px", fontSize: 12 }}
                    >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                    </select>
                </div>
                {problem.description && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>
                        {problem.description}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                <Editor
                    height="100%"
                    defaultValue={draftsRef.current[language]}
                    language={language}
                    theme="vs-dark"
                    onMount={((ed) => {
                        editorRef.current = ed as unknown as MinimalEditor;
                        // Seed the bridge so a Send Solution click before
                        // the first keystroke still hands over the starter.
                        try {
                            localStorage.setItem("mermaid_code", (ed as unknown as MinimalEditor).getValue());
                        } catch { /* ignore quota / SSR */ }
                    }) as OnMount}
                    onChange={(value) => {
                        const v = value ?? "";
                        draftsRef.current[language] = v;
                        // Bridge to the /edit view, which seeds its editor
                        // from localStorage["mermaid_code"].
                        try { localStorage.setItem("mermaid_code", v); } catch { /* ignore */ }
                    }}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                    }}
                />
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", padding: "8px 12px", color: "#e5e7eb", maxHeight: 220, overflowY: "auto" }}>
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
        </div>
    );
}
