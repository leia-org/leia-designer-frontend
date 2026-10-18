import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FrontendTool } from "./luke-types";
import type { SlotId, ToolsMap, WidgetDefinition } from "./types";

interface WidgetsContextValue {
    widgets: WidgetDefinition[];
    /** All widgets assigned to a slot (a slot can hold more than one). */
    widgetsForSlot: (slot: SlotId) => WidgetDefinition[];
    tools: ToolsMap;
    registerTool: (name: string, tool: FrontendTool) => void;
    unregisterTool: (name: string) => void;
    /** Path of the file currently open in a CodeEditorWidget — shared so a
     *  sibling ProjectTreeWidget can open it by clicking a file node. */
    activeFile: string | null;
    setActiveFile: (path: string | null) => void;
    /** The student's current answer, published by whichever widget owns the
     *  submission format (MermaidViewerWidget). Mirrors the workbench repo. */
    submissionContent: string | null;
    setSubmissionContent: (code: string | null) => void;
    /** Current session id. In the Designer's "Try" preview this isn't a real
     *  workbench Session, so a scenario-files fetch scoped to it 404s and the
     *  widget falls back to its static config. */
    sessionId: string | null;
}

const WidgetsContext = createContext<WidgetsContextValue | null>(null);

interface WidgetsProviderProps {
    widgets: WidgetDefinition[];
    sessionId?: string | null;
    children: ReactNode;
}

// Hosts the tool registry shared by all mounted widgets. When a widget
// mounts it calls `useLukeTool` which registers here; on unmount it
// unregisters. The `tools` object reference changes whenever the set
// changes, so consumers can depend on it.
export function WidgetsProvider({ widgets, sessionId = null, children }: WidgetsProviderProps) {
    const [tools, setTools] = useState<ToolsMap>({});
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [submissionContent, setSubmissionContent] = useState<string | null>(null);

    const registerTool = useCallback((name: string, tool: FrontendTool) => {
        setTools((prev) => ({ ...prev, [name]: tool }));
    }, []);

    const unregisterTool = useCallback((name: string) => {
        setTools((prev) => {
            if (!(name in prev)) return prev;
            const next = { ...prev };
            delete next[name];
            return next;
        });
    }, []);

    const widgetsForSlot = useCallback(
        (slot: SlotId) => widgets.filter((w) => w.slot === slot),
        [widgets]
    );

    const value = useMemo<WidgetsContextValue>(
        () => ({
            widgets,
            widgetsForSlot,
            tools,
            registerTool,
            unregisterTool,
            activeFile,
            setActiveFile,
            submissionContent,
            setSubmissionContent,
            sessionId,
        }),
        [widgets, widgetsForSlot, tools, registerTool, unregisterTool, activeFile, submissionContent, sessionId]
    );

    return <WidgetsContext.Provider value={value}>{children}</WidgetsContext.Provider>;
}

export function useWidgetsContext(): WidgetsContextValue {
    const ctx = useContext(WidgetsContext);
    if (!ctx) throw new Error("useWidgetsContext must be used inside <WidgetsProvider>");
    return ctx;
}

// Optional variant for components that can live without a provider
// (returns an empty registry).
export function useWidgetsContextOptional(): WidgetsContextValue | null {
    return useContext(WidgetsContext);
}
