import { z } from "zod";
import type { PlotRules } from "./rules";

const metres = (label: string, max: number) =>
  z.number({ error: `${label} must be a number` })
    .min(0, `${label} can't be negative`)
    .max(max, `${label} must be at most ${max} m`);

export const plotRulesSchema = z.object({
  plotWidth: metres("Plot width", 500).positive("Plot width must be above 0"),
  plotDepth: metres("Plot depth", 500).positive("Plot depth must be above 0"),
  frontSetback: metres("Front setback", 100),
  rearSetback: metres("Rear setback", 100),
  sideSetback: metres("Side setback", 100),
  maxCoverage: z.number({ error: "Max coverage must be a number" })
    .gt(0, "Max coverage must be above 0%")
    .max(100, "Max coverage can't exceed 100%"),
}) satisfies z.ZodType<PlotRules>;

/** Generic example values, not taken from any real building code. */
export const defaultRules: PlotRules = {
  plotWidth: 20,
  plotDepth: 30,
  frontSetback: 4,
  rearSetback: 2,
  sideSetback: 2,
  maxCoverage: 60,
};
