import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FrontendTool } from "./luke-types";
import type { SlotId, ToolsMap, WidgetDefinition } from "./types";

interface WidgetsContextValue {
    widgets: WidgetDefinition[];
    widgetForSlot: (slot: SlotId) => WidgetDefinition | undefined;
    tools: ToolsMap;
    registerTool: (name: string, tool: FrontendTool) => void;
    unregisterTool: (name: string) => void;
}

const WidgetsContext = createContext<WidgetsContextValue | null>(null);

interface WidgetsProviderProps {
    widgets: WidgetDefinition[];
    children: ReactNode;
}

// Hosts the tool registry shared by all mounted widgets. When a widget
// mounts it calls `useLukeTool` which registers here; on unmount it
// unregisters. The `tools` object reference changes whenever the set
// changes, so consumers can depend on it.
export function WidgetsProvider({ widgets, children }: WidgetsProviderProps) {
    const [tools, setTools] = useState<ToolsMap>({});

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

    const widgetForSlot = useCallback(
        (slot: SlotId) => widgets.find((w) => w.slot === slot),
        [widgets]
    );

    const value = useMemo<WidgetsContextValue>(
        () => ({ widgets, widgetForSlot, tools, registerTool, unregisterTool }),
        [widgets, widgetForSlot, tools, registerTool, unregisterTool]
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
