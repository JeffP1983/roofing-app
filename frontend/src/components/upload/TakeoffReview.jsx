import React, { useState, useEffect, useCallback } from 'react';

const SLOPE_FACTORS = {
  2:1.014, 3:1.031, 4:1.054, 5:1.083, 6:1.118,
  7:1.158, 8:1.202, 9:1.250, 10:1.302, 11:1.357, 12:1.414,
};
function getSlopeFactor(p) { return SLOPE_FACTORS[parseInt(p, 10)] ?? SLOPE_FACTORS[6]; }
function round2(n) { return Math.round(n * 100) / 100; }

function derivePitchBreakdown(planes) {
  const map = {};
  planes.forEach((p) => {
    const pitch = parseInt(p.pitch_numerator, 10) || 6;
    const horizArea = parseFloat(p.horizontal_area) ||
      ((parseFloat(p.horizontal_length) || 0) * (parseFloat(p.horizontal_width) || 0));
    const actualSqFt = horizArea * getSlopeFactor(pitch);
    map[pitch] = (map[pitch] || 0) + actualSqFt;
  });
  return Object.entries(map)
    .map(([pitch, areaSqFt]) => ({ pitch: parseInt(pitch, 10), areaSqFt: round2(areaSqFt) }))
    .sort((a, b) => a.pitch - b.pitch);
}

function deriveComplexity(planes, lf) {
  const pitchCount = new Set(planes.map((p) => parseInt(p.pitch_numerator, 10) || 6)).size;
  const facets = planes.length;
  const hasValley = (parseFloat(lf.valley_lf) || 0) > 0;
  const hasHip = (parseFloat(lf.hip_lf) || 0) > 0;
  if (pitchCount === 1 && facets <= 4 && !hasValley && !hasHip) return 'simple';
  if (pitchCount >= 4 || facets >= 10 || (hasValley && hasHip && facets >= 6)) return 'complex';
  return 'normal';
}

function synthPlanes(breakdown) {
  return breakdown.map(({ pitch, areaSqFt }) => ({
    plane_label: `${pitch}/12 pitch`,
    horizontal_area: round2(areaSqFt / getSlopeFactor(pitch)),
    pitch_numerator: pitch,
  }));
}

const COMPLEXITY_COLORS = {
  simple:  { bg: '#d4edda', color: '#155724', border: '#28a745' },
  normal:  { bg: '#fff3cd', color: '#856404', border: '#ffc107' },
  complex: { bg: '#f8d7da', color: '#721c24', border: '#dc3545' },
};

const LF_ROWS = [
  { key: 'ridge_lf',  label: 'Ridges'  },
  { key: 'hip_lf',    label: 'Hips'    },
  { key: 'valley_lf', label: 'Valleys' },
  { key: 'rake_lf',   label: 'Rakes'   },
  { key: 'eave_lf',   label: 'Eaves'   },
];

export default function TakeoffReview({
  planes,
  linearFootage,
  onPlanesChange,
  onLFChange,
  onFacetCountChange,
  onComplexityChange,
  isAssisted,
}) {
  const [breakdown, setBreakdown] = useState(() => derivePitchBreakdown(planes));
  const [lf, setLf]               = useState(linearFootage);
  const [facets, setFacets]       = useState(Math.max(planes.length, 1));
  const [complexity, setComplexity] = useState(() => deriveComplexity(planes, linearFootage));

  const [editingIdx, setEditingIdx]   = useState(null);
  const [editVal, setEditVal]         = useState('');
  const [addingPitch, setAddingPitch] = useState(false);
  const [newPitch, setNewPitch]       = useState(6);
  const [newArea, setNewArea]         = useState('');

  const totalSqFt = breakdown.reduce((s, e) => s + e.areaSqFt, 0);
  const totalSQ   = totalSqFt / 100;
  const dripEdge  = (parseFloat(lf.eave_lf) || 0) + (parseFloat(lf.rake_lf) || 0);
  const hasLowPitch = breakdown.some((e) => e.pitch < 3);

  const syncBreakdown = useCallback((next) => {
    setBreakdown(next);
    onPlanesChange(synthPlanes(next));
  }, [onPlanesChange]);

  const syncLf = useCallback((next) => {
    setLf(next);
    onLFChange(next);
  }, [onLFChange]);

  const syncComplexity = useCallback((val) => {
    setComplexity(val);
    if (onComplexityChange) onComplexityChange(val);
  }, [onComplexityChange]);

  const syncFacets = useCallback((val) => {
    setFacets(val);
    if (onFacetCountChange) onFacetCountChange(val);
  }, [onFacetCountChange]);

  // Push derived values to parent on mount
  useEffect(() => {
    onPlanesChange(synthPlanes(breakdown));
    onLFChange(lf);
    if (onFacetCountChange) onFacetCountChange(facets);
    if (onComplexityChange) onComplexityChange(complexity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(i) { setEditingIdx(i); setEditVal(String(breakdown[i].areaSqFt)); }

  function saveEdit(i) {
    const area = parseFloat(editVal);
    if (!isNaN(area) && area > 0) {
      const next = [...breakdown];
      next[i] = { ...next[i], areaSqFt: round2(area) };
      syncBreakdown(next);
    }
    setEditingIdx(null);
  }

  function removePitch(i) { syncBreakdown(breakdown.filter((_, idx) => idx !== i)); }

  function addPitch() {
    const area = parseFloat(newArea);
    if (isNaN(area) || area <= 0) return;
    const exists = breakdown.findIndex((e) => e.pitch === newPitch);
    let next;
    if (exists >= 0) {
      next = [...breakdown];
      next[exists] = { pitch: newPitch, areaSqFt: round2(next[exists].areaSqFt + area) };
    } else {
      next = [...breakdown, { pitch: newPitch, areaSqFt: round2(area) }]
        .sort((a, b) => a.pitch - b.pitch);
    }
    syncBreakdown(next);
    setAddingPitch(false);
    setNewArea('');
  }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {isAssisted && (
        <div style={assistedBanner}>
          <strong>Assisted Estimate</strong> — Dimensions derived from floor plan. Verify all values before confirming.
        </div>
      )}

      {/* ── Header stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>

        <div style={statBox}>
          <div style={statLabel}>Total Roof Area</div>
          <div style={statVal}>{Math.round(totalSqFt).toLocaleString()} sq ft</div>
          <div style={statSub}>{totalSQ.toFixed(2)} squares</div>
        </div>

        <div style={statBox}>
          <div style={statLabel}>Total Facets</div>
          <input
            type="number" min="1" value={facets}
            onChange={(e) => syncFacets(parseInt(e.target.value, 10) || 1)}
            style={facetInput}
          />
          <div style={statSub}>roof planes</div>
        </div>

        <div style={statBox}>
          <div style={statLabel}>Structure Complexity</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
            {['simple', 'normal', 'complex'].map((opt) => {
              const c = COMPLEXITY_COLORS[opt];
              const sel = complexity === opt;
              return (
                <button key={opt} type="button" onClick={() => syncComplexity(opt)} style={{
                  padding: '3px 8px', borderRadius: 10, cursor: 'pointer', fontSize: '0.75rem',
                  fontWeight: sel ? 700 : 400, textTransform: 'capitalize', transition: 'all 0.1s',
                  border: `1.5px solid ${sel ? c.border : '#ddd'}`,
                  background: sel ? c.bg : '#fff',
                  color: sel ? c.color : '#888',
                }}>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Pitch breakdown ── */}
      <SectionTitle>Pitch Breakdown</SectionTitle>

      {hasLowPitch && (
        <div style={{ background: '#e8f4fd', border: '1px solid #bee3f8', borderRadius: 5, padding: '6px 12px', fontSize: '0.82rem', color: '#1a5276', marginBottom: 10 }}>
          Pitches &lt;3/12 will have underlayment doubled.
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: 8 }}>
        <thead>
          <tr style={{ background: '#f0f3f8' }}>
            <th style={th}>Pitch</th>
            <th style={{ ...th, textAlign: 'right' }}>Area (sq ft)</th>
            <th style={{ ...th, textAlign: 'right' }}>% of Total</th>
            <th style={{ ...th, width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((entry, i) => {
            const pct = totalSqFt > 0 ? (entry.areaSqFt / totalSqFt) * 100 : 0;
            return (
              <tr key={entry.pitch} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ ...td, fontWeight: 600 }}>{entry.pitch}/12</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {editingIdx === i ? (
                    <input
                      type="number" min="1" step="1" autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onBlur={() => saveEdit(i)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(i); if (e.key === 'Escape') setEditingIdx(null); }}
                      style={editInput}
                    />
                  ) : (
                    <span style={editableCell} onClick={() => startEdit(i)}>
                      {Math.round(entry.areaSqFt).toLocaleString()}
                    </span>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'right', color: '#888' }}>{pct.toFixed(1)}%</td>
                <td style={td}>
                  <button type="button" onClick={() => removePitch(i)}
                    style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
          <tr style={{ borderTop: '2px solid #dde3ec', fontWeight: 700, background: '#fafbfd' }}>
            <td style={td}>Total</td>
            <td style={{ ...td, textAlign: 'right' }}>{Math.round(totalSqFt).toLocaleString()}</td>
            <td style={{ ...td, textAlign: 'right', color: '#888' }}>100%</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {addingPitch ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={newPitch} onChange={(e) => setNewPitch(parseInt(e.target.value, 10))}
            style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.875rem' }}>
            {[2,3,4,5,6,7,8,9,10,11,12].map((n) => <option key={n} value={n}>{n}/12</option>)}
          </select>
          <input type="number" min="1" placeholder="Area (sq ft)" value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addPitch(); }}
            style={{ width: 130, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.875rem' }} />
          <button type="button" onClick={addPitch}
            style={{ padding: '4px 12px', background: '#2d6a9f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>
            Add
          </button>
          <button type="button" onClick={() => { setAddingPitch(false); setNewArea(''); }}
            style={{ padding: '4px 10px', background: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAddingPitch(true)}
          style={{ padding: '4px 14px', border: '1px dashed #2d6a9f', background: 'none', color: '#2d6a9f', borderRadius: 5, cursor: 'pointer', fontSize: '0.82rem', marginBottom: 20 }}>
          + Add Pitch
        </button>
      )}

      {/* ── Linear footage ── */}
      <SectionTitle>Linear Footage</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: 4 }}>
        <tbody>
          {LF_ROWS.map(({ key, label }) => (
            <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ ...td, width: 110, fontWeight: 600, color: '#444' }}>{label}</td>
              <td style={td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" min="0" step="0.5"
                    value={lf[key] ?? 0}
                    onChange={(e) => syncLf({ ...lf, [key]: parseFloat(e.target.value) || 0 })}
                    style={{ width: 90, padding: '4px 8px', border: '1.5px solid #ddd', borderRadius: 4, fontSize: '0.875rem' }}
                  />
                  <span style={{ color: '#888', fontSize: '0.82rem' }}>LF</span>
                </div>
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #dde3ec', background: '#f8f9fb' }}>
            <td style={{ ...td, fontWeight: 600, color: '#444' }}>
              Drip Edge
              <span style={{ fontWeight: 400, color: '#888', fontSize: '0.75rem', marginLeft: 6 }}>(Eaves + Rakes)</span>
            </td>
            <td style={td}>
              <span style={{ fontWeight: 700, color: '#1a3a5c', fontSize: '0.95rem' }}>
                {Math.round(dripEdge).toLocaleString()} LF
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h3 style={{
      fontSize: '0.82rem', fontWeight: 700, color: '#1a3a5c', margin: '0 0 10px',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      borderBottom: '2px solid #dde3ec', paddingBottom: 6,
    }}>
      {children}
    </h3>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const assistedBanner = {
  background: '#fff8e1', border: '1px solid #f5c542', borderRadius: 6,
  padding: '10px 14px', marginBottom: 16, fontSize: '0.875rem', color: '#7a5c00',
};
const statBox   = { background: '#f5f7fa', borderRadius: 8, padding: '12px 16px' };
const statLabel = { fontSize: '0.72rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };
const statVal   = { fontWeight: 700, fontSize: '1.05rem', color: '#1a3a5c' };
const statSub   = { fontSize: '0.78rem', color: '#888', marginTop: 2 };
const facetInput = { width: 60, padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginTop: 4 };
const th = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '0.8rem' };
const td = { padding: '8px 12px', verticalAlign: 'middle' };
const editInput = { width: 90, padding: '2px 6px', border: '1.5px solid #2d6a9f', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' };
const editableCell = { cursor: 'pointer', borderBottom: '1px dashed #aaa', paddingBottom: 1 };
