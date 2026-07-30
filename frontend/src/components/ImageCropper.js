import React, { useState, useRef, useEffect } from 'react';
import Button from './Button';

const ImageCropper = ({ imageSrc, onCrop, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [imageSrc]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.current.x,
      y: e.touches[0].clientY - dragStart.current.y
    });
  };

  const handleConfirm = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1200;
    canvas.height = 900;

    const img = imgRef.current;
    const container = containerRef.current;

    if (!img || !container) return;

    const rect = container.getBoundingClientRect();
    const scaleFactor = 1280 / rect.width;

    const destWidth = img.clientWidth * zoom * scaleFactor;
    const destHeight = img.clientHeight * zoom * scaleFactor;
    
    const destX = offset.x * scaleFactor;
    const destY = offset.y * scaleFactor;

    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(img, destX, destY, destWidth, destHeight);

    canvas.toBlob((blob) => {
      onCrop(blob);
    }, 'image/jpeg', 0.95);
  };

  return (
    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
      <h3 style={{ marginBottom: '12px', fontSize: '1.2rem' }}>Adjust Thumbnail (4:3 Ratio)</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Drag to position the image inside the frame, then adjust the zoom slider.</p>
      
      <div 
        ref={containerRef}
        style={{ 
          width: '100%', 
          aspectRatio: '4/3', 
          position: 'relative', 
          overflow: 'hidden', 
          background: '#000', 
          borderRadius: '8px', 
          cursor: isDragging ? 'grabbing' : 'grab',
          border: '1px solid var(--accent-primary)',
          touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <img 
          ref={imgRef}
          src={imageSrc} 
          alt="Cropper preview" 
          draggable="false"
          style={{ 
            position: 'absolute', 
            left: `${offset.x}px`, 
            top: `${offset.y}px`, 
            width: `${100 * zoom}%`, 
            height: 'auto',
            pointerEvents: 'none',
            display: 'block'
          }}
        />
      </div>

      <div style={{ margin: '20px 0' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
          <span>Zoom</span>
          <span>{Math.round(zoom * 100)}%</span>
        </label>
        <input 
          type="range" 
          min="1" 
          max="4" 
          step="0.05" 
          value={zoom} 
          onChange={e => setZoom(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <Button variant="default" onClick={onCancel} style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}>Cancel</Button>
        <Button variant="primary" onClick={handleConfirm} style={{ flex: 1 }}>Save Thumbnail</Button>
      </div>
    </div>
  );
};

export default ImageCropper;
