import type { EditorLanguage, ProblemDef, ProblemFile } from "./types";

// Mirrors leia-workbench-frontend/src/widgets/codeEditor/files.ts.
function legacyFileName(language: EditorLanguage): string {
    switch (language) {
        case "java": return "Solution.java";
        case "python": return "solution.py";
        case "text": return "notes.txt";
        default: return "solution.js";
    }
}

// Resolves a problem's file list. Multi-file problems (`files`) are used
// as-is; legacy single-file problems (`starter` keyed by language) are
// wrapped into a one-element list so both shapes flow through the same
// tab bar / tools without the rest of the widget knowing the difference.
export function resolveFiles(problem: ProblemDef): ProblemFile[] {
    if (Array.isArray(problem.files) && problem.files.length > 0) return problem.files;
    const language = problem.language ?? "javascript";
    const content = problem.starter?.[language] ?? "";
    return [{ path: legacyFileName(language), language, content }];
}
