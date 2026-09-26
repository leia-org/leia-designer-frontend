import type { ProblemFile } from "./types";
import type { ProjectTreeNode } from "../ProjectTreeWidget";

// Fetches scenario files via our own backend (GET
// /interactions/:sessionId/scenario-files), never jsDelivr/GitHub directly —
// the repo folder a scenario lives in IS the pattern name the exercise
// expects the student to find, so a client-side request naming it would leak
// the answer to anyone reading the Network tab. See leia-workbench-backend's
// InteractionService/ScenarioRepoService.
//
// Returns null when this session's problem has no scenario source (backend
// 404s) — the normal case, meaning "use the static params", not an error.
//
// Note: this Designer's VITE_APP_BACKEND points at designer-backend, not
// leia-workbench-backend, so in the "Try" preview this always 404s and falls
// back to static config.
export async function fetchScenarioFiles(
    sessionId: string,
): Promise<{ files: ProblemFile[]; tree: ProjectTreeNode[] } | null> {
    const res = await fetch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/scenario-files`,
    );
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`Could not load scenario files (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { files: ProblemFile[] };
    const tree: ProjectTreeNode[] = data.files.map((f) => ({
        name: f.path,
        type: "file",
        path: f.path,
    }));
    return { files: data.files, tree };
}
