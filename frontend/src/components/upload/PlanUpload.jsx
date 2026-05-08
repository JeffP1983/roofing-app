import React, { useRef, useState } from 'react';

const ACCEPTED = '.jpg,.jpeg,.png,.webp,.gif,.pdf';

export default function PlanUpload({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);

  function handleFile(file) {
    if (!file) return;
    setPreview({ name: file.name, size: (file.size / 1024).toFixed(0) + ' KB', isPdf: file.type === 'application/pdf' });
    onFile(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#2d6a9f' : '#ccc'}`,
          borderRadius: 10,
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          background: dragging ? '#f0f5ff' : '#fafafa',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
          disabled={disabled}
        />
        {preview ? (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>
              {preview.isPdf ? '📄' : '🖼️'}
            </div>
            <div style={{ fontWeight: 600, color: '#333' }}>{preview.name}</div>
            <div style={{ color: '#888', fontSize: '0.85rem', marginTop: 4 }}>{preview.size}</div>
            {!disabled && (
              <div style={{ color: '#2d6a9f', fontSize: '0.8rem', marginTop: 8 }}>Click to choose a different file</div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📐</div>
            <div style={{ fontWeight: 600, color: '#333', fontSize: '1rem' }}>
              Drop your house plan here, or click to browse
            </div>
            <div style={{ color: '#888', fontSize: '0.85rem', marginTop: 6 }}>
              Accepts PDF, JPEG, PNG, WebP — up to 20 MB
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
