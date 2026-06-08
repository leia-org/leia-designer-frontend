import type { TestCase, TestResult } from "./types";

interface PyodideInstance {
    runPythonAsync: (code: string) => Promise<unknown>;
    globals: {
        set: (name: string, value: unknown) => void;
        get: (name: string) => unknown;
    };
}

interface PyodideModule {
    loadPyodide: (options?: {
        stdout?: (text: string) => void;
        stderr?: (text: string) => void;
    }) => Promise<PyodideInstance>;
}

let pyodidePromise: Promise<PyodideInstance> | null = null;

function loadPyodideRuntime(): Promise<PyodideInstance> {
    if (pyodidePromise) return pyodidePromise;
    pyodidePromise = (async () => {
        const url = "https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.mjs";
        const mod = (await import(/* @vite-ignore */ url)) as PyodideModule;
        return mod.loadPyodide({
            stdout: () => undefined,
            stderr: () => undefined,
        });
    })();
    return pyodidePromise;
}

// Convert a JS value (possibly a Pyodide proxy) into a plain comparable
// value. Pyodide auto-converts primitives and lists/dicts of primitives
// when crossing the boundary, but a defensive `toJs()` call covers the
// edge cases (e.g. tuples).
function toPlain(v: unknown): unknown {
    if (v && typeof v === "object" && "toJs" in v && typeof (v as { toJs: () => unknown }).toJs === "function") {
        try {
            return (v as { toJs: () => unknown }).toJs();
        } catch {
            // fall through
        }
    }
    return v;
}

function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== "object") return Number.isNaN(a) && Number.isNaN(b);
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
        return true;
    }
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) return false;
        for (const [k, v] of a) if (!deepEqual(v, b.get(k))) return false;
        return true;
    }
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    return true;
}

export async function runPyTests(
    code: string,
    fnName: string,
    tests: TestCase[],
): Promise<{ results?: TestResult[]; error?: string }> {
    let py: PyodideInstance;
    try {
        py = await loadPyodideRuntime();
    } catch (err) {
        return { error: `Failed to load Pyodide: ${err instanceof Error ? err.message : String(err)}` };
    }

    py.globals.set("__leia_user_code", code);
    py.globals.set("__leia_fn_name", fnName);

    try {
        await py.runPythonAsync(`
__leia_namespace = {}
exec(__leia_user_code, __leia_namespace)
`);
    } catch (err) {
        return { error: `Compile error: ${err instanceof Error ? err.message : String(err)}` };
    }

    // Verify the function exists.
    try {
        await py.runPythonAsync("__leia_exists = callable(__leia_namespace.get(__leia_fn_name))");
        const exists = py.globals.get("__leia_exists");
        if (!exists) {
            return { error: `Function "${fnName}" is not defined in the submitted code.` };
        }
    } catch {
        // ignore — the per-test loop will report the same problem.
    }

    const results: TestResult[] = [];
    for (const t of tests) {
        try {
            // Marshal arguments via JSON to avoid string-quoting traps.
            py.globals.set("__leia_args_json", JSON.stringify(t.args));
            await py.runPythonAsync(`
import json
__leia_result = __leia_namespace[__leia_fn_name](*json.loads(__leia_args_json))
`);
            const raw = py.globals.get("__leia_result");
            const actual = toPlain(raw);
            const ok = deepEqual(actual, t.expected);
            results.push({ name: t.name, ok, expected: t.expected, actual });
        } catch (err) {
            results.push({ name: t.name, ok: false, error: err instanceof Error ? err.message : String(err) });
        }
    }
    try {
        await py.runPythonAsync(`
for __leia_key in ("__leia_user_code", "__leia_fn_name", "__leia_args_json", "__leia_namespace", "__leia_exists", "__leia_result"):
    globals().pop(__leia_key, None)
`);
    } catch {
        // ignore cleanup errors
    }
    return { results };
}
