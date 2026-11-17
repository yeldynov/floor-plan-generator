"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Line, Rect, Stage, Text } from "react-konva";
import type { PlanResult, PlotRules, Rect as PlanRect } from "@/lib/rules";
import { ZONE_STYLE } from "./zoneStyle";

interface Props {
  rules: PlotRules;
  plan: PlanResult;
}

const PADDING = 72; // px around the plot for dimension lines
const ZOOM = { min: 0.5, max: 8, step: 1.1 };
const HOME_VIEW = { zoom: 1, x: 0, y: 0 };
const MIN_LABEL_PX = { width: 56, height: 30 }; // hide zone labels in smaller bands

const COLORS = {
  plot: "#f4f4f5",
  plotStroke: "#52525b",
  envelope: "#2563eb",
  footprintStroke: "#1d4ed8",
  label: "#3f3f46",
  street: "#a1a1aa",
};

/** Metres, trimmed to at most 2 decimals: 1.5 -> "1.5 m", 13.4164 -> "13.42 m". */
const fmt = (m: number) => `${+m.toFixed(2)} m`;

/**
 * Horizontal or vertical dimension line with end ticks and a centred label.
 * Text sits above (horizontal) or left of the line, or right with `textRight`.
 * Zero-length segments draw nothing; labels that don't fit are hidden.
 */
function Dim({
  x1,
  y1,
  x2,
  y2,
  label,
  textRight = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  textRight?: boolean;
}) {
  const vertical = x1 === x2;
  const len = vertical ? y2 - y1 : x2 - x1;
  if (len < 1) return null;
  const t = 4; // tick half-length, px
  const ticks = vertical
    ? [x1 - t, y1, x1 + t, y1, x2 - t, y2, x2 + t, y2]
    : [x1, y1 - t, x1, y1 + t, x2, y2 - t, x2, y2 + t];
  const fits = len >= label.length * 6.5;
  return (
    <>
      <Line points={[x1, y1, x2, y2]} stroke={COLORS.label} strokeWidth={1} />
      <Line points={ticks.slice(0, 4)} stroke={COLORS.label} strokeWidth={1} />
      <Line points={ticks.slice(4)} stroke={COLORS.label} strokeWidth={1} />
      {fits &&
        (vertical ? (
          <Text
            x={textRight ? x1 + 5 : x1 - 17}
            y={y2}
            width={len}
            align="center"
            rotation={-90}
            text={label}
            fontSize={11}
            fill={COLORS.label}
          />
        ) : (
          <Text
            x={x1}
            y={y1 - 15}
            width={len}
            align="center"
            text={label}
            fontSize={11}
            fill={COLORS.label}
          />
        ))}
    </>
  );
}

export default function PlanCanvas({ rules, plan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Pan/zoom applied on top of the fit-to-container layout below.
  const [view, setView] = useState(HOME_VIEW);

  // Zoom in/out around the pointer, so the point under the cursor stays put.
  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    setView((v) => {
      const factor = e.evt.deltaY < 0 ? ZOOM.step : 1 / ZOOM.step;
      const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, v.zoom * factor));
      const k = zoom / v.zoom;
      return { zoom, x: pointer.x - (pointer.x - v.x) * k, y: pointer.y - (pointer.y - v.y) * k };
    });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { plotWidth, plotDepth } = rules;
  const scale =
    size.width > 0
      ? Math.min((size.width - PADDING * 2) / plotWidth, (size.height - PADDING * 2) / plotDepth)
      : 0;
  const plotPx = { w: plotWidth * scale, h: plotDepth * scale };
  const origin = { x: (size.width - plotPx.w) / 2, y: (size.height - plotPx.h) / 2 };

  const toPx = (r: PlanRect) => ({
    x: origin.x + r.x * scale,
    y: origin.y + r.y * scale,
    width: r.width * scale,
    height: r.depth * scale,
  });

  return (
    <div ref={containerRef} className="h-full w-full">
      {scale > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.zoom}
          scaleY={view.zoom}
          draggable
          onWheel={onWheel}
          onDragEnd={(e) => {
            // Only the stage itself is draggable; ignore bubbled child events.
            if (e.target === e.target.getStage()) {
              setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
            }
          }}
          onDblClick={() => setView(HOME_VIEW)}
          onDblTap={() => setView(HOME_VIEW)}
          className="cursor-grab active:cursor-grabbing"
        >
          <Layer>
            {/* Plot */}
            <Rect
              x={origin.x}
              y={origin.y}
              width={plotPx.w}
              height={plotPx.h}
              fill={COLORS.plot}
              stroke={COLORS.plotStroke}
              strokeWidth={2}
            />

            {plan.ok && (
              <>
                {/* Buildable envelope (setback lines) */}
                <Rect
                  {...toPx(plan.envelope.rect)}
                  stroke={COLORS.envelope}
                  strokeWidth={1.5}
                  dash={[8, 6]}
                />
                {/* Zones inside the footprint */}
                {plan.zones.map((zone) => {
                  const px = toPx(zone.rect);
                  const style = ZONE_STYLE[zone.kind];
                  const showLabel =
                    px.width >= MIN_LABEL_PX.width && px.height >= MIN_LABEL_PX.height;
                  return (
                    <Fragment key={zone.kind}>
                      <Rect
                        {...px}
                        fill={style.fill}
                        stroke={COLORS.footprintStroke}
                        strokeWidth={0.75}
                      />
                      {showLabel && (
                        <Text
                          {...px}
                          text={`${style.label}\n${zone.area.toFixed(1)} m²`}
                          align="center"
                          verticalAlign="middle"
                          fontSize={12}
                          lineHeight={1.3}
                          fill={style.text}
                        />
                      )}
                    </Fragment>
                  );
                })}
                {/* Building footprint outline */}
                <Rect
                  {...toPx(plan.footprint.rect)}
                  stroke={COLORS.footprintStroke}
                  strokeWidth={2}
                />
              </>
            )}

            {/* Overall plot dimensions */}
            <Dim
              x1={origin.x}
              y1={origin.y - 44}
              x2={origin.x + plotPx.w}
              y2={origin.y - 44}
              label={fmt(plotWidth)}
            />
            <Dim
              x1={origin.x - 20}
              y1={origin.y}
              x2={origin.x - 20}
              y2={origin.y + plotPx.h}
              label={fmt(plotDepth)}
            />

            {/* Chains: side setback | footprint width | side setback (top),
                rear setback | footprint depth | front setback (right) */}
            {plan.ok &&
              (() => {
                const fp = plan.footprint.rect;
                const across: [number, number][] = [
                  [0, rules.sideSetback],
                  [fp.x, fp.x + fp.width],
                  [plotWidth - rules.sideSetback, plotWidth],
                ];
                const along: [number, number][] = [
                  [0, rules.rearSetback],
                  [fp.y, fp.y + fp.depth],
                  [plotDepth - rules.frontSetback, plotDepth],
                ];
                const top = origin.y - 20;
                const right = origin.x + plotPx.w + 20;
                return (
                  <>
                    {across.map(([a, b], i) => (
                      <Dim
                        key={`w${i}`}
                        x1={origin.x + a * scale}
                        y1={top}
                        x2={origin.x + b * scale}
                        y2={top}
                        label={fmt(b - a)}
                      />
                    ))}
                    {along.map(([a, b], i) => (
                      <Dim
                        key={`d${i}`}
                        x1={right}
                        y1={origin.y + a * scale}
                        x2={right}
                        y2={origin.y + b * scale}
                        label={fmt(b - a)}
                        textRight
                      />
                    ))}
                  </>
                );
              })()}

            {/* Street */}
            <Text
              x={origin.x}
              y={origin.y + plotPx.h + 16}
              width={plotPx.w}
              align="center"
              text="STREET"
              letterSpacing={4}
              fontSize={11}
              fill={COLORS.street}
            />
          </Layer>
        </Stage>
      )}
      {view !== HOME_VIEW && (
        <button
          type="button"
          onClick={() => setView(HOME_VIEW)}
          className="absolute right-3 top-3 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Reset view
        </button>
      )}
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-zinc-400">
        Drag to pan · scroll to zoom · double-click to reset
      </p>
    </div>
  );
}
