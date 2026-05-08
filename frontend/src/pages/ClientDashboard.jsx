import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = { draft: '#888', sent: '#2d6a9f', accepted: '#27ae60' };
const STATUS_LABELS = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted' };

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects]         = useState([]);
  const [showNewProject, setShowNew]    = useState(false);
  const [newAddress, setNewAddress]     = useState('');
  const [creating, setCreating]         = useState(false);

  useEffect(() => {
    axios.get('/api/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  async function createProject() {
    if (!newAddress.trim()) return;
    setCreating(true);
    try {
      const { data } = await axios.post('/api/projects', { project_address: newAddress });
      setProjects(prev => [data, ...prev]);
      setShowNew(false);
      setNewAddress('');
      // Go straight to upload flow for the new project
      navigate(`/estimates/new?project=${data.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1a3a5c' }}>My Projects</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>Welcome back, {user?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowNew(true)}
            style={{ padding: '0.6rem 1.2rem', background: '#2d6a9f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            + New Project
          </button>
          <button onClick={logout} style={{ padding: '0.6rem 1rem', background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* New project form */}
      {showNewProject && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', border: '1px solid #e0e0e0', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 12px', color: '#1a3a5c' }}>New Project</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder="Project address (e.g. 123 Main St, Austin TX)"
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 6, fontSize: '0.95rem' }}
              autoFocus
            />
            <button
              onClick={createProject}
              disabled={creating || !newAddress.trim()}
              style={{ padding: '8px 18px', background: '#2d6a9f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            >
              {creating ? '...' : 'Create & Upload Plans'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              style={{ padding: '8px 12px', background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project list */}
      {projects.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏠</div>
          <p style={{ color: '#888', fontSize: '1.05rem', margin: '0 0 1rem' }}>
            No projects yet. Create a project and upload your house plans to get a roofing estimate.
          </p>
          <button
            onClick={() => setShowNew(true)}
            style={{ padding: '0.75rem 2rem', background: '#2d6a9f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '1rem', fontWeight: 600 }}
          >
            Start Your First Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map(project => (
            <div
              key={project.id}
              style={{ background: '#fff', borderRadius: 10, padding: '1.25rem 1.5rem', border: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#1a3a5c', fontSize: '1rem' }}>{project.project_address}</div>
                <div style={{ color: '#888', fontSize: '0.82rem', marginTop: 2 }}>
                  {parseInt(project.estimate_count, 10) === 0
                    ? 'No estimates yet'
                    : `${project.estimate_count} estimate${project.estimate_count !== '1' ? 's' : ''}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate(`/estimates/new?project=${project.id}`)}
                  style={{ padding: '6px 14px', background: '#e8f0fe', color: '#2d6a9f', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
                >
                  + New Estimate
                </button>
                <button
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{ padding: '6px 14px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
