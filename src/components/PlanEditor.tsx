"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { computePlan, type PlotRules } from "@/lib/rules";
import { defaultRules, plotRulesSchema } from "@/lib/schema";

// Konva needs the browser canvas API, so skip server rendering for it.
const PlanCanvas = dynamic(() => import("./PlanCanvas"), { ssr: false });

type FieldKey = keyof PlotRules;

const FIELDS: { key: FieldKey; label: string; unit: string; step: number }[] = [
  { key: "plotWidth", label: "Plot width", unit: "m", step: 0.5 },
  { key: "plotDepth", label: "Plot depth", unit: "m", step: 0.5 },
  { key: "frontSetback", label: "Front setback", unit: "m", step: 0.5 },
  { key: "rearSetback", label: "Rear setback", unit: "m", step: 0.5 },
  { key: "sideSetback", label: "Side setbacks", unit: "m", step: 0.5 },
  { key: "maxCoverage", label: "Max coverage", unit: "%", step: 1 },
];

type Draft = Record<FieldKey, string>;

const parseDraft = (draft: Draft) =>
  plotRulesSchema.safeParse(
    Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, v.trim() === "" ? NaN : Number(v)]),
    ),
  );

const toDraft = (rules: PlotRules): Draft =>
  Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])) as Draft;

export default function PlanEditor() {
  const [draft, setDraft] = useState<Draft>(() => toDraft(defaultRules));
  // Last valid rules, so the drawing stays put while a field is mid-edit.
  const [rules, setRules] = useState<PlotRules>(defaultRules);

  const parsed = useMemo(() => parseDraft(draft), [draft]);

  const fieldErrors: Partial<Record<FieldKey, string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as FieldKey;
      fieldErrors[key] ??= issue.message;
    }
  }

  const onChange = (key: FieldKey, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    const result = parseDraft(next);
    if (result.success) setRules(result.data);
  };

  const plan = useMemo(() => computePlan(rules), [rules]);

  return (
    <div className="flex flex-1 flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 space-y-6 lg:w-80">
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          {FIELDS.map(({ key, label, unit, step }) => (
            <label key={key} className="block">
              <span className="text-sm font-medium text-zinc-700">{label}</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={step}
                  value={draft[key]}
                  onChange={(e) => onChange(key, e.target.value)}
                  aria-invalid={!!fieldErrors[key]}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 aria-[invalid=true]:border-red-500"
                />
                <span className="w-4 text-sm text-zinc-500">{unit}</span>
              </div>
              {fieldErrors[key] && (
                <span className="mt-1 block text-xs text-red-600">{fieldErrors[key]}</span>
              )}
            </label>
          ))}
        </form>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold text-zinc-900">Results</h2>
          {plan.ok ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-zinc-700">
              <dt>Plot area</dt>
              <dd className="text-right tabular-nums">{plan.plotArea.toFixed(1)} m²</dd>
              <dt>Buildable envelope</dt>
              <dd className="text-right tabular-nums">{plan.envelope.area.toFixed(1)} m²</dd>
              <dt>Coverage limit</dt>
              <dd className="text-right tabular-nums">
                {plan.footprint.maxAllowedArea.toFixed(1)} m²
              </dd>
              <dt className="font-medium text-zinc-900">Footprint</dt>
              <dd className="text-right font-medium tabular-nums text-zinc-900">
                {plan.footprint.area.toFixed(1)} m² ({plan.footprint.coverage.toFixed(1)}%)
              </dd>
              <dt>Limited by</dt>
              <dd className="text-right">{plan.footprint.limitedBy}</dd>
            </dl>
          ) : (
            <p className="text-red-600">{plan.error}</p>
          )}
        </section>
      </aside>

      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <PlanCanvas rules={rules} plan={plan} />
      </div>
    </div>
  );
}
