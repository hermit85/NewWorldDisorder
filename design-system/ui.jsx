// ui.jsx — shared primitives: Btn, Card, Pill, StatBox, Icon, Row, Stack, Glow

// Tiny custom icon set — line icons, inherits color via currentColor.
const Icon = ({ name, size = 20, stroke = 1.8, color = 'currentColor', style }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  switch (name) {
    case 'arrow-left': return (
      <svg {...props}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>);
    case 'arrow-right': return (
      <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
    case 'arrow-up': return (
      <svg {...props}><path d="M12 19V5M6 11l6-6 6 6"/></svg>);
    case 'arrow-down': return (
      <svg {...props}><path d="M12 5v14M6 13l6 6 6-6"/></svg>);
    case 'chevron-right': return (
      <svg {...props}><path d="M9 6l6 6-6 6"/></svg>);
    case 'chevron-down': return (
      <svg {...props}><path d="M6 9l6 6 6-6"/></svg>);
    case 'check': return (
      <svg {...props}><path d="M5 12l5 5L20 7"/></svg>);
    case 'x': return (
      <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>);
    case 'plus': return (
      <svg {...props}><path d="M12 5v14M5 12h14"/></svg>);
    case 'home': return (
      <svg {...props}><path d="M3 11l9-8 9 8M5 9v11h14V9"/></svg>);
    case 'pin': return (
      <svg {...props}><path d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>);
    case 'trophy': return (
      <svg {...props}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3"/></svg>);
    case 'rider': return (
      <svg {...props}><circle cx="12" cy="6" r="3"/><path d="M5 21v-3a4 4 0 014-4h6a4 4 0 014 4v3"/></svg>);
    case 'gauge': return (
      <svg {...props}><path d="M12 14l4-4M3 12a9 9 0 0118 0v6H3v-6z"/></svg>);
    case 'flag': return (
      <svg {...props}><path d="M5 22V4M5 4h13l-2 4 2 4H5"/></svg>);
    case 'bolt': return (
      <svg {...props}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>);
    case 'gps': return (
      <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>);
    case 'route': return (
      <svg {...props}><path d="M6 19l4-12 4 8 4-4"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="11" r="2"/></svg>);
    case 'mountain': return (
      <svg {...props}><path d="M3 20l6-10 4 6 3-4 5 8H3z"/></svg>);
    case 'wind': return (
      <svg {...props}><path d="M3 8h12a3 3 0 100-6M3 16h16a3 3 0 110 6"/></svg>);
    case 'clock': return (
      <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case 'play': return (
      <svg {...props} fill={color} stroke="none"><path d="M7 5v14l11-7z"/></svg>);
    case 'helmet': return (
      <svg {...props}><path d="M4 14a8 8 0 0116 0v3H4v-3z"/><path d="M4 17h16M9 7l-2 4M14 6l3 5"/></svg>);
    case 'help': return (
      <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4M12 17.5v.1"/></svg>);
    case 'settings': return (
      <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.7a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1c.6.5 1.3.9 2 1.2L10 21h4l.5-2.7a7 7 0 002-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>);
    case 'search': return (
      <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>);
    case 'spark': return (
      <svg {...props}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>);
    case 'ghost': return (
      <svg {...props}><path d="M5 21V11a7 7 0 0114 0v10l-2-2-2 2-2-2-2 2-2-2-2 2-2-2z"/><circle cx="9" cy="11" r="1" fill={color}/><circle cx="15" cy="11" r="1" fill={color}/></svg>);
    case 'fire': return (
      <svg {...props}><path d="M12 2s4 4 4 8a4 4 0 11-8 0c0-2 1-3 1-3s-2 2-2 5a5 5 0 0010 0c0-5-5-10-5-10z"/></svg>);
    case 'medal': return (
      <svg {...props}><circle cx="12" cy="15" r="6"/><path d="M8 9L6 3h12l-2 6"/></svg>);
    case 'share': return (
      <svg {...props}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/></svg>);
    case 'discord': return (
      <svg {...props}><circle cx="12" cy="12" r="9"/></svg>);
    case 'broadcast': return (
      <svg {...props}><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 010 8.4M7.8 7.8a6 6 0 000 8.4M19 5a10 10 0 010 14M5 5a10 10 0 000 14"/></svg>);
    case 'circle': return (
      <svg {...props}><circle cx="12" cy="12" r="9"/></svg>);
    case 'circle-fill': return (
      <svg {...props} fill={color} stroke="none"><circle cx="12" cy="12" r="9"/></svg>);
    case 'tag': return (
      <svg {...props}><path d="M3 12V3h9l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.2" fill={color}/></svg>);
    case 'sparkle': return (
      <svg {...props}><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>);
    default: return null;
  }
};

// Button — primary fills with accent, ghost is outlined, danger/warn variants.
function Btn({ variant = 'primary', size = 'md', fullWidth = true, icon, children, onClick, disabled, glow = true, c, t, style = {} }) {
  const heights = { sm: 38, md: 48, lg: 56 };
  const fontSizes = { sm: 12, md: 13, lg: 14 };
  const h = heights[size];
  const base = {
    appearance: 'none', border: 0, outline: 0, cursor: disabled ? 'not-allowed' : 'pointer',
    height: h, width: fullWidth ? '100%' : 'auto', padding: '0 22px',
    borderRadius: h / 2, fontFamily: t.body, fontSize: fontSizes[size], fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    transition: 'transform 120ms ease, filter 120ms ease, opacity 120ms ease',
    opacity: disabled ? 0.4 : 1,
    ...style,
  };
  if (variant === 'primary') Object.assign(base, {
    background: c.accent, color: c.accentInk,
    boxShadow: glow ? c.glow + ', inset 0 1px 0 rgba(255,255,255,0.25)' : 'inset 0 1px 0 rgba(255,255,255,0.25)',
  });
  if (variant === 'ghost') Object.assign(base, {
    background: 'transparent', color: c.text, border: `1.5px solid ${c.border}`,
  });
  if (variant === 'outline') Object.assign(base, {
    background: 'transparent', color: c.accent, border: `1.5px solid ${c.borderHi}`,
  });
  if (variant === 'subtle') Object.assign(base, {
    background: c.bgCardHi, color: c.text,
  });
  if (variant === 'danger') Object.assign(base, {
    background: 'transparent', color: c.danger, border: `1.5px solid ${c.danger}`,
  });
  return (
    <button style={base} onClick={onClick} disabled={disabled}
            onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 18} />}
      {children}
    </button>
  );
}

// Card — base container with subtle border and elevated bg.
function Card({ children, c, d, style = {}, hi = false, glow = false, onClick, padding }) {
  const p = padding != null ? padding : d.pad;
  return (
    <div onClick={onClick} style={{
      background: hi ? c.bgCardHi : c.bgCard,
      border: `1px solid ${hi ? c.borderHi : c.border}`,
      borderRadius: d.cardRadius,
      padding: p,
      boxShadow: glow ? c.glowSoft : 'none',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 200ms ease, transform 120ms ease',
      ...style,
    }}>{children}</div>
  );
}

// Pill — small inline label
function Pill({ children, c, t, tone = 'default', size = 'sm', icon, style = {} }) {
  const tones = {
    default: { bg: c.bgCardHi, fg: c.textMuted, bd: 'transparent' },
    accent: { bg: c.accentDim, fg: c.accent, bd: 'transparent' },
    accentSolid: { bg: c.accent, fg: c.accentInk, bd: 'transparent' },
    warn: { bg: 'rgba(255,176,32,0.12)', fg: c.warn, bd: 'transparent' },
    danger: { bg: 'rgba(255,71,87,0.12)', fg: c.danger, bd: 'transparent' },
    outline: { bg: 'transparent', fg: c.text, bd: c.border },
  };
  const tn = tones[tone];
  const heights = { xs: 20, sm: 24, md: 28 };
  const fs = { xs: 9, sm: 10, md: 11 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: heights[size], padding: '0 10px',
      borderRadius: heights[size] / 2,
      background: tn.bg, color: tn.fg,
      border: `1px solid ${tn.bd}`,
      fontFamily: t.mono, fontSize: fs[size], fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon && <Icon name={icon} size={fs[size] + 4} />}
      {children}
    </span>
  );
}

// StatBox — labeled metric tile (used everywhere)
function StatBox({ label, value, unit, c, t, d, accent = false, big = false, sub, style = {} }) {
  return (
    <div style={{
      background: c.bgCard, border: `1px solid ${c.border}`,
      borderRadius: d.radius, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
      ...style,
    }}>
      <div style={{ fontFamily: t.mono, fontSize: 9.5, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: c.textDim }}>{label}</div>
      <div style={{
        fontFamily: t.display, fontWeight: 700,
        fontSize: big ? 32 : 22,
        lineHeight: 1, color: accent ? c.accent : c.text,
        letterSpacing: t.displayTracking,
        display: 'flex', alignItems: 'baseline', gap: 4,
      }}>
        {value}
        {unit && <span style={{ fontSize: big ? 14 : 11, color: c.textMuted, fontWeight: 500 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim, letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  );
}

// Section header — small tag-style label with optional count
function SectionHead({ icon, label, count, action, c, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      {icon && <Icon name={icon} size={13} color={c.accent} stroke={2.4} />}
      <div style={{ flex: 1, fontFamily: t.mono, fontSize: 10.5, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: c.text }}>{label}</div>
      {count != null && <div style={{ fontFamily: t.mono, fontSize: 10,
        color: c.textDim, letterSpacing: '0.08em' }}>{count}</div>}
      {action}
    </div>
  );
}

// Page title — large display title
function PageTitle({ kicker, title, subtitle, c, t, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {kicker && (
        <div style={{ fontFamily: t.mono, fontSize: 10.5, fontWeight: 700,
          letterSpacing: '0.22em', textTransform: 'uppercase', color: c.accent }}>{kicker}</div>
      )}
      <h1 style={{ margin: 0, fontFamily: t.display, fontWeight: 800,
        fontSize: 42, lineHeight: 0.95, color: c.text,
        letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>{title}</h1>
      {subtitle && <div style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.4, marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

// Top bar — back button + optional trailing
function TopBar({ onBack, title, trailing, c, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 12px' }}>
      {onBack && (
        <button onClick={onBack} style={{
          width: 38, height: 38, borderRadius: 19, border: `1px solid ${c.border}`,
          background: c.bgCard, color: c.text, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        }}>
          <Icon name="arrow-left" size={18} />
        </button>
      )}
      {title && <div style={{ flex: 1, fontFamily: t.mono, fontSize: 11,
        fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: c.textMuted }}>{title}</div>}
      {!title && <div style={{ flex: 1 }} />}
      {trailing}
    </div>
  );
}

// Bottom tab bar
function TabBar({ active, onChange, c, t }) {
  const tabs = [
    { id: 'home', label: 'Start', icon: 'home' },
    { id: 'spots', label: 'Spoty', icon: 'pin' },
    { id: 'board', label: 'Tablica', icon: 'trophy' },
    { id: 'rider', label: 'Rider', icon: 'rider' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
      padding: '8px 8px 28px', background: c.bg,
      borderTop: `1px solid ${c.border}`,
      backdropFilter: 'blur(12px)',
    }}>
      {tabs.map(tb => {
        const on = active === tb.id;
        return (
          <button key={tb.id} onClick={() => onChange(tb.id)} style={{
            flex: 1, background: 'transparent', border: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '8px 4px', color: on ? c.accent : c.textMuted,
            position: 'relative',
          }}>
            <Icon name={tb.icon} size={20} stroke={on ? 2.2 : 1.8} />
            <div style={{ fontFamily: t.mono, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase' }}>{tb.label}</div>
            {on && <div style={{ position: 'absolute', bottom: -8, height: 3, width: 24,
              background: c.accent, borderRadius: 2, boxShadow: c.glowSoft }} />}
          </button>
        );
      })}
    </div>
  );
}

// Background grid — subtle technical pattern
function GridBg({ c, opacity = 0.5 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', opacity,
      backgroundImage: `linear-gradient(${c.border} 1px, transparent 1px), linear-gradient(90deg, ${c.border} 1px, transparent 1px)`,
      backgroundSize: '32px 32px',
      maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
    }} />
  );
}

// Animated pulse dot
function PulseDot({ color, size = 8, style = {} }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, ...style }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color,
        animation: 'pulse-ring 1.6s ease-out infinite', opacity: 0.6 }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
    </span>
  );
}

Object.assign(window, {
  Icon, Btn, Card, Pill, StatBox, SectionHead, PageTitle, TopBar, TabBar, GridBg, PulseDot,
});
