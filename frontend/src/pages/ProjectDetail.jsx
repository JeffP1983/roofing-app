import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = { draft: '#888', sent: '#2d6a9f', accepted: '#27ae60' };
const STATUS_LABELS = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted' };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get(`/api/projects/${id}`)
      .then((r) => setProject(r.data))
      .catch((err) => setError(err.response?.data?.error || 'Project not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem', color: '#888' }}>
        Loading project…
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem', color: '#c0392b' }}>
        {error || 'Project not found'}
      </div>
    );
  }

  const estimates = project.estimates || [];

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <button
            onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/dashboard')}
            style={{ background: 'none', border: 'none', color: '#2d6a9f', cursor: 'pointer', padding: 0, fontSize: '0.9rem', marginBottom: 8 }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, color: '#1a3a5c', fontSize: '1.4rem' }}>{project.project_address}</h1>
          {project.client_name && (
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.875rem' }}>
              Client: {project.client_name} &middot; {project.client_email}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(`/estimates/new?project=${id}`)}
          style={{ padding: '8px 18px', background: '#2d6a9f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          + New Estimate
        </button>
      </div>

      {/* Estimates table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee' }}>
          <h3 style={{ margin: 0, color: '#1a3a5c', fontSize: '1rem' }}>
            Estimates{estimates.length > 0 && ` (${estimates.length})`}
          </h3>
        </div>

        {estimates.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#aaa' }}>
            No estimates yet.{' '}
            <button
              onClick={() => navigate(`/estimates/new?project=${id}`)}
              style={{ background: 'none', border: 'none', color: '#2d6a9f', cursor: 'pointer', fontWeight: 600 }}
            >
              Create one now →
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#444', borderBottom: '1px solid #eee' }}>Estimate #</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#444', borderBottom: '1px solid #eee' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#444', borderBottom: '1px solid #eee' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#444', borderBottom: '1px solid #eee' }}>Status</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #eee' }}></th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((est) => (
                <tr
                  key={est.id}
                  onClick={() => navigate(`/estimates/${est.id}`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fbff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1a3a5c' }}>
                    {est.estimate_number || est.id?.slice(0, 8)}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#555', textTransform: 'capitalize' }}>
                    {est.estimate_type === 'assisted' ? 'Assisted' : 'Calculated'}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#555' }}>
                    {est.created_at ? new Date(est.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                      fontSize: '0.78rem', fontWeight: 700,
                      background: est.status === 'accepted' ? '#c6f6d5' : est.status === 'sent' ? '#bee3f8' : '#e2e8f0',
                      color: est.status === 'accepted' ? '#155724' : est.status === 'sent' ? '#1a5276' : '#4a5568',
                    }}>
                      {STATUS_LABELS[est.status] || 'Draft'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/estimates/${est.id}`); }}
                      style={{ padding: '4px 12px', background: '#e8f0fe', color: '#2d6a9f', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
