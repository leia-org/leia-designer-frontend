import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditorWidget } from "./CodeEditorWidget";
import { ProjectTreeWidget, type ProjectTreeNode } from "./ProjectTreeWidget";
import type { ProblemDef, ProblemFile } from "./codeEditor/types";
import { fetchScenarioFiles } from "./codeEditor/scenarioRepo";
import { useWidgetsContext } from "./WidgetsContext";

interface CodeEditorWithTreeParams {
    codeEditor?: Partial<ProblemDef>;
    projectTree?: { title?: string; tree?: ProjectTreeNode[] };
    /** Initial height of the editor pane, as a percentage of the widget's
     *  height. The student can drag the divider to change it afterwards. */
    initialSplitPercent?: number;
    // Deliberately no `scenarioSource` field here: the backend strips it
    // before this component ever sees it (the repo folder it names IS the
    // pattern the exercise expects the student to find) — this widget just
    // asks the backend for scenario files scoped to the session (see below).
}

interface CodeEditorWithTreeWidgetProps {
    params?: CodeEditorWithTreeParams;
}

// null = still resolving (haven't heard back from the backend yet).
// "static" = confirmed this session has no scenario source (or the fetch
//   failed) — render `params.codeEditor`/`params.projectTree` as authored.
// {files, tree} = fetched from the backend for this session.
type ScenarioResolution = { files: ProblemFile[]; tree: ProjectTreeNode[] } | "static" | null;

const MIN_PERCENT = 15;
const MAX_PERCENT = 85;

// Combines CodeEditorWidget and ProjectTreeWidget into a single panel — code
// on top, project tree below, split by a draggable divider. Both sub-widgets
// are mounted as-is (no logic duplicated here): they already sync the active
// file through WidgetsContext, so clicking a tree node opens it in the editor
// exactly like when the two are assigned to separate slots.
//
// Mirrors leia-workbench-frontend's CodeEditorWithTreeWidget.tsx — keep both
// in sync.
export function CodeEditorWithTreeWidget({ params }: CodeEditorWithTreeWidgetProps = {}) {
    const [splitPercent, setSplitPercent] = useState(params?.initialSplitPercent ?? 65);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);
    const { sessionId } = useWidgetsContext();

    const [resolution, setResolution] = useState<ScenarioResolution>(null);

    useEffect(() => {
        if (!sessionId) {
            setResolution("static");
            return;
        }
        let cancelled = false;
        setResolution(null);
        fetchScenarioFiles(sessionId)
            .then((result) => {
                if (!cancelled) setResolution(result ?? "static");
            })
            .catch((err: unknown) => {
                console.warn("CodeEditorWithTreeWidget: scenario fetch failed, using static config", err);
                if (!cancelled) setResolution("static");
            });
        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    const onDividerPointerDown = useCallback((e: React.PointerEvent) => {
        draggingRef.current = true;
        e.preventDefault();
    }, []);

    useEffect(() => {
        function onPointerMove(e: PointerEvent) {
            if (!draggingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const percent = ((e.clientY - rect.top) / rect.height) * 100;
            setSplitPercent(Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, percent)));
        }
        function onPointerUp() {
            draggingRef.current = false;
        }
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
        };
    }, []);

    // CodeEditorWidget builds its Monaco models once, on mount, and never
    // reacts to `params` changing afterwards — so it must not mount until we
    // know the final file set, or it'll permanently keep whatever (empty)
    // files were present at that first mount. ProjectTreeWidget has no such
    // constraint (reads params.tree reactively) so it renders immediately.
    const stillResolving = resolution === null;
    const remote = resolution && resolution !== "static" ? resolution : null;
    const codeEditorParams = remote ? { ...params?.codeEditor, files: remote.files } : params?.codeEditor;
    const projectTreeParams = remote
        ? { title: params?.projectTree?.title, tree: remote.tree }
        : params?.projectTree;

    return (
        <div ref={containerRef} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <div style={{ height: `${splitPercent}%`, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {stillResolving ? (
                    <ScenarioStatusPane message="Loading…" />
                ) : (
                    <CodeEditorWidget params={codeEditorParams} />
                )}
            </div>

            <div
                onPointerDown={onDividerPointerDown}
                style={{
                    height: 6,
                    flexShrink: 0,
                    cursor: "row-resize",
                    background: "rgba(255,255,255,0.12)",
                    position: "relative",
                }}
                title="Drag to resize"
            >
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 32,
                        height: 3,
                        borderRadius: 2,
                        background: "rgba(255,255,255,0.35)",
                    }}
                />
            </div>

            <div style={{ height: `${100 - splitPercent}%`, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <ProjectTreeWidget params={projectTreeParams} />
            </div>
        </div>
    );
}

function ScenarioStatusPane({ message }: { message: string }) {
    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                textAlign: "center",
                fontSize: 13,
                color: "#94a3b8",
                background: "rgba(0,0,0,0.15)",
            }}
        >
            {message}
        </div>
    );
}
