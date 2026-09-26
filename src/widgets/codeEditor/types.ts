export interface TestCase {
    name: string;
    args: unknown[];
    expected: unknown;
}

export interface TestResult {
    name: string;
    ok: boolean;
    error?: string;
    expected?: unknown;
    actual?: unknown;
}

export interface TestRunSummary {
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
    /** Compile / load error that prevented any test from running. */
    error?: string;
    /** Total wall-clock time of the run, ms. */
    durationMs: number;
}

/** Editor language. "text" is a plain-text editor with no execution/tests.
 *  "java" provides syntax highlighting only — no in-browser execution. */
export type EditorLanguage = "javascript" | "python" | "text" | "java";

export interface ProblemFile {
    path: string;
    language: EditorLanguage;
    content: string;
}

export interface ProblemDef {
    /** Function name the user must implement. */
    fnName: string;
    description: string;
    /** Language the instructor fixed for this activity. The student cannot change it. */
    language?: EditorLanguage;
    starter?: {
        javascript: string;
        python: string;
        text?: string;
        java?: string;
    };
    /** Multi-file mode. When present, takes priority over `starter`. */
    files?: ProblemFile[];
    tests: TestCase[];
}
