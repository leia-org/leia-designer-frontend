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

/** Editor language. "text" is a plain-text editor with no execution/tests. */
export type EditorLanguage =
    | "javascript" | "typescript" | "python" | "java" | "rust" | "c" | "cpp"
    | "csharp" | "php" | "go" | "kotlin" | "swift" | "ruby" | "r" | "matlab"
    | "dart" | "scala" | "perl" | "lua" | "objective-c" | "assembly" | "sql"
    | "plsql" | "haskell" | "elixir" | "erlang" | "clojure" | "fsharp"
    | "vb" | "delphi" | "fortran" | "cobol" | "julia" | "groovy" | "bash"
    | "powershell" | "solidity" | "zig" | "nim" | "ocaml" | "prolog"
    | "scheme" | "lisp" | "scratch" | "gdscript" | "apex" | "abap" | "v"
    | "crystal" | "d" | "text";

export interface ProblemDef {
    /** Function name the user must implement. */
    fnName: string;
    description: string;
    /** Language the instructor fixed for this activity. The student cannot change it. */
    language?: EditorLanguage;
    starter: {
        javascript: string;
        typescript: string;
        python: string;
        java: string;
        rust: string;
        c: string;
        cpp: string;
        csharp: string;
        php: string;
        go: string;
        kotlin: string;
        swift: string;
        ruby: string;
        r: string;
        matlab: string;
        dart: string;
        scala: string;
        perl: string;
        lua: string;
        "objective-c": string;
        assembly: string;
        sql: string;
        plsql: string;
        haskell: string;
        elixir: string;
        erlang: string;
        clojure: string;
        fsharp: string;
        vb: string;
        delphi: string;
        fortran: string;
        cobol: string;
        julia: string;
        groovy: string;
        bash: string;
        powershell: string;
        solidity: string;
        zig: string;
        nim: string;
        ocaml: string;
        prolog: string;
        scheme: string;
        lisp: string;
        scratch: string;
        gdscript: string;
        apex: string;
        abap: string;
        v: string;
        crystal: string;
        d: string;
        text?: string;
    };
    tests: TestCase[];
}
