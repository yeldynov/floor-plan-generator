import { describe, expect, it } from "vitest";
import {
  ZONE_SHARES,
  computeEnvelope,
  computeFootprint,
  computePlan,
  computeZones,
  type PlotRules,
} from "./rules";

const base: PlotRules = {
  plotWidth: 20,
  plotDepth: 30,
  frontSetback: 4,
  rearSetback: 2,
  sideSetback: 2,
  maxCoverage: 60,
};

describe("computeEnvelope", () => {
  it("subtracts setbacks from the plot", () => {
    const env = computeEnvelope(base);
    expect(env?.rect).toEqual({ x: 2, y: 2, width: 16, depth: 24 });
    expect(env?.area).toBe(384);
  });

  it("returns null when setbacks consume the plot", () => {
    expect(computeEnvelope({ ...base, sideSetback: 10 })).toBeNull();
    expect(computeEnvelope({ ...base, frontSetback: 20, rearSetback: 10 })).toBeNull();
  });
});

describe("computeFootprint", () => {
  it("uses the whole envelope when coverage allows it", () => {
    // plot 600 m², 80% => 480 m² allowed, envelope is 384 m²
    const rules = { ...base, maxCoverage: 80 };
    const fp = computeFootprint(rules, computeEnvelope(rules)!);
    expect(fp.limitedBy).toBe("setbacks");
    expect(fp.area).toBe(384);
    expect(fp.coverage).toBeCloseTo(64);
  });

  it("scales the envelope down to the coverage limit", () => {
    // 50% of 600 m² => 300 m² allowed, envelope is 384 m²
    const rules = { ...base, maxCoverage: 50 };
    const env = computeEnvelope(rules)!;
    const fp = computeFootprint(rules, env);

    expect(fp.limitedBy).toBe("coverage");
    expect(fp.area).toBeCloseTo(300);
    expect(fp.coverage).toBeCloseTo(50);
    // keeps proportions
    expect(fp.rect.width / fp.rect.depth).toBeCloseTo(env.rect.width / env.rect.depth);
    // stays inside the envelope, against the front setback line
    expect(fp.rect.x).toBeGreaterThanOrEqual(env.rect.x);
    expect(fp.rect.x + fp.rect.width).toBeLessThanOrEqual(env.rect.x + env.rect.width + 1e-9);
    expect(fp.rect.y + fp.rect.depth).toBeCloseTo(env.rect.y + env.rect.depth);
  });
});

describe("computeZones", () => {
  const footprint = { x: 2, y: 2, width: 16, depth: 24 };

  it("shares add up to the whole footprint", () => {
    expect(ZONE_SHARES.reduce((sum, z) => sum + z.share, 0)).toBeCloseTo(1);
  });

  it("orders zones from the street to the rear", () => {
    expect(computeZones(footprint).map((z) => z.kind)).toEqual(["living", "service", "private"]);
  });

  it("splits the depth by the zone shares at full width", () => {
    const [living, service, priv] = computeZones(footprint);
    expect(living.rect).toEqual({ x: 2, y: 2 + 24 * 0.6, width: 16, depth: 24 * 0.4 });
    expect(service.rect.depth).toBeCloseTo(24 * 0.25);
    expect(priv.rect.depth).toBeCloseTo(24 * 0.35);
    for (const z of [living, service, priv]) {
      expect(z.rect.x).toBe(2);
      expect(z.rect.width).toBe(16);
    }
  });

  it("tiles the footprint with no gaps or overlaps", () => {
    const zones = computeZones(footprint);
    expect(zones[0].rect.y + zones[0].rect.depth).toBeCloseTo(footprint.y + footprint.depth);
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].rect.y + zones[i].rect.depth).toBe(zones[i - 1].rect.y);
    }
    expect(zones.at(-1)!.rect.y).toBe(footprint.y);
    const total = zones.reduce((sum, z) => sum + z.area, 0);
    expect(total).toBeCloseTo(footprint.width * footprint.depth);
  });
});

describe("computePlan", () => {
  it("returns an error for impossible setbacks", () => {
    const res = computePlan({ ...base, sideSetback: 12 });
    expect(res.ok).toBe(false);
  });

  it("returns envelope and footprint for valid input", () => {
    const res = computePlan(base);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plotArea).toBe(600);
      expect(res.footprint.coverage).toBeLessThanOrEqual(60 + 1e-9);
      expect(res.zones).toHaveLength(3);
      const zoneTotal = res.zones.reduce((sum, z) => sum + z.area, 0);
      expect(zoneTotal).toBeCloseTo(res.footprint.area);
    }
  });
});
