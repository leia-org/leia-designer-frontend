import type { ComponentType } from "react";
import type { FrontendTool } from "./luke-types";
import type { WidgetSlot } from "../models/Leia";

// Single source of truth for the slot union lives in models/Leia (WidgetSlot).
export type SlotId = WidgetSlot;

// A widget instance mounted in a slot. `Component` comes from the catalog;
// `props` carries the per-activity params authored in the problem.
export interface WidgetDefinition {
  id: string;
  slot: SlotId;
  title?: string;
  Component: ComponentType<any>;
  props?: Record<string, unknown>;
}

// A namespaced tool entry in the registry. The key is the fully-qualified
// tool name the LLM sees (e.g. "codeEditor_read").
export type ToolsMap = Record<string, FrontendTool>;
