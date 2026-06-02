import type { ReactNode } from "react";
import { WidgetsProvider, useWidgetsContext } from "./WidgetsContext";
import { WidgetSlot } from "./WidgetSlot";
import type { WidgetDefinition } from "./types";

// Render-prop contract: the parent passes a function that receives the
// composed tools map and the left/right slot nodes. Used both for voice mode
// (workbench) and for the designer "try" in text mode.
export interface VoiceModeRenderArgs {
    tools: Record<string, unknown>;
    leftSlot: ReactNode;
    rightSlot: ReactNode;
}

interface VoiceModeWithWidgetsProps {
    widgets: WidgetDefinition[];
    children: (args: VoiceModeRenderArgs) => ReactNode;
}

function InnerBridge({ children }: { children: (args: VoiceModeRenderArgs) => ReactNode }) {
    const { tools, widgets } = useWidgetsContext();
    const hasLeft = widgets.some((w) => w.slot === "left");
    const hasRight = widgets.some((w) => w.slot === "right");
    return <>{children({
        tools: tools as Record<string, unknown>,
        leftSlot: hasLeft ? <WidgetSlot id="left" /> : null,
        rightSlot: hasRight ? <WidgetSlot id="right" /> : null,
    })}</>;
}

// Mounts a set of widgets in a WidgetsProvider and exposes their composed
// tools map plus the rendered slot nodes via a render-prop.
export function VoiceModeWithWidgets({ widgets, children }: VoiceModeWithWidgetsProps) {
    return (
        <WidgetsProvider widgets={widgets}>
            <InnerBridge>{children}</InnerBridge>
        </WidgetsProvider>
    );
}
