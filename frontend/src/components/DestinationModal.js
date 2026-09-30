import React from 'react';
import { 
  X, 
  MapPin, 
  Sparkles, 
  Compass, 
  Calendar, 
  Wallet, 
  CheckCircle2, 
  Sun, 
  Navigation,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

function DestinationModal({ destination, onClose, onPlanTrip }) {
  if (!destination) return null;

  return (
    <div 
      className="destination-modal-backdrop" 
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
        className="destination-modal-card glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '720px',
          background: 'var(--surface-card, #ffffff)',
          borderRadius: 'var(--radius-lg, 24px)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          border: '1px solid var(--surface-border)'
        }}
      >
        {/* Destination Image Hero */}
        <div style={{
          position: 'relative',
          height: '260px',
          background: `url(${destination.image || 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800'}) center/cover no-repeat`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)'
          }} />

          {/* Close button */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.9)',
              color: 'var(--ink-heading, #1c140e)',
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {destination.tag || 'Trending Destination'}
            </span>

            <button 
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.5)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <X size={18} />
            </button>
          </div>

          {/* Title & Headline */}
          <div style={{ position: 'relative', zIndex: 2, color: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '24px' }}>{destination.emoji || '📍'}</span>
              <h2 style={{ fontSize: '28px', fontWeight: 900, textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                {destination.title || destination.destination}
              </h2>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', maxWidth: '580px' }}>
              {destination.description}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '28px 32px' }}>
          {/* Quick Metrics Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '12px',
            marginBottom: '24px',
            padding: '14px 18px',
            background: 'var(--surface-soft, #f4eee2)',
            borderRadius: 'var(--radius-md, 16px)',
            border: '1px solid var(--surface-border)'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)', fontWeight: 700, textTransform: 'uppercase' }}>Est. Budget</span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--brand-primary, #c26d38)' }}>
                ₹{destination.budget?.toLocaleString('en-IN') || '7,500'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)', fontWeight: 700, textTransform: 'uppercase' }}>Ideal Duration</span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--ink-heading, #1c140e)' }}>
                {destination.days || 4} Days
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)', fontWeight: 700, textTransform: 'uppercase' }}>Best Season</span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--ink-heading, #1c140e)' }}>
                {destination.bestSeason || 'Oct – Mar'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-muted, #786b60)', fontWeight: 700, textTransform: 'uppercase' }}>Rating</span>
              <strong style={{ display: 'block', fontSize: '16px', color: '#f59e0b' }}>
                ★ {destination.rating || '4.8'}/5.0
              </strong>
            </div>
          </div>

          {/* Highlights & Top Attractions */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink-heading, #1c140e)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--brand-primary, #c26d38)" />
              Top Highlights & Experiences
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {(destination.highlights || [
                'Scenic viewpoint trails and photography spots',
                'Curated local street food & regional cuisine',
                'Heritage walking tours & cultural exploration',
                'Sunset beach / valley relaxation hubs'
              ]).map((highlight, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--ink-body, #332820)',
                  background: 'var(--surface-soft, #f4eee2)',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--surface-border)'
                }}>
                  <CheckCircle2 size={16} color="var(--emerald-500, #10b981)" style={{ flexShrink: 0 }} />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '20px',
            borderTop: '1px solid var(--surface-border)',
            gap: '14px'
          }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
              style={{ minHeight: '44px', padding: '0 20px' }}
            >
              Close
            </button>

            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => {
                onClose();
                if (onPlanTrip) onPlanTrip(destination);
              }}
              style={{ minHeight: '44px', padding: '0 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <span>Build AI Itinerary for {destination.destination?.split(',')[0] || destination.destination}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DestinationModal;
