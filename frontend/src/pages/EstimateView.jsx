import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './EstimateView.css';

// ── Constants ────────────────────────────────────────────────

const LINE_TO_CATEGORY = {
  field_shingles:   'shingles',
  underlayment:     'underlayment',
  ice_water_shield: 'ice_water_shield',
  starter:          'starter',
  drip_edge:        'drip_edge',
  hip_ridge:        'hip_ridge',
};

const LINE_LABELS = {
  field_shingles:   'Field Shingles',
  underlayment:     'Underlayment',
  ice_water_shield: 'Ice & Water Shield',
  starter:          'Starter Course',
  drip_edge:        'Drip Edge',
  hip_ridge:        'Hip & Ridge',
  labor:            'Labor',
  tearoff:          'Tear-Off',
};

const MATERIAL_LINE_TYPES = new Set([
  'field_shingles',
  'underlayment',
  'ice_water_shield',
  'starter',
  'drip_edge',
  'hip_ridge',
]);

const MFR_ORDER = [
  'GAF',
  'Tamko',
  'Atlas',
  'Malarkey',
  'IKO',
  'Owens Corning',
  'CertainTeed',
];

// ── Helpers ──────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(Number(n))) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(n, unit) {
  if (n == null || isNaN(Number(n))) return '0';
  if (unit === 'SQ') return Number(n).toFixed(2);
  return Math.round(Number(n)).toLocaleString('en-US');
}

// ── Sub-components ───────────────────────────────────────────

function StatusBadge({ status }) {
  const labels = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted' };
  return (
    <span className={`status-badge ${status || 'draft'}`}>
      {labels[status] || status || 'Draft'}
    </span>
  );
}

function StatusSelector({ status, onChange }) {
  return (
    <select
      className="status-selector"
      value={status || 'draft'}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="draft">Draft</option>
      <option value="sent">Sent</option>
      <option value="accepted">Accepted</option>
    </select>
  );
}

function AltDropdown({ category, materials, currentId, recalculating, onSelect }) {
  const categoryData = materials[category];
  const items = categoryData?.items || [];

  // Group by manufacturer using MFR_ORDER, then alphabetical for unknowns
  const grouped = {};
  items.forEach((m) => {
    const mfr = m.manufacturer || 'Other';
    if (!grouped[mfr]) grouped[mfr] = [];
    grouped[mfr].push(m);
  });

  const knownMfrs = MFR_ORDER.filter((mfr) => grouped[mfr]);
  const unknownMfrs = Object.keys(grouped)
    .filter((mfr) => !MFR_ORDER.includes(mfr))
    .sort();
  const orderedMfrs = [...knownMfrs, ...unknownMfrs];

  if (items.length === 0) {
    return (
      <div className="alt-dropdown">
        <span style={{ fontSize: '0.82rem', color: '#888' }}>No alternatives available.</span>
      </div>
    );
  }

  return (
    <div className="alt-dropdown">
      {recalculating && (
        <div className="alt-dropdown-spinner">Recalculating…</div>
      )}
      <div className="alt-dropdown-inner">
        {orderedMfrs.map((mfr) => (
          <div key={mfr}>
            <div className="alt-group-label">{mfr}</div>
            {grouped[mfr].map((mat) => (
              <div
                key={mat.id}
                className={`alt-item${currentId === mat.id ? ' selected' : ''}`}
                onClick={() => !recalculating && onSelect(mat.id)}
              >
                <span className="alt-item-name">{mat.product_name || mat.name}</span>
                <span className="alt-item-price">{fmt(mat.unit_price)} / {mat.unit}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export default function EstimateView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Core data
  const [estimate, setEstimate]                   = useState(null);
  const [project, setProject]                     = useState(null);
  const [planes, setPlanes]                       = useState([]);
  const [lineItems, setLineItems]                 = useState([]);
  const [financials, setFinancials]               = useState({});
  const [materialsByCategory, setMaterialsByCategory] = useState({});
  const [materialSelections, setMaterialSelections]   = useState({});

  // UI state
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [openDropdown, setOpenDropdown]   = useState(null);
  const [suggestBanner, setSuggestBanner] = useState('');

  // Admin override state
  const [editingItem, setEditingItem] = useState(null);

  // ── Data loading ───────────────────────────────────────────

  const initSelectionsFromLineItems = useCallback((items) => {
    const sel = {};
    items.forEach((li) => {
      if (li.material_id) {
        sel[li.line_type] = li.material_id;
      }
    });
    return sel;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [estRes, matRes] = await Promise.all([
          axios.get(`/api/estimates/${id}`),
          axios.get('/api/materials'),
        ]);

        if (cancelled) return;

        const estData = estRes.data;
        setEstimate(estData.estimate || estData);
        setProject(estData.project || null);
        setPlanes(estData.planes || []);

        const items = estData.line_items || estData.lineItems || [];
        setLineItems(items);
        setFinancials(estData.financials || estData.financial_summary || {});
        setMaterialSelections(initSelectionsFromLineItems(items));

        // Convert materials array → object keyed by category name
        // API returns: [{ name: 'shingles', label: '...', items: [...] }, ...]
        const groups = Array.isArray(matRes.data) ? matRes.data : (matRes.data?.groups || []);
        const byCategory = {};
        groups.forEach((group) => {
          if (group.name) byCategory[group.name] = group;
        });
        setMaterialsByCategory(byCategory);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || 'Failed to load estimate.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [id, initSelectionsFromLineItems]);

  // ── Material swap ──────────────────────────────────────────

  const handleMaterialChange = useCallback(async (lineType, materialId) => {
    let newSelections = { ...materialSelections, [lineType]: materialId };

    // Auto-match H&R and Starter when field shingles change
    if (lineType === 'field_shingles') {
      const shingles = materialsByCategory?.shingles?.items || [];
      const newShingle = shingles.find((m) => m.id === materialId);
      if (newShingle?.manufacturer) {
        const mfr = newShingle.manufacturer;
        let bannerParts = [];

        // Hip & Ridge
        const hrItems = materialsByCategory?.hip_ridge?.items || [];
        const matchedHR = hrItems.find((m) => m.manufacturer === mfr);
        if (matchedHR && newSelections.hip_ridge !== matchedHR.id) {
          newSelections.hip_ridge = matchedHR.id;
          bannerParts.push('H&R');
        }

        // Starter
        const starterItems = materialsByCategory?.starter?.items || [];
        const matchedStarter = starterItems.find((m) => m.manufacturer === mfr);
        if (matchedStarter && newSelections.starter !== matchedStarter.id) {
          newSelections.starter = matchedStarter.id;
          bannerParts.push('Starter');
        }

        if (bannerParts.length > 0) {
          setSuggestBanner(`${bannerParts.join(' and ')} updated to match ${mfr}`);
        }
      }
    }

    setMaterialSelections(newSelections);
    setRecalculating(true);

    try {
      const res = await axios.post(`/api/estimates/${id}/calculate`, {
        material_selections: newSelections,
      });

      const items = res.data.line_items || res.data.lineItems || [];
      setLineItems(items);
      setFinancials(res.data.financials || res.data.financial_summary || {});
      setMaterialSelections(initSelectionsFromLineItems(items));
    } catch (err) {
      console.error('Recalculation failed:', err);
    } finally {
      setRecalculating(false);
    }
  }, [id, materialSelections, materialsByCategory, initSelectionsFromLineItems]);

  // ── Dropdown toggle ────────────────────────────────────────

  const toggleDropdown = useCallback((lineType) => {
    setOpenDropdown((prev) => (prev === lineType ? null : lineType));
  }, []);

  // ── Admin override ─────────────────────────────────────────

  const startEdit = useCallback((li) => {
    setEditingItem({
      id: li.id,
      quantity: li.quantity,
      unit_price: li.unit_price,
      description: li.description,
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingItem) return;
    try {
      await axios.patch(`/api/estimates/${id}/line-items/${editingItem.id}`, {
        quantity: editingItem.quantity,
        unit_price: editingItem.unit_price,
        description: editingItem.description,
      });

      setLineItems((prev) =>
        prev.map((li) =>
          li.id === editingItem.id
            ? {
                ...li,
                quantity: editingItem.quantity,
                unit_price: editingItem.unit_price,
                description: editingItem.description,
                total_price: Number(editingItem.quantity) * Number(editingItem.unit_price),
                is_manual_override: true,
              }
            : li
        )
      );

      // Re-fetch to get updated financials
      const res = await axios.get(`/api/estimates/${id}`);
      setFinancials(res.data.financials || res.data.financial_summary || {});
      setEditingItem(null);
    } catch (err) {
      console.error('Failed to save override:', err);
    }
  }, [id, editingItem]);

  const cancelEdit = useCallback(() => {
    setEditingItem(null);
  }, []);

  // ── Status change ──────────────────────────────────────────

  const handleStatusChange = useCallback(async (newStatus) => {
    try {
      await axios.patch(`/api/estimates/${id}`, { status: newStatus });
      setEstimate((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, [id]);

  // ── Print ──────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ── Derived data ───────────────────────────────────────────

  const materialLineItems = lineItems.filter((li) => MATERIAL_LINE_TYPES.has(li.line_type));
  const laborLineItems    = lineItems.filter((li) => !MATERIAL_LINE_TYPES.has(li.line_type));

  // actual_surface_area is stored in sq ft; 1 SQ = 100 sq ft
  const totalSq = planes.reduce((sum, p) => sum + (Number(p.actual_surface_area) || 0) / 100, 0);

  // ── Loading / error ────────────────────────────────────────

  if (loading) {
    return (
      <div className="ev-page">
        <div className="ev-loading">Loading estimate…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ev-page">
        <div className="ev-error">{error}</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="ev-page">

      {/* Top bar */}
      <div className="ev-header no-print">
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <StatusSelector
              status={estimate?.status}
              onChange={handleStatusChange}
            />
          )}
          <button className="btn-secondary" onClick={handlePrint}>
            ⬇ Download PDF
          </button>
        </div>
      </div>

      {/* Suggest banner */}
      {suggestBanner && (
        <div className="suggest-banner no-print">
          <span>{suggestBanner}</span>
          <button onClick={() => setSuggestBanner('')}>×</button>
        </div>
      )}

      {/* Main document */}
      <div className="ev-doc" id="estimate-doc">

        {/* Company header */}
        <div className="ev-company">
          <div>
            <h2>Rock Solid Restoration</h2>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>Roofing Estimate</div>
          </div>
          <div
            style={{
              width: 80,
              height: 60,
              border: '1px dashed #ccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#aaa',
              fontSize: '0.7rem',
              borderRadius: 4,
            }}
          >
            LOGO
          </div>
        </div>

        {/* Meta row */}
        <div className="ev-meta">
          <span><b>Project:</b> {project?.project_address || project?.address || '—'}</span>
          <span>
            <b>Date:</b>{' '}
            {estimate?.created_at
              ? new Date(estimate.created_at).toLocaleDateString()
              : '—'}
          </span>
          <span><b>Estimate #:</b> {estimate?.estimate_number || estimate?.id || '—'}</span>
          <span><StatusBadge status={estimate?.status} /></span>
          {estimate?.estimate_type === 'assisted' && (
            <span className="ev-type-badge assisted">
              Assisted Estimate — Field Verification Recommended
            </span>
          )}
        </div>

        {/* Takeoff Summary */}
        <div className="ev-section">
          <h3>Takeoff Summary</h3>
          <table className="ev-table">
            <thead>
              <tr>
                <th>Plane</th>
                <th>Length (ft)</th>
                <th>Width (ft)</th>
                <th>Horiz Area (sf)</th>
                <th>Pitch</th>
                <th>Slope Factor</th>
                <th>Actual Area (SQ)</th>
              </tr>
            </thead>
            <tbody>
              {planes.map((p) => {
                const horizArea = Number(p.horizontal_area) ||
                  (Number(p.horizontal_length) * Number(p.horizontal_width)) || 0;
                const actualSq = (Number(p.actual_surface_area) || 0) / 100;
                return (
                  <tr key={p.id}>
                    <td>{p.plane_label || `Plane ${p.id?.slice(0,6)}`}</td>
                    <td>{p.horizontal_length ? Number(p.horizontal_length).toFixed(1) : '—'}</td>
                    <td>{p.horizontal_width  ? Number(p.horizontal_width).toFixed(1)  : '—'}</td>
                    <td>{horizArea.toFixed(0)} sf</td>
                    <td>{p.pitch_numerator ?? '—'}/12</td>
                    <td>{Number(p.slope_factor || 0).toFixed(4)}</td>
                    <td>{actualSq.toFixed(2)} SQ</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: 'right', fontWeight: 700, paddingRight: 10 }}
                >
                  Total Actual:
                </td>
                <td style={{ fontWeight: 700 }}>{totalSq.toFixed(2)} SQ</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Materials */}
        <div className="ev-section">
          <h3>Materials</h3>
          <table className="ev-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Unit Price</th>
                <th>Total</th>
                {isAdmin && <th>Override</th>}
              </tr>
            </thead>
            <tbody>
              {materialLineItems.map((li) => (
                <React.Fragment key={li.id}>
                  <tr className={li.is_manual_override ? 'override-row' : ''}>
                    <td>
                      {LINE_TO_CATEGORY[li.line_type] && (
                        <button
                          className="chevron-btn"
                          onClick={() => toggleDropdown(li.line_type)}
                          title="Show alternative materials"
                        >
                          {openDropdown === li.line_type ? '▾' : '▸'}
                        </button>
                      )}
                    </td>

                    {/* Description */}
                    <td>
                      {editingItem?.id === li.id ? (
                        <input
                          type="text"
                          value={editingItem.description}
                          onChange={(e) =>
                            setEditingItem((prev) => ({ ...prev, description: e.target.value }))
                          }
                        />
                      ) : (
                        <>
                          {li.description}
                          {li.is_manual_override && (
                            <span
                              title="Manually overridden"
                              style={{ color: '#e67e22', marginLeft: 4, fontSize: '0.85rem' }}
                            >
                              *
                            </span>
                          )}
                        </>
                      )}
                    </td>

                    {/* Quantity */}
                    <td>
                      {editingItem?.id === li.id ? (
                        <input
                          type="number"
                          value={editingItem.quantity}
                          step="0.01"
                          onChange={(e) =>
                            setEditingItem((prev) => ({ ...prev, quantity: e.target.value }))
                          }
                        />
                      ) : (
                        fmtQty(li.quantity, li.unit)
                      )}
                    </td>

                    <td>{li.unit}</td>

                    {/* Unit price */}
                    <td>
                      {editingItem?.id === li.id ? (
                        <input
                          type="number"
                          value={editingItem.unit_price}
                          step="0.01"
                          onChange={(e) =>
                            setEditingItem((prev) => ({ ...prev, unit_price: e.target.value }))
                          }
                        />
                      ) : (
                        fmt(li.unit_price)
                      )}
                    </td>

                    <td>{fmt(li.total_price)}</td>

                    {isAdmin && (
                      <td>
                        {editingItem?.id === li.id ? (
                          <>
                            <button className="icon-btn confirm" onClick={saveEdit} title="Save">
                              ✓
                            </button>
                            <button className="icon-btn cancel" onClick={cancelEdit} title="Cancel">
                              ✕
                            </button>
                          </>
                        ) : (
                          <button className="override-btn" onClick={() => startEdit(li)}>
                            Edit
                          </button>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Alternate materials dropdown */}
                  {openDropdown === li.line_type && (
                    <tr className="no-print">
                      <td colSpan={isAdmin ? 7 : 6} style={{ padding: 0 }}>
                        <AltDropdown
                          category={LINE_TO_CATEGORY[li.line_type]}
                          materials={materialsByCategory}
                          currentId={materialSelections[li.line_type]}
                          recalculating={recalculating}
                          onSelect={(matId) => {
                            setOpenDropdown(null);
                            handleMaterialChange(li.line_type, matId);
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Labor */}
        <div className="ev-section">
          <h3>Labor</h3>
          <table className="ev-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Total</th>
                {isAdmin && <th>Override</th>}
              </tr>
            </thead>
            <tbody>
              {laborLineItems.map((li) => (
                <React.Fragment key={li.id}>
                  <tr>
                    <td>{li.description}</td>
                    <td>{fmtQty(li.quantity, li.unit)}</td>
                    <td>{li.unit}</td>
                    <td>—</td>
                    <td>{fmt(li.total_price)}</td>
                    {isAdmin && (
                      <td>
                        <button className="override-btn" onClick={() => startEdit(li)}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>

                  {/* Pitch tier breakdown */}
                  {li.metadata?.pitch_tiers?.map((tier) => (
                    <tr key={tier.pitch} className="labor-tier">
                      <td colSpan={2} style={{ paddingLeft: 28 }}>
                        {tier.pitch}/12 pitch — {Number(tier.sq).toFixed(2)} SQ @ ${tier.rate}/SQ
                      </td>
                      <td></td>
                      <td></td>
                      <td>{fmt(tier.total)}</td>
                      {isAdmin && <td></td>}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="ev-section">
          <h3>Financial Summary</h3>
          <table className="fin-table">
            <tbody>
              {isAdmin ? (
                <>
                  <tr>
                    <td>Materials Subtotal</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.materials_subtotal)}</td>
                  </tr>
                  <tr>
                    <td>Labor Total</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.labor_total)}</td>
                  </tr>
                  <tr>
                    <td>Direct Costs</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.direct_costs)}</td>
                  </tr>
                  <tr>
                    <td>Sales Tax ({financials.tax_rate}% on materials)</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.sales_tax)}</td>
                  </tr>
                  <tr>
                    <td>Overhead ({financials.overhead_pct}%)</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.overhead)}</td>
                  </tr>
                  <tr>
                    <td>Profit ({financials.profit_pct}%)</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.profit)}</td>
                  </tr>
                </>
              ) : (
                <>
                  <tr>
                    <td>Materials Subtotal</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.materials_subtotal)}</td>
                  </tr>
                  <tr>
                    <td>Sales Tax ({financials.tax_rate}% on materials)</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.sales_tax)}</td>
                  </tr>
                  <tr>
                    <td>Labor Total</td>
                    <td style={{ textAlign: 'right' }}>{fmt(financials.labor_total)}</td>
                  </tr>
                </>
              )}
              <tr className="fin-total-row">
                <td>Grand Total</td>
                <td style={{ textAlign: 'right' }}>{fmt(financials.grand_total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Assisted estimate disclaimer */}
        {estimate?.estimate_type === 'assisted' && (
          <p
            style={{
              fontSize: '0.78rem',
              color: '#888',
              marginTop: '2rem',
              borderTop: '1px solid #eee',
              paddingTop: '1rem',
            }}
          >
            * Assisted Estimate — Field Verification Recommended. Dimensions derived from floor
            plan footprint. Verify all measurements before accepting.
          </p>
        )}
      </div>
    </div>
  );
}
