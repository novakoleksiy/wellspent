import type { TimelineItem } from "./types";

const HIDDEN_TIMELINE_NOTES = new Set([
    "Placeholder routing for v1. Live transport data will plug in later.",
]);

export function visibleTimelineNote(
    item: Pick<TimelineItem, "kind" | "transport_mode" | "notes">,
): string | null {
    if (!item.notes) {
        return null;
    }

    const isPublicTransportPlaceholder =
        item.kind === "transport" &&
        item.transport_mode === "public_transport" &&
        HIDDEN_TIMELINE_NOTES.has(item.notes);

    return isPublicTransportPlaceholder ? null : item.notes;
}
