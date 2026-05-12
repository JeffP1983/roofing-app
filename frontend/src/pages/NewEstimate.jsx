import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import PlanUpload from '../components/upload/PlanUpload';
import TakeoffReview from '../components/upload/TakeoffReview';
import PitchGuide from '../components/upload/PitchGuide';
import './NewEstimate.css';

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 'upload',       label: 'Upload Plan' },
  { id: 'processing',   label: 'AI Analysis' },
  { id: 'floor_config', label: 'Roof Config' },
  { id: 'review',       label: 'Review' },
  { id: 'creating',     label: 'Generate' },
];

function StepBar({ current }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="step-bar">
      {STEPS.map((step, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
        return (
          <React.Fragment key={step.id}>
            {i > 0 && <div className={`step-sep${i <= idx ? ' done' : ''}`} />}
            <div className="step-item">
              <div className={`step-circle ${state}`}>{i < idx ? '✓' : i + 1}</div>
              <span className={`step-label${state === 'active' ? ' active' : ''}`}>{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── SVG diagrams for roof styles ──────────────────────────────────────────────

function GableSvg() {
  return (
    <svg viewBox="0 0 80 50" width={70} height={44}>
      <rect x={5} y={28} width={70} height={14} fill="#d0dcea" stroke="#6a9acc" strokeWidth={1.5} />
      <polygon points="40,6 5,28 75,28" fill="#b0c8e8" stroke="#2d6a9f" strokeWidth={1.5} />
      <line x1={40} y1={6} x2={40} y2={28} stroke="#2d6a9f" strokeWidth={1} strokeDasharray="3,2" />
    </svg>
  );
}

function HipSvg() {
  return (
    <svg viewBox="0 0 80 50" width={70} height={44}>
      <rect x={5} y={28} width={70} height={14} fill="#d0dcea" stroke="#6a9acc" strokeWidth={1.5} />
      <polygon points="20,28 60,28 50,14 30,14" fill="#b0c8e8" stroke="#2d6a9f" strokeWidth={1.5} />
      <polygon points="5,28 20,28 30,14" fill="#a0b8d8" stroke="#2d6a9f" strokeWidth={1.5} />
      <polygon points="60,28 75,28 50,14" fill="#a0b8d8" stroke="#2d6a9f" strokeWidth={1.5} />
    </svg>
  );
}

function ComboSvg() {
  return (
    <svg viewBox="0 0 80 50" width={70} height={44}>
      <rect x={5} y={28} width={70} height={14} fill="#d0dcea" stroke="#6a9acc" strokeWidth={1.5} />
      <polygon points="40,6 5,28 50,28" fill="#b0c8e8" stroke="#2d6a9f" strokeWidth={1.5} />
      <polygon points="50,28 65,28 57,17" fill="#a0b8d8" stroke="#2d6a9f" strokeWidth={1.5} />
      <polygon points="65,28 75,28 57,17" fill="#a0b8d8" stroke="#2d6a9f" strokeWidth={1.5} />
    </svg>
  );
}

const ROOF_STYLES = [
  { id: 'gable',       label: 'Gable',       desc: 'Two sloped sides', Svg: GableSvg },
  { id: 'hip',         label: 'Hip',         desc: 'All four sides slope', Svg: HipSvg },
  { id: 'combination', label: 'Combination', desc: 'Mix of styles',    Svg: ComboSvg },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewEstimate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [step, setStep]               = useState('upload');
  const [file, setFile]               = useState(null);
  const [error, setError]             = useState('');
  const [analysisResult, setAnalysis] = useState(null);

  // Confirmed takeoff data (editable)
  const [planes, setPlanes]               = useState([]);
  const [linearFootage, setLinearFootage] = useState({ eave_lf:0, rake_lf:0, hip_lf:0, ridge_lf:0, valley_lf:0 });
  const [isAssisted, setIsAssisted]       = useState(false);

  // Floor plan config
  const [roofStyle, setRoofStyle]         = useState('gable');
  const [pitchNumerator, setPitchNumerator] = useState(6);
  const [footprint, setFootprint]         = useState(null);

  // ── Step: Upload → send to AI ──────────────────────────────────────────────

  async function handleUpload() {
    if (!file) return setError('Please select a plan file first');
    if (!projectId) return setError('No project selected. Go back to your dashboard and open a project.');
    setError('');
    setStep('processing');

    try {
      const formData = new FormData();
      formData.append('plan', file);

      const { data } = await axios.post('/api/uploads/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setAnalysis(data);

      if (data.plan_type === 'roof_plan') {
        setPlanes(data.planes);
        setLinearFootage(data.linear_footage);
        setIsAssisted(false);
        setStep('review');
      } else {
        // floor_plan — need user to choose style + pitch
        setFootprint(data.footprint);
        setIsAssisted(true);
        setStep('floor_config');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Analysis failed';
      const detail = err.response?.data?.detail;
      setError(detail ? `${msg} — ${detail}` : msg);
      setStep('upload');
    }
  }

  // ── Step: Floor plan config → derive planes ────────────────────────────────

  async function handleDeriveFromFootprint() {
    setError('');
    try {
      const { data } = await axios.post('/api/uploads/derive-planes', {
        footprint,
        roof_style: roofStyle,
        pitch_numerator: pitchNumerator,
      });
      setPlanes(data.planes);
      setLinearFootage(data.linear_footage);
      setStep('review');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not derive roof planes');
    }
  }

  // ── Step: Review confirmed → create estimate ───────────────────────────────

  async function handleConfirmAndGenerate() {
    if (!planes.length) return setError('Add at least one roof plane');
    setError('');
    setStep('creating');

    try {
      const planType = analysisResult?.plan_type || (isAssisted ? 'floor_plan' : 'roof_plan');

      // 1. Create estimate + takeoff
      const { data: created } = await axios.post(`/api/projects/${projectId}/estimates`, {
        plan_type:      planType,
        roof_style:     planType === 'floor_plan' ? roofStyle : undefined,
        scale_ratio:    analysisResult?.scale_ratio,
        planes,
        linear_footage: linearFootage,
        is_reroof:      false,
      });

      // 2. Run calculation with default materials
      await axios.post(`/api/estimates/${created.estimate.id}/calculate`, {});

      // 3. Navigate to the estimate view
      navigate(`/estimates/${created.estimate.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create estimate');
      setStep('review');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="new-estimate-page">
      <div className="ne-header">
        <button className="ne-back" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
        <h1 className="ne-title">New Roofing Estimate</h1>
      </div>

      <StepBar current={step} />

      {error && <div className="ne-error">{error}</div>}

      {/* ── UPLOAD ── */}
      {step === 'upload' && (
        <div className="ne-card">
          <h2>Upload Your House Plans</h2>
          <PlanUpload onFile={setFile} disabled={false} />
          <div className="ne-actions">
            <button
              className="btn-primary"
              onClick={handleUpload}
              disabled={!file}
            >
              Analyze with AI →
            </button>
          </div>
        </div>
      )}

      {/* ── PROCESSING ── */}
      {step === 'processing' && (
        <div className="ne-card">
          <div className="processing-box">
            <div className="spinner" />
            <div style={{ fontWeight: 600, color: '#1a3a5c', fontSize: '1rem' }}>
              AI is reading your plans...
            </div>
            <div style={{ color: '#888', fontSize: '0.875rem', textAlign: 'center', maxWidth: 320 }}>
              Claude is locating the scale key, identifying roof planes, and extracting measurements. This takes 10–30 seconds.
            </div>
          </div>
        </div>
      )}

      {/* ── FLOOR PLAN CONFIG ── */}
      {step === 'floor_config' && (
        <div className="ne-card">
          <h2>Floor Plan Detected — Configure Your Roof</h2>

          {footprint && (
            <div style={{ background: '#f5f7fa', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '0.875rem' }}>
              <strong>Extracted footprint:</strong>{' '}
              {footprint.length} ft × {footprint.width} ft
              {footprint.shape_notes && <span style={{ color: '#888', marginLeft: 6 }}>({footprint.shape_notes})</span>}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 700, color: '#333', marginBottom: 10 }}>
              Roof Style
            </label>
            <div className="style-grid">
              {ROOF_STYLES.map(({ id, label, desc, Svg }) => (
                <button
                  key={id}
                  type="button"
                  className={`style-btn${roofStyle === id ? ' selected' : ''}`}
                  onClick={() => setRoofStyle(id)}
                >
                  <Svg />
                  <div className="style-name">{label}</div>
                  <div className="style-desc">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 700, color: '#333', marginBottom: 10 }}>
              Roof Pitch
            </label>
            <PitchGuide value={pitchNumerator} onChange={setPitchNumerator} />
          </div>

          {analysisResult?.extraction_notes && (
            <div className="extraction-note">
              <strong>AI note:</strong> {analysisResult.extraction_notes}
            </div>
          )}

          <div className="ne-actions">
            <button className="btn-secondary" onClick={() => setStep('upload')}>← Re-upload</button>
            <button className="btn-primary" onClick={handleDeriveFromFootprint}>
              Derive Roof Planes →
            </button>
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {step === 'review' && (
        <div className="ne-card">
          <h2>Review Takeoff Data</h2>
          <p style={{ color: '#666', fontSize: '0.875rem', marginTop: -8, marginBottom: 16 }}>
            Verify all extracted dimensions before generating the estimate. You can edit any value directly in the table.
          </p>

          <TakeoffReview
            planes={planes}
            linearFootage={linearFootage}
            onPlanesChange={setPlanes}
            onLFChange={setLinearFootage}
            isAssisted={isAssisted}
          />

          {analysisResult?.extraction_notes && (
            <div className="extraction-note">
              <strong>AI note:</strong> {analysisResult.extraction_notes}
            </div>
          )}

          <div className="ne-actions">
            <button
              className="btn-secondary"
              onClick={() => setStep(analysisResult?.plan_type === 'floor_plan' ? 'floor_config' : 'upload')}
            >
              ← Back
            </button>
            <button
              className="btn-primary"
              onClick={handleConfirmAndGenerate}
              disabled={!planes.length}
            >
              Confirm &amp; Generate Estimate →
            </button>
          </div>
        </div>
      )}

      {/* ── CREATING ── */}
      {step === 'creating' && (
        <div className="ne-card">
          <div className="processing-box">
            <div className="spinner" />
            <div style={{ fontWeight: 600, color: '#1a3a5c' }}>Generating your estimate...</div>
          </div>
        </div>
      )}
    </div>
  );
}
