// Shared tokens & primitives for the audit canvas

const A = {
  // anchor palette = Acid (dominant flavor of the product)
  bg: '#07090A',
  panel: '#0E1112',
  panelHi: '#13181A',
  border: 'rgba(255,255,255,0.08)',
  borderHot: 'rgba(0,255,135,0.35)',
  text: '#F2F4F3',
  textMuted: 'rgba(242,244,243,0.55)',
  textDim: 'rgba(242,244,243,0.32)',
  accent: '#00FF87',
  accentDim: 'rgba(0,255,135,0.14)',
  accentInk: '#04150B',
  warn: '#FFB020',
  danger: '#FF4757',
  // status colors per state
  training: 'rgba(242,244,243,0.45)',
  armed: '#00FF87',
  verified: '#00FF87',
  invalid: '#FF4757',
  pending: '#FFB020',
};

const F = {
  display: '"Rajdhani", "Inter", system-ui, sans-serif',
  body: '"Inter", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
};

// Section header for each artboard
function ArtboardHead({ num, title, sub }) {
  return (
    <div style={{ padding: '36px 48px 24px', borderBottom: `1px solid ${A.border}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
        <span style={{ fontFamily: F.display, fontSize: 56, fontWeight: 700,
          color: A.accent, letterSpacing: '-0.02em', lineHeight: 0.9 }}>{num}</span>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: A.textMuted,
          letterSpacing: '0.3em', fontWeight: 700 }}>SEKCJA {num} / 08</span>
      </div>
      <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 36, fontWeight: 700,
        color: A.text, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>{title}</h2>
      {sub && <p style={{ margin: '10px 0 0', fontFamily: F.body, fontSize: 15,
        color: A.textMuted, maxWidth: 720, lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}

// Two-column body: DZIŚ / PROPOZYCJA
function SplitBody({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
      borderTop: `1px solid ${A.border}`, minHeight: 540 }}>
      {children}
    </div>
  );
}

function Column({ kind, children }) {
  // kind: 'today' | 'proposal'
  const isProp = kind === 'proposal';
  return (
    <div style={{
      padding: '28px 40px 40px',
      borderRight: kind === 'today' ? `1px solid ${A.border}` : 'none',
      background: isProp ? 'linear-gradient(180deg, rgba(0,255,135,0.025), transparent 30%)' : 'transparent',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isProp ? A.accent : A.textDim,
          boxShadow: isProp ? '0 0 12px rgba(0,255,135,0.6)' : 'none',
        }}/>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.32em', color: isProp ? A.accent : A.textMuted }}>
          {kind === 'today' ? 'DZIŚ' : 'PROPOZYCJA'}
        </span>
        {isProp && (
          <span style={{ fontFamily: F.mono, fontSize: 9,
            padding: '2px 8px', border: `1px solid ${A.borderHot}`,
            color: A.accent, letterSpacing: '0.2em', fontWeight: 700 }}>+10/10</span>
        )}
      </div>
      {children}
    </div>
  );
}

// Reusable swatch chip
function Swatch({ color, label, code, size = 56, ring }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: size, height: size,
        background: color, borderRadius: 4,
        boxShadow: ring ? `0 0 0 1px ${A.border}, 0 0 24px ${color}66` : `0 0 0 1px ${A.border}`,
        flexShrink: 0,
      }}/>
      <div>
        <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: A.text,
          textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: A.textMuted,
          letterSpacing: '0.1em', marginTop: 2 }}>{code}</div>
      </div>
    </div>
  );
}

// Verdict footer — what changes
function Verdict({ items }) {
  return (
    <div style={{
      gridColumn: '1 / 3', borderTop: `1px solid ${A.border}`,
      padding: '24px 48px', background: 'rgba(0,255,135,0.03)',
      display: 'flex', alignItems: 'flex-start', gap: 20,
    }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800,
        color: A.accent, letterSpacing: '0.32em', minWidth: 80, paddingTop: 2 }}>VERDICT</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', flex: 1 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontFamily: F.body, fontSize: 14, color: A.text,
            lineHeight: 1.55, marginBottom: 6, display: 'flex', gap: 10 }}>
            <span style={{ color: A.accent, fontWeight: 800 }}>→</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Chip / pill
function Pill({ children, variant = 'neutral' }) {
  const colors = {
    neutral: { bg: 'transparent', fg: A.textMuted, border: A.border },
    accent:  { bg: A.accentDim, fg: A.accent, border: A.borderHot },
    warn:    { bg: 'rgba(255,176,32,0.12)', fg: A.warn, border: 'rgba(255,176,32,0.3)' },
    danger:  { bg: 'rgba(255,71,87,0.12)', fg: A.danger, border: 'rgba(255,71,87,0.3)' },
  };
  const v = colors[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 999,
      background: v.bg, color: v.fg, border: `1px solid ${v.border}`,
      fontFamily: F.mono, fontSize: 10, fontWeight: 800,
      letterSpacing: '0.2em', textTransform: 'uppercase',
    }}>{children}</span>
  );
}

Object.assign(window, { A, F, ArtboardHead, SplitBody, Column, Swatch, Verdict, Pill });
