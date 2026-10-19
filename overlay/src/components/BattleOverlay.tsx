import React from 'react';
import useBattleSocket from '../hooks/useBattleSocket';

const BattleOverlay: React.FC = () => {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const channel = params.get('channel') || '';
  const { status, snapshot } = useBattleSocket(channel);

  if (!status.active) {
    return <div id="battle-overlay" data-channel={channel} />;
  }

  const hpA = snapshot?.hpA ?? 0;
  const hpB = snapshot?.hpB ?? 0;
  const last = snapshot?.lastAction;

  return (
    <div
      id="battle-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        textShadow: '0 0 6px rgba(0,0,0,0.8)',
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
      }}
      data-channel={channel}
    >
      <div style={{ width: 600, background: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>Team A</div>
          <div>Team B</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, background: '#333', height: 24, borderRadius: 4 }}>
            <div
              style={{
                height: '100%',
                width: `${(hpA / 10000) * 100}%`,
                background: 'linear-gradient(90deg,#4ade80,#16a34a)',
                transition: 'width 400ms ease'
              }}
            />
          </div>
          <div style={{ flex: 1, background: '#333', height: 24, borderRadius: 4 }}>
            <div
              style={{
                height: '100%',
                width: `${(hpB / 10000) * 100}%`,
                background: 'linear-gradient(90deg,#fb7185,#ef4444)',
                transition: 'width 400ms ease'
              }}
            />
          </div>
        </div>
        <div style={{ minHeight: 20 }}>{last ? `${last.text} -${last.amount}` : ''}</div>
      </div>
    </div>
  );
};

export default BattleOverlay;

