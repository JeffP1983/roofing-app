import React from 'react';

const PITCHES = [
  { n: 4,  label: '4/12', desc: 'Low' },
  { n: 6,  label: '6/12', desc: 'Standard' },
  { n: 8,  label: '8/12', desc: 'Moderate' },
  { n: 10, label: '10/12', desc: 'Steep' },
  { n: 12, label: '12/12', desc: 'Very Steep' },
];

function PitchDiagram({ numerator, selected, onClick }) {
  const run = 48;
  const rise = Math.round((run * numerator) / 12);
  const W = 80, H = 60;
  const baseY = H - 10;
  const peakX = run;
  const peakY = baseY - rise;
  const clampedPeakY = Math.max(10, peakY);
  const scaledRise = baseY - clampedPeakY;
  const scaledRun = run;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '10px 8px',
        border: `2px solid ${selected ? '#2d6a9f' : '#ddd'}`,
        borderRadius: 8,
        background: selected ? '#e8f0fe' : '#fff',
        cursor: 'pointer',
        minWidth: 70,
        transition: 'all 0.15s',
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Ground line */}
        <line x1={10} y1={baseY} x2={W - 10} y2={baseY} stroke="#ccc" strokeWidth={1} />
        {/* Roof slope */}
        <polyline
          points={`${10},${baseY} ${10 + scaledRun},${baseY} ${10 + scaledRun},${baseY - scaledRise}`}
          fill="none" stroke="#999" strokeWidth={1} strokeDasharray="3,2"
        />
        {/* Filled slope triangle */}
        <polygon
          points={`${10},${baseY} ${10 + scaledRun},${baseY} ${10 + scaledRun},${baseY - scaledRise}`}
          fill={selected ? '#c3d4f0' : '#f0f0f0'}
          stroke={selected ? '#2d6a9f' : '#bbb'}
          strokeWidth={1.5}
        />
        {/* Rise label */}
        <text x={10 + scaledRun + 4} y={baseY - scaledRise / 2} fontSize={9} fill="#666">
          {numerator}"
        </text>
        {/* Run label */}
        <text x={10 + scaledRun / 2 - 4} y={baseY + 10} fontSize={9} fill="#666">12"</text>
      </svg>
      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: selected ? '#2d6a9f' : '#333' }}>
        {numerator}/12
      </span>
    </button>
  );
}

export default function PitchGuide({ value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>
        Select the pitch closest to your roof. If unsure, 6/12 is the most common.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PITCHES.map(({ n }) => (
          <PitchDiagram
            key={n}
            numerator={n}
            selected={value === n}
            onClick={() => onChange(n)}
          />
        ))}
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Other pitch:
        </label>
        <select
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd', fontSize: '0.9rem' }}
        >
          {[2,3,4,5,6,7,8,9,10,11,12].map((n) => (
            <option key={n} value={n}>{n}/12</option>
          ))}
        </select>
      </div>
    </div>
  );
}
