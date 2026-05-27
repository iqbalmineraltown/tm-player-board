/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { GameState, ResourceId } from '../types';

interface TelemetryChartProps {
  history: GameState[];
}

export default function TelemetryChart({ history }: TelemetryChartProps) {
  const [activeMetric, setActiveMetric] = useState<'inventory' | 'production'>('inventory');
  const [selectedResource, setSelectedResource] = useState<ResourceId | 'all'>('all');

  const resourceConfigs: Record<ResourceId, { label: string; color: string; icon: string }> = {
    megacredits: { label: 'M_CREDITS', color: '#c3e7ff', icon: 'monetization_on' },
    steel: { label: 'STEEL_ALLOY', color: '#b4cad6', icon: 'construction' },
    titanium: { label: 'TITANIUM', color: '#9f8c89', icon: 'diamond' },
    plants: { label: 'BIO_MATTER', color: '#4ade80', icon: 'eco' },
    energy: { label: 'PWR_GRID', color: '#a855f7', icon: 'bolt' },
    heat: { label: 'THERMAL', color: '#dc2626', icon: 'local_fire_department' },
  };

  // Safe Fallback if not enough generation historical data
  if (history.length === 0) {
    return (
      <div className="recessed-screen p-8 text-center text-outline-variant font-mono">
        NO RESOLVING TELEMETRY CHANNELS.
        <p className="text-xs text-slate-500 mt-2">Advance generations to plot telemetry sweeps.</p>
      </div>
    );
  }

  // Group data points
  const points = history.map((state) => ({
    gen: state.generation,
    megacredits: activeMetric === 'inventory' ? state.resources.megacredits.inventory : state.resources.megacredits.production,
    steel: activeMetric === 'inventory' ? state.resources.steel.inventory : state.resources.steel.production,
    titanium: activeMetric === 'inventory' ? state.resources.titanium.inventory : state.resources.titanium.production,
    plants: activeMetric === 'inventory' ? state.resources.plants.inventory : state.resources.plants.production,
    energy: activeMetric === 'inventory' ? state.resources.energy.inventory : state.resources.energy.production,
    heat: activeMetric === 'inventory' ? state.resources.heat.inventory : state.resources.heat.production,
  }));

  // Identify bounds
  const keys = selectedResource === 'all' ? (Object.keys(resourceConfigs) as ResourceId[]) : [selectedResource];
  const allValues = points.flatMap((p) => keys.map((k) => p[k]));
  const maxVal = Math.max(10, ...allValues) * 1.15; // 15% safety margin
  const minVal = Math.min(0, ...allValues);

  // SVG parameters
  const width = 600;
  const height = 280;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingBottom = 40;
  const paddingTop = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Coordinate conversion helper
  const getCoords = (index: number, val: number) => {
    const totalPoints = points.length;
    const x = totalPoints > 1 
      ? paddingLeft + (index / (totalPoints - 1)) * chartWidth 
      : paddingLeft + chartWidth / 2;
    const range = maxVal - minVal;
    const y = paddingTop + chartHeight - ((val - minVal) / (range || 1)) * chartHeight;
    return { x, y };
  };

  // Generate grid lines
  const gridLinesY = [];
  const yDivision = 4;
  for (let i = 0; i <= yDivision; i++) {
    const value = minVal + (i / yDivision) * (maxVal - minVal);
    gridLinesY.push(value);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Upper Control Bar */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-outline-variant pb-3">
        <div className="flex bg-surface-container-highest border border-outline-industrial overflow-hidden rounded-sm">
          <button
            onClick={() => setActiveMetric('inventory')}
            className={`px-3 py-1.5 font-label-caps text-xs transition-colors ${
              activeMetric === 'inventory'
                ? 'bg-primary text-on-primary font-bold'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            INVENTORY
          </button>
          <button
            onClick={() => setActiveMetric('production')}
            className={`px-3 py-1.5 font-label-caps text-xs transition-colors ${
              activeMetric === 'production'
                ? 'bg-primary text-on-primary font-bold'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            PRODUCTION
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedResource('all')}
            className={`px-2 py-1 text-xs border rounded-sm font-mono tracking-wider transition-colors ${
              selectedResource === 'all'
                ? 'bg-outline-variant border-primary text-primary font-bold'
                : 'bg-surface-container-low border-outline-industrial text-on-surface-variant hover:border-outline hover:text-on-surface'
            }`}
          >
            ALL
          </button>
          {(Object.keys(resourceConfigs) as ResourceId[]).map((rKey) => {
            const config = resourceConfigs[rKey];
            const isSelected = selectedResource === rKey;
            return (
              <button
                key={rKey}
                onClick={() => setSelectedResource(rKey)}
                className="px-2 py-1 text-xs border rounded-sm font-mono flex items-center gap-1 transition-colors"
                style={{
                  backgroundColor: isSelected ? `${config.color}22` : '#201a19',
                  borderColor: isSelected ? config.color : '#5a413b',
                  color: isSelected ? '#ffffff' : config.color,
                }}
              >
                <span className="material-symbols-outlined text-[12px]">{config.icon}</span>
                {config.label.split('_')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chart Canvas Screen */}
      <div className="recessed-screen p-2 md:p-4 w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none min-w-[500px]">
          {/* Y-axis grid lines and labels */}
          {gridLinesY.map((val, idx) => {
            const range = maxVal - minVal;
            const y = paddingTop + chartHeight - ((val - minVal) / (range || 1)) * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#5d4c49"
                  strokeOpacity="0.15"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="#9f8c89"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  textAnchor="end"
                >
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* X Axis & Labels (Generations) */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={width - paddingRight}
            y2={paddingTop + chartHeight}
            stroke="#5a413b"
            strokeWidth="1.5"
          />

          {points.map((p, idx) => {
            const coords = getCoords(idx, minVal);
            return (
              <g key={idx}>
                <line
                  x1={coords.x}
                  y1={paddingTop}
                  x2={coords.x}
                  y2={paddingTop + chartHeight}
                  stroke="#5d4c49"
                  strokeOpacity="0.08"
                  strokeDasharray="2 2"
                />
                <text
                  x={coords.x}
                  y={paddingTop + chartHeight + 16}
                  fill="#d7c2be"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                >
                  G{p.gen}
                </text>
              </g>
            );
          })}

          {/* Curves */}
          {keys.map((k) => {
            const config = resourceConfigs[k];
            const dPath = points
              .map((p, idx) => {
                const { x, y } = getCoords(idx, p[k]);
                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
              })
              .join(' ');

            // Shaded Area under path (only if a single resource is active)
            let areaPath = '';
            if (keys.length === 1 && points.length > 0) {
              const firstCoords = getCoords(0, points[0][k]);
              const lastCoords = getCoords(points.length - 1, points[points.length - 1][k]);
              const bottomY = paddingTop + chartHeight;
              areaPath = `${dPath} L ${lastCoords.x} ${bottomY} L ${firstCoords.x} ${bottomY} Z`;
            }

            return (
              <g key={k}>
                {areaPath && (
                  <path
                    d={areaPath}
                    fill={config.color}
                    fillOpacity="0.06"
                  />
                )}
                {/* Curve line */}
                <path
                  d={dPath}
                  fill="none"
                  stroke={config.color}
                  strokeWidth={selectedResource === 'all' ? '1.5' : '2.5'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={selectedResource !== 'all' ? 'drop-shadow(0px 0px 4px rgba(255,255,255,0.1))' : undefined}
                />
                {/* Data point indicators */}
                {points.map((p, idx) => {
                  const { x, y } = getCoords(idx, p[k]);
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r={selectedResource === 'all' ? '2.5' : '4'}
                      fill="#0b0706"
                      stroke={config.color}
                      strokeWidth="1.5"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {keys.map((k) => {
          const config = resourceConfigs[k];
          const lastPoint = points[points.length - 1];
          const val = lastPoint ? lastPoint[k] : 0;
          return (
            <div
              key={k}
              className="bg-surface-container-low border border-outline-variant p-2 flex flex-col items-center text-center justify-center rounded-sm"
              style={{ borderLeft: `3px solid ${config.color}` }}
            >
              <span className="font-label-caps text-[9px] text-on-surface-variant tracking-wider truncate w-full">
                {config.label}
              </span>
              <span className="font-data-display text-base font-bold mt-1" style={{ color: config.color }}>
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
