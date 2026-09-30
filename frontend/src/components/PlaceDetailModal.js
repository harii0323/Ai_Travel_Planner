import React from 'react';
import { 
  X, 
  MapPin, 
  Clock, 
  Wallet, 
  Sun, 
  Star, 
  ExternalLink, 
  Navigation,
  Compass,
  CheckCircle2
} from 'lucide-react';

function PlaceDetailModal({ place, onClose, onAddToDay, currentDay }) {
  if (!place) return null;

  const mapsQuery = encodeURIComponent(place.name || place.destination || '');
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div 
      className="place-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(28, 20, 14, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        overflowY: 'auto'
      }}
    >
      <div 
        className="place-modal-card glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'var(--surface-card, #ffffff)',
          borderRadius: 'var(--radius-lg, 24px)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          border: '1px solid var(--surface-border)'
        }}
      >
        {/* Header */}
        <div style={{
          position: 'relative',
          padding: '26px 28px',
          background: 'linear-gradient(135deg, #ede3d2 0%, #faebd9 100%)',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span className="pill-badge pill-badge-brand" style={{ marginBottom: '8px' }}>
              <MapPin size={12} />
              <span>{place.category || 'Sightseeing & Landmark'}</span>
            </span>
            <h3 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--ink-heading, #1c140e)' }}>
              {place.name}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--ink-muted, #786b60)', marginTop: '2px' }}>
              {place.city || place.state ? `${place.city || ''}, ${place.state || ''}` : 'Featured Tourist Spot'}
            </p>
          </div>

          <button 
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#ffffff',
              color: 'var(--ink-muted, #786b60)',
              border: '1px solid var(--surface-border)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '26px 30px' }}>
          {/* Key Metric Highlights */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '12px',
            marginBottom: '20px',
            padding: '14px 18px',
            background: 'var(--surface-soft, #f4eee2)',
            borderRadius: 'var(--radius-md, 16px)',
            border: '1px solid var(--surface-border)'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)', fontWeight: 700, textTransform: 'uppercase' }}>
                Est. Entry / Cost
              </span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--brand-primary, #c26d38)' }}>
                {place.cost ? `₹${place.cost}` : 'Free / Included'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)', fontWeight: 700, textTransform: 'uppercase' }}>
                Suggested Time
              </span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--ink-heading, #1c140e)' }}>
                {place.duration || '1.5 – 2 Hours'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)', fontWeight: 700, textTransform: 'uppercase' }}>
                Visitor Rating
              </span>
              <strong style={{ display: 'block', fontSize: '16px', color: '#f59e0b' }}>
                ★ {place.rating || '4.7'}/5.0
              </strong>
            </div>
          </div>

          {/* Visual Visit Window Indicator (Requirement #16) */}
          <div style={{
            padding: '16px 20px',
            background: '#ffffff',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md, 14px)',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ink-heading, #1c140e)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Sun size={14} color="#f59e0b" />
              Visit Window Recommendation
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                <span style={{ width: '80px', fontWeight: 700, color: 'var(--ink-body, #332820)' }}>☀ Morning</span>
                <div style={{ flex: 1, height: '8px', background: 'var(--surface-soft, #f4eee2)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: '85%', height: '100%', background: 'var(--emerald-gradient, #10b981)', borderRadius: '9999px' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#047857', fontWeight: 700 }}>Optimal (Cool & Calm)</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                <span style={{ width: '80px', fontWeight: 700, color: 'var(--ink-body, #332820)' }}>🌤 Afternoon</span>
                <div style={{ flex: 1, height: '8px', background: 'var(--surface-soft, #f4eee2)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: '45%', height: '100%', background: 'var(--amber-gradient, #f59e0b)', borderRadius: '9999px' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>Moderate</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                <span style={{ width: '80px', fontWeight: 700, color: 'var(--ink-body, #332820)' }}>🌙 Evening</span>
                <div style={{ flex: 1, height: '8px', background: 'var(--surface-soft, #f4eee2)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: '65%', height: '100%', background: 'var(--azure-gradient, #0284c7)', borderRadius: '9999px' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 700 }}>Great for Sunsets</span>
              </div>
            </div>
          </div>

          {/* Place Description & Notes */}
          <div style={{ marginBottom: '24px' }}>
            <h5 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink-heading, #1c140e)', marginBottom: '6px' }}>
              About this location
            </h5>
            <p style={{ fontSize: '13px', color: 'var(--ink-body, #332820)', lineHeight: 1.6 }}>
              {place.description || place.plan || 'A verified destination highlight known for scenic views, cultural heritage, and memorable travel experiences.'}
            </p>
          </div>

          {/* Modal Footer Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '18px',
            borderTop: '1px solid var(--surface-border)',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <a 
              href={googleMapsUrl} 
              target="_blank" 
              rel="noreferrer"
              className="btn-secondary"
              style={{ minHeight: '40px', padding: '0 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Navigation size={14} color="var(--brand-primary, #c26d38)" />
              <span>Open in Google Maps</span>
              <ExternalLink size={12} />
            </a>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={onClose}
                style={{ minHeight: '40px', padding: '0 16px', fontSize: '13px' }}
              >
                Close
              </button>
              {onAddToDay && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    onAddToDay(place);
                    onClose();
                  }}
                  style={{ minHeight: '40px', padding: '0 18px', fontSize: '13px' }}
                >
                  <CheckCircle2 size={15} />
                  <span>Add to Day {currentDay || 1}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaceDetailModal;
