import { useEffect, useRef } from "react";
import type { FrontendTool } from "./luke-types";
import { useWidgetsContext } from "./WidgetsContext";

// Registers a tool in the widget registry for the lifetime of the calling
// component. Description / parameters / execute are captured via refs so the
// caller can pass fresh object literals on every render without re-triggering
// registration.
export function useLukeTool(
    name: string,
    description: string,
    parameters: Record<string, unknown>,
    execute: (args: Record<string, unknown>) => Promise<unknown> | unknown,
): void {
    const { registerTool, unregisterTool } = useWidgetsContext();
    const descriptionRef = useRef(description);
    const parametersRef = useRef(parameters);
    const executeRef = useRef(execute);
    descriptionRef.current = description;
    parametersRef.current = parameters;
    executeRef.current = execute;

    useEffect(() => {
        const tool: FrontendTool = {
            description: descriptionRef.current,
            parameters: parametersRef.current,
            execute: (args) => executeRef.current(args),
        };
        registerTool(name, tool);
        return () => unregisterTool(name);
    }, [name, registerTool, unregisterTool]);
}
