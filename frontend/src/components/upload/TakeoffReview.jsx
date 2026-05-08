import React from 'react';

const SLOPE_FACTORS = {
  2:1.014, 3:1.031, 4:1.054, 5:1.083, 6:1.118,
  7:1.158, 8:1.202, 9:1.250, 10:1.302, 11:1.357, 12:1.414,
};

function getSlopeFactor(p) { return SLOPE_FACTORS[p] ?? SLOPE_FACTORS[6]; }

function PlaneRow({ plane, index, onChange, onRemove }) {
  const horizArea = plane.horizontal_area != null
    ? parseFloat(plane.horizontal_area)
    : (parseFloat(plane.horizontal_length) || 0) * (parseFloat(plane.horizontal_width) || 0);
  const sf   = getSlopeFactor(parseInt(plane.pitch_numerator, 10) || 6);
  const actualSq = (horizArea * sf) / 100;

  function set(field, val) { onChange(index, { ...plane, [field]: val }); }

  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={td}>
        <input
          style={inputSm}
          value={plane.plane_label || ''}
          onChange={(e) => set('plane_label', e.target.value)}
        />
      </td>
      <td style={td}>
        <input
          style={inputSm}
          type="number" min="0" step="0.1"
          value={plane.horizontal_length ?? ''}
          onChange={(e) => set('horizontal_length', e.target.value)}
          placeholder="ft"
        />
      </td>
      <td style={td}>
        <input
          style={inputSm}
          type="number" min="0" step="0.1"
          value={plane.horizontal_width ?? ''}
          onChange={(e) => set('horizontal_width', e.target.value)}
          placeholder="ft"
        />
      </td>
      {/* If plane has pre-set area (hip/triangle planes) show it read-only */}
      {plane.horizontal_area != null && !plane.horizontal_length ? (
        <td style={{ ...td, color: '#555', fontSize: '0.85rem' }}>
          {horizArea.toFixed(1)} sf
          <span style={{ color: '#aaa', marginLeft: 4, fontSize: '0.75rem' }}>(fixed)</span>
        </td>
      ) : (
        <td style={{ ...td, color: '#555', fontSize: '0.85rem' }}>
          {horizArea > 0 ? `${horizArea.toFixed(0)} sf` : '—'}
        </td>
      )}
      <td style={td}>
        <select
          style={{ ...inputSm, paddingRight: 4 }}
          value={plane.pitch_numerator ?? 6}
          onChange={(e) => set('pitch_numerator', parseInt(e.target.value, 10))}
        >
          {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
            <option key={n} value={n}>{n}/12</option>
          ))}
        </select>
      </td>
      <td style={{ ...td, color: '#1a3a5c', fontWeight: 600 }}>
        {actualSq > 0 ? `${actualSq.toFixed(2)} SQ` : '—'}
      </td>
      <td style={td}>
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '1rem', padding: '2px 6px' }}
          title="Remove plane"
        >×</button>
      </td>
    </tr>
  );
}

const LF_FIELDS = [
  { key: 'eave_lf',   label: 'Eaves' },
  { key: 'rake_lf',   label: 'Rakes' },
  { key: 'hip_lf',    label: 'Hips' },
  { key: 'ridge_lf',  label: 'Ridges' },
  { key: 'valley_lf', label: 'Valleys' },
];

export default function TakeoffReview({ planes, linearFootage, onPlanesChange, onLFChange, isAssisted }) {
  const totalHorizSq = planes.reduce((s, p) => {
    const a = p.horizontal_area != null
      ? parseFloat(p.horizontal_area)
      : (parseFloat(p.horizontal_length) || 0) * (parseFloat(p.horizontal_width) || 0);
    return s + a / 100;
  }, 0);
  const totalActualSq = planes.reduce((s, p) => {
    const a = p.horizontal_area != null
      ? parseFloat(p.horizontal_area)
      : (parseFloat(p.horizontal_length) || 0) * (parseFloat(p.horizontal_width) || 0);
    return s + (a * getSlopeFactor(parseInt(p.pitch_numerator, 10) || 6)) / 100;
  }, 0);

  function updatePlane(i, updated) {
    const next = [...planes];
    next[i] = updated;
    onPlanesChange(next);
  }

  function removePlane(i) {
    onPlanesChange(planes.filter((_, idx) => idx !== i));
  }

  function addPlane() {
    onPlanesChange([...planes, { plane_label: `Plane ${planes.length + 1}`, horizontal_length: '', horizontal_width: '', pitch_numerator: 6 }]);
  }

  function updateLF(key, val) {
    onLFChange({ ...linearFootage, [key]: val });
  }

  return (
    <div>
      {isAssisted && (
        <div style={{ background: '#fff8e1', border: '1px solid #f5c542', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: '0.875rem', color: '#7a5c00' }}>
          <strong>Assisted Estimate</strong> — Planes were derived from the floor plan footprint. Verify all dimensions before confirming.
        </div>
      )}

      {/* Planes table */}
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a3a5c', marginBottom: 10 }}>Roof Planes</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f5f7fa' }}>
              <th style={th}>Label</th>
              <th style={th}>Length (ft)</th>
              <th style={th}>Width (ft)</th>
              <th style={th}>Horiz Area</th>
              <th style={th}>Pitch</th>
              <th style={th}>Actual SQ</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {planes.map((p, i) => (
              <PlaneRow key={i} plane={p} index={i} onChange={updatePlane} onRemove={removePlane} />
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addPlane}
        style={{ marginTop: 10, padding: '5px 14px', border: '1px dashed #2d6a9f', background: 'none', color: '#2d6a9f', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}
      >
        + Add Plane
      </button>

      {/* Totals */}
      <div style={{ marginTop: 14, display: 'flex', gap: 24, fontSize: '0.875rem', flexWrap: 'wrap' }}>
        <div style={statBox}>
          <div style={statLabel}>Horizontal Area</div>
          <div style={statVal}>{totalHorizSq.toFixed(2)} SQ</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Actual Surface Area</div>
          <div style={{ ...statVal, color: '#1a3a5c' }}>{totalActualSq.toFixed(2)} SQ</div>
        </div>
      </div>

      {/* Linear footage */}
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a3a5c', margin: '20px 0 10px' }}>Linear Footage</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {LF_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>
              {label} (LF)
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={linearFootage[key] ?? 0}
              onChange={(e) => updateLF(key, parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: '0.9rem' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '0.8rem', whiteSpace: 'nowrap' };
const td = { padding: '6px 8px', verticalAlign: 'middle' };
const inputSm = { width: '100%', minWidth: 60, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.85rem' };
const statBox = { background: '#f5f7fa', borderRadius: 6, padding: '8px 14px', minWidth: 120 };
const statLabel = { fontSize: '0.75rem', color: '#888', marginBottom: 2 };
const statVal = { fontWeight: 700, fontSize: '1rem', color: '#333' };
