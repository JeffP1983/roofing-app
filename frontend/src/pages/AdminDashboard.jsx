import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1a3a5c' }}>Admin Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>Signed in as {user?.name}</p>
        </div>
        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {['Estimates', 'Pricing Manager', 'O&P Settings', 'All Clients'].map((label) => (
          <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', border: '1px solid #e0e0e0', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, color: '#1a3a5c' }}>{label}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
