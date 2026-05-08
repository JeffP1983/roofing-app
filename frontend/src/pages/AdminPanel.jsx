import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './AdminPanel.css';

// ─── Estimates Tab ────────────────────────────────────────────────────────────

function EstimatesTab() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEstimates = async () => {
      setLoading(true);
      try {
        const params = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        const res = await axios.get('/api/estimates', { params });
        setEstimates(res.data);
      } catch (err) {
        console.error('Failed to fetch estimates:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEstimates();
  }, [statusFilter]);

  const filtered = estimates.filter((est) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (est.client_name && est.client_name.toLowerCase().includes(q)) ||
      (est.project_address && est.project_address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="ap-card">
      <h3 className="ap-section-title">All Estimates</h3>

      <div className="filter-bar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
        </select>
        <input
          type="text"
          placeholder="Search client or address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading estimates…</div>
      ) : (
        <table className="ap-table">
          <thead>
            <tr>
              <th>Estimate #</th>
              <th>Project Address</th>
              <th>Client</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#aaa', padding: '1.5rem' }}>
                  No estimates found.
                </td>
              </tr>
            ) : (
              filtered.map((est) => (
                <tr
                  key={est.id}
                  className="est-row"
                  onClick={() => navigate(`/estimates/${est.id}`)}
                >
                  <td>{est.estimate_number || est.id?.slice(0, 8)}</td>
                  <td>{est.project_address || '—'}</td>
                  <td>{est.client_name || '—'}</td>
                  <td>
                    {est.created_at
                      ? new Date(est.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td>
                    <span className={`status-badge ${est.status}`}>
                      {est.status
                        ? est.status.charAt(0).toUpperCase() + est.status.slice(1)
                        : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="save-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/estimates/${est.id}`);
                      }}
                    >
                      View / Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Pricing Tab ─────────────────────────────────────────────────────────────

function PricingTab() {
  const [materials, setMaterials] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaterials = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/materials');
        // Flatten all items from all groups, attaching category_label
        const groups = Array.isArray(res.data) ? res.data : [];
        const flat = [];
        groups.forEach((group) => {
          const label = group.category_label || group.category || group.name || 'Uncategorized';
          const items = Array.isArray(group.items) ? group.items : [];
          items.forEach((item) => {
            flat.push({ ...item, category_label: label });
          });
        });
        setMaterials(flat);
      } catch (err) {
        console.error('Failed to fetch materials:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
  }, []);

  const handleEdit = (row) => {
    setEditingId(row.id);
    setEditPrice(String(row.unit_price ?? ''));
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditPrice('');
  };

  const handleSave = async (row) => {
    setSaving(true);
    try {
      const newPrice = parseFloat(editPrice);
      await axios.put(`/api/materials/${row.id}`, { unit_price: newPrice });
      setMaterials((prev) =>
        prev.map((m) => (m.id === row.id ? { ...m, unit_price: newPrice } : m))
      );
      setEditingId(null);
      setEditPrice('');
    } catch (err) {
      console.error('Failed to save price:', err);
    } finally {
      setSaving(false);
    }
  };

  // Render rows with category dividers
  const rows = [];
  let lastCategory = null;
  materials.forEach((row) => {
    if (row.category_label !== lastCategory) {
      lastCategory = row.category_label;
      rows.push(
        <tr key={`cat-${row.category_label}`} className="category-divider">
          <td colSpan={6}>{row.category_label}</td>
        </tr>
      );
    }
    rows.push(
      <tr key={row.id}>
        <td>{row.category_label}</td>
        <td>
          <span className="mfr-chip">{row.manufacturer || '—'}</span>
        </td>
        <td>{row.name || row.product_name || '—'}</td>
        <td>{row.unit || '—'}</td>
        <td>
          {editingId === row.id ? (
            <input
              className="price-input"
              type="number"
              step="0.01"
              min="0"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              autoFocus
            />
          ) : (
            <span>
              {row.unit_price != null
                ? `$${Number(row.unit_price).toFixed(2)}`
                : '—'}
            </span>
          )}
        </td>
        <td>
          {editingId === row.id ? (
            <>
              <button
                className="save-btn"
                onClick={() => handleSave(row)}
                disabled={saving}
              >
                Save
              </button>
              <button className="cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
            </>
          ) : (
            <button className="save-btn" onClick={() => handleEdit(row)}>
              Edit
            </button>
          )}
        </td>
      </tr>
    );
  });

  return (
    <div className="ap-card">
      <h3 className="ap-section-title">Material Pricing</h3>

      {loading ? (
        <div className="loading-state">Loading materials…</div>
      ) : (
        <table className="ap-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Manufacturer</th>
              <th>Product Name</th>
              <th>Unit</th>
              <th>Current Price</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#aaa', padding: '1.5rem' }}>
                  No materials found.
                </td>
              </tr>
            ) : (
              rows
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState({
    overhead_percent: '',
    profit_percent: '',
    sales_tax_percent: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/materials/settings');
        setSettings({
          overhead_percent: res.data.overhead_percent ?? '',
          profit_percent: res.data.profit_percent ?? '',
          sales_tax_percent: res.data.sales_tax_percent ?? '',
        });
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (field) => (e) => {
    setSettings((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put('/api/materials/settings', {
        overhead_percent: parseFloat(settings.overhead_percent),
        profit_percent: parseFloat(settings.profit_percent),
        sales_tax_percent: parseFloat(settings.sales_tax_percent),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ap-card">
        <div className="loading-state">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="ap-card">
      <h3 className="ap-section-title">Estimate Settings</h3>

      <form onSubmit={handleSave}>
        <div className="op-form">
          <div className="op-field">
            <label htmlFor="overhead_percent">Overhead %</label>
            <input
              id="overhead_percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={settings.overhead_percent}
              onChange={handleChange('overhead_percent')}
            />
            <p className="field-note">Applied to direct costs (materials + labor)</p>
          </div>

          <div className="op-field">
            <label htmlFor="profit_percent">Profit %</label>
            <input
              id="profit_percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={settings.profit_percent}
              onChange={handleChange('profit_percent')}
            />
            <p className="field-note">Applied after overhead to determine margin</p>
          </div>

          <div className="op-field">
            <label htmlFor="sales_tax_percent">Sales Tax %</label>
            <input
              id="sales_tax_percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={settings.sales_tax_percent}
              onChange={handleChange('sales_tax_percent')}
            />
            <p className="field-note">Applied to taxable materials on final estimate</p>
          </div>

          <div className="settings-save-row">
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && <span className="saved-flash">Saved ✓</span>}
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Main AdminPanel Component ────────────────────────────────────────────────

const TABS = [
  { key: 'estimates', label: 'Estimates' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'settings', label: 'Settings' },
];

export default function AdminPanel() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('estimates');

  const handleSignOut = () => {
    logout();
    navigate('/admin');
  };

  return (
    <div className="ap-page">
      <div className="ap-header">
        <div>
          <h1>Admin Panel</h1>
          <p>Rock Solid Restoration</p>
        </div>
        <button className="signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>

      <div className="ap-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`ap-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'estimates' && <EstimatesTab />}
      {activeTab === 'pricing' && <PricingTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}
