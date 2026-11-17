/**
 * Pure zoning rule functions. All lengths are in metres, areas in m².
 *
 * Coordinate system: origin at the plot's rear-left corner, x grows to the
 * right, y grows towards the street (front). The rules use generic example
 * values and do not claim compliance with any real building code.
 */

export interface PlotRules {
  /** Plot width along the street, m */
  plotWidth: number;
  /** Plot depth from street to rear boundary, m */
  plotDepth: number;
  /** Distance from the street boundary, m */
  frontSetback: number;
  /** Distance from the rear boundary, m */
  rearSetback: number;
  /** Distance from each side boundary, m */
  sideSetback: number;
  /** Maximum building coverage as % of plot area (0-100) */
  maxCoverage: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface Envelope {
  rect: Rect;
  area: number;
}

export interface Footprint {
  rect: Rect;
  area: number;
  /** Footprint area as % of plot area */
  coverage: number;
  /** Max footprint allowed by the coverage rule */
  maxAllowedArea: number;
  /** Which rule ends up limiting the footprint */
  limitedBy: "setbacks" | "coverage";
}

export type ZoneKind = "living" | "service" | "private";

export interface Zone {
  kind: ZoneKind;
  rect: Rect;
  area: number;
}

/**
 * Share of the footprint depth given to each zone, ordered from the street
 * (front) to the rear. Generic example values; they must add up to 1.
 */
export const ZONE_SHARES: readonly { kind: ZoneKind; share: number }[] = [
  { kind: "living", share: 0.4 },
  { kind: "service", share: 0.25 },
  { kind: "private", share: 0.35 },
];

export type PlanResult =
  | { ok: true; plotArea: number; envelope: Envelope; footprint: Footprint; zones: Zone[] }
  | { ok: false; plotArea: number; error: string };

export const rectArea = (r: Rect) => r.width * r.depth;

/**
 * The buildable envelope: the plot minus its setbacks.
 * Returns null when the setbacks leave no buildable space.
 */
export function computeEnvelope(rules: PlotRules): Envelope | null {
  const width = rules.plotWidth - 2 * rules.sideSetback;
  const depth = rules.plotDepth - rules.frontSetback - rules.rearSetback;
  if (width <= 0 || depth <= 0) return null;

  const rect: Rect = { x: rules.sideSetback, y: rules.rearSetback, width, depth };
  return { rect, area: rectArea(rect) };
}

/**
 * The largest rectangular footprint that fits the envelope and the coverage
 * limit. When coverage is the tighter rule, the envelope is scaled down
 * uniformly (keeping its proportions), centred horizontally and placed
 * against the front setback line.
 */
export function computeFootprint(rules: PlotRules, envelope: Envelope): Footprint {
  const plotArea = rules.plotWidth * rules.plotDepth;
  const maxAllowedArea = (plotArea * rules.maxCoverage) / 100;
  const env = envelope.rect;

  if (envelope.area <= maxAllowedArea) {
    return {
      rect: { ...env },
      area: envelope.area,
      coverage: (envelope.area / plotArea) * 100,
      maxAllowedArea,
      limitedBy: "setbacks",
    };
  }

  const scale = Math.sqrt(maxAllowedArea / envelope.area);
  const width = env.width * scale;
  const depth = env.depth * scale;
  const rect: Rect = {
    x: env.x + (env.width - width) / 2,
    y: env.y + env.depth - depth,
    width,
    depth,
  };
  const area = rectArea(rect);

  return {
    rect,
    area,
    coverage: (area / plotArea) * 100,
    maxAllowedArea,
    limitedBy: "coverage",
  };
}

/**
 * Splits the footprint into full-width bands across its depth: living faces
 * the street, service sits in the middle and private is at the rear.
 * Zones are returned front to rear and exactly tile the footprint.
 */
export function computeZones(footprint: Rect): Zone[] {
  const front = footprint.y + footprint.depth;
  let edge = front;
  return ZONE_SHARES.map(({ kind, share }, i) => {
    // The last band snaps to the rear edge so rounding never leaves a gap.
    const next = i === ZONE_SHARES.length - 1 ? footprint.y : edge - footprint.depth * share;
    const rect: Rect = { x: footprint.x, y: next, width: footprint.width, depth: edge - next };
    edge = next;
    return { kind, rect, area: rectArea(rect) };
  });
}

/** Runs all rules and returns either a full plan or a readable error. */
export function computePlan(rules: PlotRules): PlanResult {
  const plotArea = rules.plotWidth * rules.plotDepth;
  const envelope = computeEnvelope(rules);
  if (!envelope) {
    return { ok: false, plotArea, error: "Setbacks leave no buildable area on this plot." };
  }
  if (rules.maxCoverage <= 0) {
    return { ok: false, plotArea, error: "Max coverage must be above 0%." };
  }
  const footprint = computeFootprint(rules, envelope);
  return { ok: true, plotArea, envelope, footprint, zones: computeZones(footprint.rect) };
}
