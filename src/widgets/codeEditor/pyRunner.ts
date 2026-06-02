import type { TestCase, TestResult } from "./types";

// PyScript Donkey API exposed by core.js. Loaded once on first use and
// kept around as a singleton (Pyodide is ~10MB so we don't want to pay
// the download more than once per page).
interface DonkeyInstance {
    execute: (statement: string) => Promise<unknown>;
    evaluate: (expression: string) => Promise<unknown>;
    process?: (code: string) => Promise<unknown>;
}

interface DonkeyOptions {
    type?: "py" | "mpy";
    persistent?: boolean;
    terminal?: string | false;
    config?: Record<string, unknown>;
}

let donkeyPromise: Promise<DonkeyInstance> | null = null;

function loadDonkey(): Promise<DonkeyInstance> {
    if (donkeyPromise) return donkeyPromise;
    donkeyPromise = (async () => {
        // Dynamic import from the CDN — the URL is intentionally external
        // and not bundled by Vite. Tell Vite to leave it alone.
        const url = "https://pyscript.net/releases/2026.3.1/core.js";
        const mod: { donkey: (opts: DonkeyOptions) => Promise<DonkeyInstance> } =
            await import(/* @vite-ignore */ url);
        const instance = await mod.donkey({
            type: "py",
            persistent: true,
            // Disable the auto-injected <py-terminal> element. PyScript
            // creates it via the inner script's config; setting
            // config.terminal=false at the PyScript level prevents the
            // DOM injection (the top-level `terminal` option is just a
            // CSS selector for an existing element and doesn't disable).
            config: { terminal: false },
        } as unknown as DonkeyOptions);
        return instance;
    })();
    return donkeyPromise;
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
    let py: DonkeyInstance;
    try {
        py = await loadDonkey();
    } catch (err) {
        return { error: `Failed to load PyScript: ${err instanceof Error ? err.message : String(err)}` };
    }

    // Define the user's code. If it raises a syntax error, surface it
    // as a compile error.
    try {
        await py.execute(code);
    } catch (err) {
        return { error: `Compile error: ${err instanceof Error ? err.message : String(err)}` };
    }

    // Verify the function exists.
    try {
        const exists = await py.evaluate(`callable(globals().get(${JSON.stringify(fnName)}))`);
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
            const argsLiteral = JSON.stringify(JSON.stringify(t.args));
            const expr = `${fnName}(*__import__('json').loads(${argsLiteral}))`;
            const raw = await py.evaluate(expr);
            const actual = toPlain(raw);
            const ok = deepEqual(actual, t.expected);
            results.push({ name: t.name, ok, expected: t.expected, actual });
        } catch (err) {
            results.push({ name: t.name, ok: false, error: err instanceof Error ? err.message : String(err) });
        }
    }
    return { results };
}
