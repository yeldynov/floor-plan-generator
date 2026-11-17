"use client";

import { useEffect, useRef, useState } from "react";
import { Layer, Line, Rect, Stage, Text } from "react-konva";
import type { PlanResult, PlotRules, Rect as PlanRect } from "@/lib/rules";

interface Props {
  rules: PlotRules;
  plan: PlanResult;
}

const PADDING = 56; // px around the plot for labels

const COLORS = {
  plot: "#f4f4f5",
  plotStroke: "#52525b",
  envelope: "#2563eb",
  footprint: "rgba(37, 99, 235, 0.22)",
  footprintStroke: "#1d4ed8",
  label: "#3f3f46",
  street: "#a1a1aa",
};

export default function PlanCanvas({ rules, plan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

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
        <Stage width={size.width} height={size.height}>
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
                {/* Building footprint */}
                <Rect
                  {...toPx(plan.footprint.rect)}
                  fill={COLORS.footprint}
                  stroke={COLORS.footprintStroke}
                  strokeWidth={2}
                />
                <Text
                  {...toPx(plan.footprint.rect)}
                  text={`Footprint\n${plan.footprint.area.toFixed(1)} m²`}
                  align="center"
                  verticalAlign="middle"
                  fontSize={13}
                  fill={COLORS.footprintStroke}
                />
              </>
            )}

            {/* Width dimension (top) */}
            <Line
              points={[origin.x, origin.y - 20, origin.x + plotPx.w, origin.y - 20]}
              stroke={COLORS.label}
              strokeWidth={1}
            />
            <Text
              x={origin.x}
              y={origin.y - 38}
              width={plotPx.w}
              align="center"
              text={`${plotWidth} m`}
              fontSize={12}
              fill={COLORS.label}
            />

            {/* Depth dimension (left) */}
            <Line
              points={[origin.x - 20, origin.y, origin.x - 20, origin.y + plotPx.h]}
              stroke={COLORS.label}
              strokeWidth={1}
            />
            <Text
              x={origin.x - 38}
              y={origin.y + plotPx.h}
              width={plotPx.h}
              align="center"
              rotation={-90}
              text={`${plotDepth} m`}
              fontSize={12}
              fill={COLORS.label}
            />

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
    </div>
  );
}
