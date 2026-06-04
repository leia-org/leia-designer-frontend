import type { TestCase, TestResult } from "./types";

// Worker source. Runs in a fresh worker per test run so a runaway loop
// only takes down the worker, not the main thread. The worker terminates
// itself once it posts the results.
const WORKER_SOURCE = `
function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
        return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
}

self.onmessage = (ev) => {
    const { code, tests, fnName } = ev.data;
    let userFn;
    try {
        // Evaluate the user's code in this worker scope. We expose the
        // function on globalThis so we can grab it by name afterwards.
        const wrapped = code + '\\n;try{globalThis.__userFn=' + fnName + '}catch(_){}';
        (0, eval)(wrapped);
        userFn = globalThis.__userFn;
        if (typeof userFn !== 'function') throw new Error('Function "' + fnName + '" is not defined');
    } catch (err) {
        self.postMessage({ type: 'compile-error', error: String(err && err.message || err) });
        return;
    }
    const results = tests.map((t) => {
        try {
            const actual = userFn.apply(null, t.args);
            const ok = deepEqual(actual, t.expected);
            return { name: t.name, ok, expected: t.expected, actual };
        } catch (err) {
            return { name: t.name, ok: false, error: String(err && err.message || err) };
        }
    });
    self.postMessage({ type: 'results', results });
};
`;

const RUN_TIMEOUT_MS = 5000;

export function runJsTests(code: string, fnName: string, tests: TestCase[]): Promise<{ results?: TestResult[]; error?: string }> {
    return new Promise((resolve) => {
        const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        const cleanup = () => {
            worker.terminate();
            URL.revokeObjectURL(url);
        };
        const timer = setTimeout(() => {
            cleanup();
            resolve({ error: `Execution timed out after ${RUN_TIMEOUT_MS} ms (likely an infinite loop)` });
        }, RUN_TIMEOUT_MS);
        worker.onmessage = (ev) => {
            clearTimeout(timer);
            cleanup();
            if (ev.data.type === "compile-error") resolve({ error: ev.data.error });
            else resolve({ results: ev.data.results });
        };
        worker.onerror = (ev) => {
            clearTimeout(timer);
            cleanup();
            resolve({ error: ev.message || "Worker error" });
        };
        worker.postMessage({ code, tests, fnName });
    });
}
