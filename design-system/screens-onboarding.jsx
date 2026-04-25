// screens-onboarding.jsx — onboarding (3 slajdy) + auth + login code
// Bogaty wizualnie: animowane SVG line art per slajd zamiast pustego tła.

function OnboardingSlide({ slide, idx, total, c, t, d, onNext, motion }) {
  // Each slide gets a custom hero illustration — line art, on-brand.
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: `12px ${d.pad}px ${d.pad}px`, color: c.text, position: 'relative',
      overflow: 'hidden',
    }}>
      <GridBg c={c} opacity={0.35} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28, position: 'relative' }}>
        <div style={{ fontFamily: t.mono, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.32em', color: c.accent, textTransform: 'uppercase' }}>
          {slide.kicker}
        </div>
        <div style={{ fontFamily: t.mono, fontSize: 11, color: c.textMuted, letterSpacing: '0.1em' }}>
          <span style={{ color: c.accent, fontWeight: 700 }}>0{idx + 1}</span>
          <span style={{ opacity: 0.5 }}> / 0{total}</span>
        </div>
      </div>

      <h1 style={{
        margin: 0, fontFamily: t.display, fontWeight: 800,
        fontSize: 32, lineHeight: 1.0, color: c.text,
        letterSpacing: t.displayTracking, textTransform: 'uppercase',
        position: 'relative', whiteSpace: 'pre-line',
      }}>{slide.title}</h1>
      <p style={{
        margin: '16px 0 0', fontSize: 15, lineHeight: 1.45, color: c.textMuted,
        maxWidth: 320, position: 'relative',
      }}>{slide.body}</p>

      {/* Hero illustration */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '24px 0', position: 'relative' }}>
        {slide.hero(c, t, motion)}
      </div>

      {/* Pager dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 18, position: 'relative' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            height: 4, borderRadius: 2,
            width: i === idx ? 24 : 8,
            background: i === idx ? c.accent : c.border,
            transition: 'all 300ms ease',
            boxShadow: i === idx ? c.glowSoft : 'none',
          }} />
        ))}
      </div>

      <Btn c={c} t={t} variant="primary" size="lg" onClick={onNext}
        icon={idx === total - 1 ? 'bolt' : null}>
        {slide.cta}
      </Btn>
    </div>
  );
}

// =====================================================================================
// GAME-STYLE HEROES — race intro, vs screen, telemetry HUD. Forza/Trials DNA.
// Big race numbers, scan lines, holographic gates, glitch ticks, particle fields.
// =====================================================================================

// Shared: scan lines overlay component (full SVG width)
const ScanLines = ({ c, w = 340, h = 380, opacity = 0.08 }) => (
  <g opacity={opacity}>
    {Array.from({ length: Math.floor(h / 3) }).map((_, i) => (
      <line key={'sl-' + i} x1="0" y1={i * 3} x2={w} y2={i * 3}
        stroke={c.text} strokeWidth="0.5"/>
    ))}
  </g>
);

// Shared: corner brackets (game UI marker)
const Corner = ({ x, y, c, size = 12, side }) => {
  const dirs = {
    tl: `M${x} ${y + size} L${x} ${y} L${x + size} ${y}`,
    tr: `M${x - size} ${y} L${x} ${y} L${x} ${y + size}`,
    bl: `M${x} ${y - size} L${x} ${y} L${x + size} ${y}`,
    br: `M${x - size} ${y} L${x} ${y} L${x} ${y - size}`,
  };
  return <path d={dirs[side]} fill="none" stroke={c.accent} strokeWidth="1.5" strokeLinecap="round"/>;
};

// =====================================================================================
// SLIDE 1 — RACE INTRO. Big "01" race number, holographic start gate in perspective,
// particle field, scan lines, system text in corners.
// =====================================================================================
const heroTrack = (c, t, motion) => (
  <svg viewBox="0 0 340 380" width="100%" height="100%" style={{ maxWidth: 380 }}>
    <defs>
      <linearGradient id="raceNumberFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c.text} stopOpacity="0.06"/>
        <stop offset="1" stopColor={c.text} stopOpacity="0.015"/>
      </linearGradient>
      <linearGradient id="gateGlow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c.accent} stopOpacity="1"/>
        <stop offset="1" stopColor={c.accent} stopOpacity="0.3"/>
      </linearGradient>
      <radialGradient id="hotspot" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={c.accent} stopOpacity="0.35"/>
        <stop offset="1" stopColor={c.accent} stopOpacity="0"/>
      </radialGradient>
      <filter id="hardGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4"/>
      </filter>
    </defs>

    {/* hotspot behind gate */}
    <ellipse cx="170" cy="220" rx="160" ry="100" fill="url(#hotspot)"/>

    {/* MASSIVE race number "01" — bleeds, half-visible, racing-jersey style */}
    <text x="170" y="280" fill="url(#raceNumberFade)" fontFamily={t.display}
      fontSize="320" fontWeight="900" textAnchor="middle"
      letterSpacing="-12">01</text>

    {/* Perspective floor grid — vanishing point center back */}
    <g opacity="0.4" stroke={c.accent} strokeWidth="0.8" fill="none">
      {/* horizontal receding lines */}
      {[
        { y: 320, op: 0.9 },
        { y: 290, op: 0.7 },
        { y: 270, op: 0.5 },
        { y: 256, op: 0.3 },
        { y: 246, op: 0.2 },
      ].map((l, i) => (
        <line key={'hg-' + i} x1="20" y1={l.y} x2="320" y2={l.y} opacity={l.op}/>
      ))}
      {/* vanishing perspective lines */}
      {[
        [20, 320], [60, 320], [100, 320], [140, 320],
        [200, 320], [240, 320], [280, 320], [320, 320],
      ].map(([x, y], i) => (
        <line key={'vg-' + i} x1={x} y1={y} x2={170} y2="240" opacity="0.5"/>
      ))}
    </g>

    {/* HOLOGRAPHIC START GATE — perspective trapezoid */}
    {/* glow halo */}
    <g style={motion ? { filter: 'url(#hardGlow)' } : {}} opacity="0.7">
      <path d="M 90 290 L 250 290 L 230 180 L 110 180 Z"
        fill="none" stroke={c.accent} strokeWidth="3"/>
    </g>

    {/* gate frame — solid */}
    <path d="M 90 290 L 250 290" stroke={c.accent} strokeWidth="3" strokeLinecap="square"/>
    <path d="M 110 180 L 230 180" stroke={c.accent} strokeWidth="2.5" strokeLinecap="square"/>
    <line x1="90" y1="290" x2="110" y2="180" stroke={c.accent} strokeWidth="2.5"/>
    <line x1="250" y1="290" x2="230" y2="180" stroke={c.accent} strokeWidth="2.5"/>

    {/* gate banner top */}
    <rect x="110" y="172" width="120" height="14" fill={c.accent}/>
    <text x="170" y="183" fill={c.bg} fontFamily={t.mono} fontSize="9" fontWeight="800"
      textAnchor="middle" letterSpacing="3">START GATE</text>

    {/* gate light bars on posts */}
    {motion && [220, 240, 260, 280].map((y, i) => (
      <g key={'lb-' + i}>
        <rect x="92" y={y - 2} width="6" height="3" fill={c.accent}
          style={{ animation: `gateLight 1.2s ease-in-out ${i * 0.15}s infinite` }}/>
        <rect x="242" y={y - 2} width="6" height="3" fill={c.accent}
          style={{ animation: `gateLight 1.2s ease-in-out ${i * 0.15 + 0.1}s infinite` }}/>
      </g>
    ))}

    {/* center beam — pulsing */}
    <line x1="170" y1="180" x2="170" y2="290" stroke={c.accent} strokeWidth="1"
      strokeDasharray="2 3" opacity="0.5"
      style={motion ? { animation: 'breathe 1.4s ease-in-out infinite' } : {}}/>

    {/* particle sparks rising from gate base */}
    {motion && [110, 145, 175, 195, 230, 250].map((x, i) => (
      <circle key={'sp-' + i} cx={x} cy="285" r="1.5" fill={c.accent}
        style={{ animation: `spark 2.8s ease-out ${i * 0.4}s infinite` }}/>
    ))}

    {/* scan lines overlay */}
    <ScanLines c={c} w="340" h="380" opacity={0.06}/>

    {/* CORNER BRACKETS — game HUD style */}
    <Corner x="14" y="14" c={c} size="14" side="tl"/>
    <Corner x="326" y="14" c={c} size="14" side="tr"/>
    <Corner x="14" y="366" c={c} size="14" side="bl"/>
    <Corner x="326" y="366" c={c} size="14" side="br"/>

    {/* SYSTEM TEXT — corners (race-game energy) */}
    <g fontFamily={t.mono} fontSize="8" fontWeight="700" letterSpacing="2">
      {/* TL */}
      <g transform="translate(28, 28)">
        <circle cx="0" cy="-3" r="3" fill={c.accent}
          style={motion ? { animation: 'breathe 1s ease-in-out infinite' } : {}}/>
        <text x="8" y="0" fill={c.accent}>REC</text>
      </g>
      {/* TR */}
      <text x="312" y="28" fill={c.textMuted} textAnchor="end">SIGNAL · 4G</text>

      {/* BL */}
      <g transform="translate(28, 358)">
        <text x="0" y="0" fill={c.textMuted}>ROUND</text>
        <text x="0" y="-12" fill={c.accent} fontFamily={t.display} fontSize="14" fontWeight="800">01/03</text>
      </g>
      {/* BR */}
      <g transform="translate(312, 358)" textAnchor="end">
        <text x="0" y="0" fill={c.textMuted}>BIKE PARK</text>
        <text x="0" y="-12" fill={c.text} fontFamily={t.display} fontSize="14" fontWeight="800">SZCZYRK</text>
      </g>
    </g>

    {/* glitch sweep — animated horizontal scan line */}
    {motion && (
      <line x1="0" y1="0" x2="340" y2="0" stroke={c.accent} strokeWidth="1.5"
        opacity="0.6" style={{ animation: 'glitchScan 4.2s ease-in-out infinite' }}/>
    )}
  </svg>
);

// =====================================================================================
// SLIDE 2 — RACE TELEMETRY HUD. Live race readout from a finished run.
// Splits ticking up, lap counter, gates passed, "VERIFIED" badge that lights up.
// =====================================================================================
const heroValidation = (c, t, motion) => (
  <svg viewBox="0 0 340 380" width="100%" height="100%" style={{ maxWidth: 380 }}>
    <defs>
      <linearGradient id="hudPanel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c.surface} stopOpacity="0.6"/>
        <stop offset="1" stopColor={c.surface} stopOpacity="0.2"/>
      </linearGradient>
      <filter id="verifyGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3"/>
      </filter>
    </defs>

    {/* corner brackets */}
    <Corner x="14" y="14" c={c} size="14" side="tl"/>
    <Corner x="326" y="14" c={c} size="14" side="tr"/>
    <Corner x="14" y="366" c={c} size="14" side="bl"/>
    <Corner x="326" y="366" c={c} size="14" side="br"/>

    {/* TOP STRIP — like a race game header */}
    <rect x="20" y="22" width="300" height="22" fill={c.surface} stroke={c.border} strokeWidth="1"/>
    <line x1="20" y1="34" x2="20" y2="44" stroke={c.accent} strokeWidth="3"/>
    <text x="30" y="38" fill={c.accent} fontFamily={t.mono} fontSize="9" fontWeight="800" letterSpacing="2">RUN VERIFIED</text>
    <g transform="translate(310, 33)" textAnchor="end">
      <circle cx="-66" cy="0" r="3" fill={c.accent}
        style={motion ? { animation: 'breathe 1s ease-in-out infinite' } : {}}/>
      <text x="-58" y="3" fill={c.text} fontFamily={t.mono} fontSize="9" fontWeight="700" letterSpacing="2">LIVE</text>
      <text x="0" y="3" fill={c.textMuted} fontFamily={t.mono} fontSize="9" letterSpacing="2">02:42:18 PM</text>
    </g>

    {/* MAIN PANEL — split into telemetry blocks */}
    <rect x="20" y="56" width="300" height="220" fill="url(#hudPanel)" stroke={c.border} strokeWidth="1"/>

    {/* big TIME readout */}
    <g transform="translate(170, 102)" textAnchor="middle">
      <text fill={c.textMuted} fontFamily={t.mono} fontSize="9" fontWeight="700" letterSpacing="3">FINAL TIME</text>
      <text y="40" fill={c.text} fontFamily={t.display} fontSize="56" fontWeight="900" letterSpacing="-1">02:14.83</text>
      <g transform="translate(0, 60)">
        <text fill={c.accent} fontFamily={t.mono} fontSize="10" fontWeight="800" letterSpacing="2">−1.42 PB</text>
      </g>
    </g>

    {/* SPLITS column - left */}
    <g transform="translate(34, 184)" fontFamily={t.mono}>
      <text x="0" y="0" fill={c.accent} fontSize="8" fontWeight="800" letterSpacing="2">SPLITS</text>
      {[
        ['G1', '00:14.2', '−0.3'],
        ['G2', '00:31.8', '−0.5'],
        ['G3', '00:48.5', '−0.4'],
        ['G4', '01:32.1', '−0.2'],
      ].map(([g, time, delta], i) => (
        <g key={'sp-' + i} transform={`translate(0, ${14 + i * 14})`}>
          <text x="0" y="0" fill={c.text} fontSize="9" fontWeight="800">{g}</text>
          <text x="20" y="0" fill={c.textMuted} fontSize="9">{time}</text>
          <text x="74" y="0" fill={c.accent} fontSize="9" fontWeight="700">{delta}</text>
        </g>
      ))}
    </g>

    {/* CHECKS column - right */}
    <g transform="translate(208, 184)" fontFamily={t.mono}>
      <text x="0" y="0" fill={c.accent} fontSize="8" fontWeight="800" letterSpacing="2">VALIDATION</text>
      {[
        ['GPS LOCK', 'OK'],
        ['START GATE', 'OK'],
        ['ON LINE', 'OK'],
        ['FINISH', 'OK'],
      ].map(([label, status], i) => (
        <g key={'ck-' + i} transform={`translate(0, ${14 + i * 14})`}>
          <text x="0" y="0" fill={c.text} fontSize="9" fontWeight="700">{label}</text>
          <g transform="translate(78, -3)">
            <circle r="4" fill={c.accent}/>
            <path d="M-2 0 L-0.5 1.5 L2 -1.5" stroke={c.bg} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
          <text x="92" y="0" fill={c.accent} fontSize="9" fontWeight="800">{status}</text>
        </g>
      ))}
    </g>

    {/* graph track at bottom of panel — speed line over time */}
    <g transform="translate(20, 232)">
      <text x="14" y="-2" fill={c.textMuted} fontFamily={t.mono} fontSize="7" fontWeight="700" letterSpacing="2">SPEED</text>
      <text x="284" y="-2" fill={c.textMuted} fontFamily={t.mono} fontSize="7" letterSpacing="2" textAnchor="end">52 KM/H AVG</text>
      <path d="M14 36 L40 30 L60 22 L82 28 L106 16 L130 20 L156 12 L182 18 L208 10 L232 14 L258 8 L286 12"
        fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round"
        style={motion ? { animation: 'breathe 2s ease-in-out infinite' } : {}}/>
      <path d="M14 36 L40 30 L60 22 L82 28 L106 16 L130 20 L156 12 L182 18 L208 10 L232 14 L258 8 L286 12 L286 42 L14 42 Z"
        fill={c.accent} opacity="0.15"/>
    </g>

    {/* LARGE VERIFIED BADGE — bottom */}
    <g transform="translate(170, 318)" textAnchor="middle">
      <g style={motion ? { filter: 'url(#verifyGlow)' } : {}} opacity="0.8">
        <rect x="-90" y="-22" width="180" height="44" fill={c.accent} opacity="0.25" rx="2"/>
      </g>
      <rect x="-90" y="-22" width="180" height="44" fill={c.bg} stroke={c.accent} strokeWidth="2"/>
      <rect x="-90" y="-22" width="6" height="44" fill={c.accent}/>
      <text x="-78" y="-2" fill={c.accent} fontFamily={t.mono} fontSize="9" fontWeight="800" letterSpacing="3" textAnchor="start">STATUS</text>
      <text x="-78" y="16" fill={c.text} fontFamily={t.display} fontSize="20" fontWeight="900" letterSpacing="1" textAnchor="start">VERIFIED</text>
      {/* check icon right side */}
      <g transform="translate(70, 0)">
        <circle r="14" fill={c.accent}/>
        <path d="M-6 0 L-1 5 L6 -5" stroke={c.bg} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </g>

    {/* scan lines overlay */}
    <ScanLines c={c} w="340" h="380" opacity={0.05}/>

    {/* glitch sweep */}
    {motion && (
      <line x1="0" y1="0" x2="340" y2="0" stroke={c.accent} strokeWidth="1.5"
        opacity="0.5" style={{ animation: 'glitchScan 5.6s ease-in-out infinite' }}/>
    )}
  </svg>
);

// =====================================================================================
// SLIDE 3 — VS SCREEN. Mode select: TRENING vs RANKED. Fighting-game energy.
// Two big stylized panels, "VS" diamond center, scan lines, mode metadata.
// =====================================================================================
const heroTraining = (c, t, motion) => (
  <svg viewBox="0 0 340 380" width="100%" height="100%" style={{ maxWidth: 380 }}>
    <defs>
      <linearGradient id="leftPanel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={c.surface} stopOpacity="0.7"/>
        <stop offset="1" stopColor={c.surface} stopOpacity="0.1"/>
      </linearGradient>
      <linearGradient id="rightPanel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={c.accent} stopOpacity="0.05"/>
        <stop offset="1" stopColor={c.accent} stopOpacity="0.25"/>
      </linearGradient>
      <filter id="vsGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4"/>
      </filter>
    </defs>

    {/* corner brackets */}
    <Corner x="14" y="14" c={c} size="14" side="tl"/>
    <Corner x="326" y="14" c={c} size="14" side="tr"/>
    <Corner x="14" y="366" c={c} size="14" side="bl"/>
    <Corner x="326" y="366" c={c} size="14" side="br"/>

    {/* TOP — SELECT MODE label */}
    <text x="170" y="40" fill={c.textMuted} fontFamily={t.mono} fontSize="10" fontWeight="800"
      letterSpacing="6" textAnchor="middle">SELECT MODE</text>
    <line x1="120" y1="48" x2="220" y2="48" stroke={c.border} strokeWidth="0.5"/>

    {/* LEFT PANEL — TRENING (dim) */}
    <g>
      {/* angled panel: slanted right edge */}
      <path d="M20 70 L160 70 L150 320 L20 320 Z" fill="url(#leftPanel)" stroke={c.border} strokeWidth="1"/>

      {/* dim icon — bike */}
      <g transform="translate(85, 130)" opacity="0.5" stroke={c.text} strokeWidth="2" fill="none" strokeLinecap="round">
        <circle cx="-14" cy="6" r="10"/>
        <circle cx="14" cy="6" r="10"/>
        <path d="M-14 6 L4 -10 L14 6 M4 -10 L0 -16"/>
      </g>

      {/* title */}
      <text x="85" y="190" fill={c.text} fontFamily={t.display} fontSize="22" fontWeight="900"
        textAnchor="middle" letterSpacing="1" opacity="0.7">TRENING</text>
      <text x="85" y="208" fill={c.textMuted} fontFamily={t.mono} fontSize="8"
        textAnchor="middle" letterSpacing="2" opacity="0.7">PRACTICE MODE</text>

      {/* stats */}
      <g transform="translate(40, 232)" fontFamily={t.mono} opacity="0.55">
        {[
          ['LICZY SIĘ', 'NIE'],
          ['GPS', 'OPCJA'],
          ['LIMITY', 'BRAK'],
        ].map(([k, v], i) => (
          <g key={'tl-' + i} transform={`translate(0, ${i * 16})`}>
            <text x="0" y="0" fill={c.textMuted} fontSize="7" fontWeight="700" letterSpacing="2">{k}</text>
            <text x="90" y="0" fill={c.text} fontSize="8" fontWeight="800" letterSpacing="1.5" textAnchor="end">{v}</text>
          </g>
        ))}
      </g>
    </g>

    {/* RIGHT PANEL — RANKED (armed, accent) */}
    <g>
      {/* slanted panel mirroring left */}
      <path d="M180 70 L320 70 L320 320 L190 320 Z" fill="url(#rightPanel)" stroke={c.accent} strokeWidth="1.5"/>

      {/* hot icon — trophy / gate */}
      <g transform="translate(255, 130)" stroke={c.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* checkered finish flag */}
        <line x1="-12" y1="14" x2="-12" y2="-16"/>
        <rect x="-12" y="-16" width="22" height="14" stroke={c.accent} fill={c.accent}/>
        {/* checker squares cut */}
        <rect x="-12" y="-16" width="11" height="7" fill={c.bg}/>
        <rect x="-1" y="-9" width="11" height="7" fill={c.bg}/>
      </g>
      {/* glow halo around icon */}
      <circle cx="255" cy="124" r="22" fill={c.accent} opacity="0.18"
        style={motion ? { animation: 'breathe 1.6s ease-in-out infinite' } : {}}/>

      {/* title */}
      <text x="255" y="190" fill={c.text} fontFamily={t.display} fontSize="22" fontWeight="900"
        textAnchor="middle" letterSpacing="1">RANKED</text>
      <text x="255" y="208" fill={c.accent} fontFamily={t.mono} fontSize="8"
        textAnchor="middle" letterSpacing="2" fontWeight="800">LIGA · OFICJALNE</text>

      {/* stats */}
      <g transform="translate(210, 232)" fontFamily={t.mono}>
        {[
          ['LICZY SIĘ', 'TAK'],
          ['GPS', 'WYMAGANE'],
          ['LIMITY', 'STRICT'],
        ].map(([k, v], i) => (
          <g key={'rl-' + i} transform={`translate(0, ${i * 16})`}>
            <text x="0" y="0" fill={c.accent} fontSize="7" fontWeight="800" letterSpacing="2">{k}</text>
            <text x="90" y="0" fill={c.text} fontSize="8" fontWeight="800" letterSpacing="1.5" textAnchor="end">{v}</text>
          </g>
        ))}
      </g>
    </g>

    {/* VS DIAMOND — center */}
    <g transform="translate(170, 195)">
      {/* glow */}
      <g style={motion ? { filter: 'url(#vsGlow)' } : {}}>
        <polygon points="0,-30 26,0 0,30 -26,0" fill={c.accent} opacity="0.4"/>
      </g>
      <polygon points="0,-30 26,0 0,30 -26,0" fill={c.bg} stroke={c.accent} strokeWidth="2"/>
      <text x="0" y="6" fill={c.accent} fontFamily={t.display} fontSize="20" fontWeight="900"
        textAnchor="middle" letterSpacing="-0.5">VS</text>
      {/* outer rotating ring */}
      {motion && (
        <g style={{ animation: 'spinSlow 8s linear infinite', transformOrigin: '0 0' }}>
          <polygon points="0,-40 36,0 0,40 -36,0" fill="none" stroke={c.accent} strokeWidth="0.8"
            strokeDasharray="3 6" opacity="0.5"/>
        </g>
      )}
    </g>

    {/* BOTTOM HINT */}
    <g transform="translate(170, 350)" textAnchor="middle" fontFamily={t.mono}>
      <text fill={c.textMuted} fontSize="8" letterSpacing="2.5">PRZEŁĄCZ W KAŻDEJ CHWILI</text>
    </g>

    {/* scan lines overlay */}
    <ScanLines c={c} w="340" h="380" opacity={0.05}/>
  </svg>
);


const ONBOARDING_SLIDES = [
  { kicker: 'Gra', title: 'Prawdziwe trasy.\nPrawdziwa liga.',
    body: 'NWD zamienia realne zjazdy w grę wyścigową. Twoja góra. Twój czas.',
    cta: 'Wejdź do ligi', hero: heroTrack },
  { kicker: 'Zjazdy rankingowe', title: 'Liczą się\nzweryfikowane przejazdy.',
    body: 'Startuj z bramki. Trzymaj się trasy. Finiszuj na mecie. Tylko czyste przejazdy lądują na tablicy.',
    cta: 'Rozumiem', hero: heroValidation },
  { kicker: 'Trening', title: 'Trenuj bez presji.\nRankuj na pewno.',
    body: 'Słaby GPS lub zła linia? Jedź jako trening — bez wpływu na wynik. Liga zostaje czysta.',
    cta: 'Zaczynam', hero: heroTraining },
];

function ScreenOnboarding({ tweaks, nav }) {
  const { c, t, d, motion } = getTokens(tweaks);
  const [idx, setIdx] = React.useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <OnboardingSlide
        slide={ONBOARDING_SLIDES[idx]}
        idx={idx}
        total={ONBOARDING_SLIDES.length}
        c={c} t={t} d={d} motion={motion}
        onNext={() => idx < 2 ? setIdx(idx + 1) : nav('auth')}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Auth screen
// ─────────────────────────────────────────────────────────────
function ScreenAuth({ tweaks, nav }) {
  const { c, t, d } = getTokens(tweaks);
  const [email, setEmail] = React.useState('');
  const [step, setStep] = React.useState('email'); // email | code
  const [code, setCode] = React.useState(['', '', '', '', '', '']);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
      background: c.bg, color: c.text, padding: `12px ${d.pad}px ${d.pad}px`, position: 'relative' }}>
      <GridBg c={c} opacity={0.4} />

      <button onClick={() => step === 'code' ? setStep('email') : nav('home')}
        style={{ background: 'transparent', border: 0, color: c.textMuted,
          fontFamily: t.mono, fontSize: 11, letterSpacing: '0.16em', cursor: 'pointer',
          padding: 0, display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
          textTransform: 'uppercase', fontWeight: 600, position: 'relative' }}>
        <Icon name="arrow-left" size={16} /> Wróć
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', position: 'relative', textAlign: 'center', gap: 32 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{
            fontFamily: t.display, fontWeight: 800, fontSize: 64,
            color: c.text, letterSpacing: '0.06em', lineHeight: 1,
            textShadow: `0 0 40px ${c.accent}40`,
          }}>NWD</div>
          <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textMuted,
            letterSpacing: '0.32em', textTransform: 'uppercase' }}>New World Disorder</div>
          <div style={{ marginTop: 14 }}>
            <Pill c={c} t={t} tone="accent" size="md" icon="bolt">
              {step === 'email' ? 'Dołącz do ligi' : 'Sprawdź email'}
            </Pill>
          </div>
        </div>

        {step === 'email' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontFamily: t.mono, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: c.textMuted, display: 'block', marginBottom: 8 }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj@email.com"
                style={{
                  width: '100%', height: 56, borderRadius: 28,
                  background: c.bgCard, border: `1px solid ${email ? c.borderHi : c.border}`,
                  padding: '0 22px', fontFamily: t.body, fontSize: 16, color: c.text,
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 200ms',
                }} />
            </div>
            <Btn c={c} t={t} variant="primary" size="lg" onClick={() => setStep('code')}
              disabled={!email.includes('@')}>Wyślij kod</Btn>
          </div>
        )}

        {step === 'code' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.4 }}>
              Wpisz 6-cyfrowy kod z maila<br />
              <span style={{ color: c.text, fontWeight: 600 }}>{email}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {code.map((digit, i) => (
                <input key={i} value={digit} maxLength={1}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    const newCode = [...code]; newCode[i] = v; setCode(newCode);
                  }}
                  style={{
                    width: 44, height: 56, borderRadius: 12,
                    background: c.bgCard, border: `1px solid ${digit ? c.borderHi : c.border}`,
                    fontFamily: t.display, fontSize: 28, fontWeight: 700, color: c.text,
                    textAlign: 'center', outline: 'none',
                  }} />
              ))}
            </div>
            <Btn c={c} t={t} variant="primary" size="lg" onClick={() => nav('home', { authed: true })}
              disabled={code.some(d => !d)}>Wejdź do ligi</Btn>
          </div>
        )}

        <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim,
          letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1.6 }}>
          Logując się akceptujesz <u>Regulamin</u> i <u>Politykę</u>
        </div>
      </div>

      <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim,
        letterSpacing: '0.18em', textAlign: 'center', textTransform: 'uppercase' }}>
        NWD · Sezon 01 · Słotwiny Arena
      </div>
    </div>
  );
}

Object.assign(window, { ScreenOnboarding, ScreenAuth });
