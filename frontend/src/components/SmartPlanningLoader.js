import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Compass, 
  Route, 
  Clock, 
  Fuel, 
  CheckCircle2, 
  Layers
} from 'lucide-react';

const PLANNING_STAGES = [
  {
    id: 1,
    title: 'Understanding your preferences',
    detail: 'Analyzing travel style, group size, companion dynamic, and budget ceiling...',
    icon: Sparkles
  },
  {
    id: 2,
    title: 'Finding suitable destinations & hotspots',
    detail: 'Cross-referencing verified India tourism databases and scenic corridors...',
    icon: Compass
  },
  {
    id: 3,
    title: 'Analyzing places & cultural attractions',
    detail: 'Evaluating historical sites, viewpoints, local cuisine, and entry tariffs...',
    icon: MapPin
  },
  {
    id: 4,
    title: 'Optimizing the route & highway tolls',
    detail: 'Calculating road distance, FASTag toll plazas, and live road conditions...',
    icon: Route
  },
  {
    id: 5,
    title: 'Arranging activities by visit window',
    detail: 'Scheduling sunrise spots, afternoon indoor attractions, and sunset vistas...',
    icon: Clock
  },
  {
    id: 6,
    title: 'Calculating real-world travel costs',
    detail: 'Computing fuel consumption, accommodation rates, and daily food benchmarks...',
    icon: Fuel
  },
  {
    id: 7,
    title: 'Building your customized itinerary',
    detail: 'Finalizing day-by-day timeline, packing checklist, and weather intelligence...',
    icon: Layers
  }
];

function SmartPlanningLoader({ destination, days }) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    // Progress through the 7 stages smoothly while generation is running
    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev < PLANNING_STAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  const progressPercent = Math.round(((currentStageIndex + 1) / PLANNING_STAGES.length) * 100);
  const activeStage = PLANNING_STAGES[currentStageIndex];
  const ActiveIcon = activeStage.icon;

  return (
    <div className="smart-planning-card glass-panel" style={{
      maxWidth: '740px',
      margin: '0 auto',
      padding: '44px 36px',
      borderRadius: 'var(--radius-lg, 24px)',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-xl)'
    }}>
      {/* Dynamic Animated Core */}
      <div style={{
        position: 'relative',
        width: '96px',
        height: '96px',
        margin: '0 auto 24px',
        display: 'grid',
        placeItems: 'center'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2px dashed var(--brand-400, #e58d4a)',
          animation: 'gyroSpin1 3.5s linear infinite'
        }} />
        <div style={{
          position: 'absolute',
          inset: '-8px',
          borderRadius: '50%',
          border: '2px solid rgba(217, 119, 6, 0.35)',
          borderTopColor: 'var(--brand-primary, #c26d38)',
          animation: 'gyroSpin2 4.5s linear infinite reverse'
        }} />
        <div style={{
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: 'var(--brand-gradient)',
          color: '#ffffff',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 0 24px var(--brand-glow)',
          transform: 'translateZ(10px)'
        }}>
          <ActiveIcon size={26} />
        </div>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <span className="pill-badge pill-badge-brand" style={{ marginBottom: '12px' }}>
          <Sparkles size={13} />
          <span>Stage {currentStageIndex + 1} of {PLANNING_STAGES.length}</span>
        </span>
        <h3 style={{
          fontSize: 'clamp(22px, 3.5vw, 28px)',
          fontWeight: 900,
          color: 'var(--ink-heading, #1c140e)',
          marginBottom: '8px'
        }}>
          {activeStage.title}
        </h3>
        <p style={{
          fontSize: '14px',
          color: 'var(--ink-muted, #786b60)',
          maxWidth: '540px',
          margin: '0 auto',
          lineHeight: 1.5
        }}>
          {destination ? `Crafting your travel plan to ${destination}... ` : ''}
          {activeStage.detail}
        </p>
      </div>

      {/* Progress Bar with Percentage */}
      <div style={{ maxWidth: '480px', margin: '0 auto 32px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--ink-muted, #786b60)',
          marginBottom: '6px'
        }}>
          <span>AI Orchestration</span>
          <span style={{ color: 'var(--brand-primary, #c26d38)' }}>{progressPercent}% Complete</span>
        </div>
        <div style={{
          height: '8px',
          background: 'var(--surface-soft, #f4eee2)',
          borderRadius: '9999px',
          overflow: 'hidden',
          border: '1px solid var(--surface-border)'
        }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'var(--brand-gradient)',
            borderRadius: '9999px',
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 0 12px var(--brand-glow)'
          }} />
        </div>
      </div>

      {/* Animated 7-Stage Pipeline Visualizer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px',
        textAlign: 'left',
        background: 'rgba(255, 255, 255, 0.7)',
        padding: '16px',
        borderRadius: 'var(--radius-md, 16px)',
        border: '1px solid var(--surface-border)'
      }}>
        {PLANNING_STAGES.map((stage, idx) => {
          const isDone = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const StageIcon = stage.icon;

          return (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: isCurrent 
                  ? 'rgba(194, 109, 56, 0.12)' 
                  : isDone 
                    ? 'rgba(16, 185, 129, 0.08)' 
                    : 'transparent',
                border: isCurrent 
                  ? '1px solid var(--brand-primary, #c26d38)' 
                  : isDone 
                    ? '1px solid rgba(16, 185, 129, 0.25)' 
                    : '1px solid transparent',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                fontSize: '11px',
                fontWeight: 800,
                background: isDone 
                  ? 'var(--emerald-500, #10b981)' 
                  : isCurrent 
                    ? 'var(--brand-primary, #c26d38)' 
                    : 'var(--surface-soft, #f4eee2)',
                color: (isDone || isCurrent) ? '#ffffff' : 'var(--ink-muted, #786b60)'
              }}>
                {isDone ? <CheckCircle2 size={14} /> : <StageIcon size={12} />}
              </div>
              <span style={{
                fontSize: '12px',
                fontWeight: isCurrent ? 800 : 600,
                color: isCurrent 
                  ? 'var(--brand-primary, #c26d38)' 
                  : isDone 
                    ? 'var(--ink-heading, #1c140e)' 
                    : 'var(--ink-muted, #786b60)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {stage.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SmartPlanningLoader;
