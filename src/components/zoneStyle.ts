import type { ZoneKind } from "@/lib/rules";

/** Display name and colours for each zone, shared by the canvas and the results panel. */
export const ZONE_STYLE: Record<ZoneKind, { label: string; fill: string; text: string }> = {
  living: { label: "Living", fill: "#fde68a", text: "#92400e" },
  service: { label: "Service", fill: "#d4d4d8", text: "#3f3f46" },
  private: { label: "Private", fill: "#bbf7d0", text: "#166534" },
};
