import { useWidgetsContext } from "./WidgetsContext";
import type { SlotId } from "./types";

interface WidgetSlotProps {
    id: SlotId;
}

// Renders the widget currently assigned to a slot. If no widget is
// assigned the slot takes no space.
export function WidgetSlot({ id }: WidgetSlotProps) {
    const { widgetForSlot } = useWidgetsContext();
    const widget = widgetForSlot(id);
    if (!widget) return null;
    const { Component, props } = widget;
    return <Component {...(props ?? {})} />;
}
