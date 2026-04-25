// screens-run.jsx — run flow: approach (5 states), ready check, recording, review, result, rejected
// This is the heart of the app — the moment you actually ride.

// ─────────────────────────────────────────────────────────────
// Approach — guided GPS to the start gate
// 5 states: far, near, on-line, armed, wrong-side, gps-weak
// ─────────────────────────────────────────────────────────────
function ScreenRunApproach({ tweaks, nav, state }) {
  const { c, t, d, motion } = getTokens(tweaks);
  const trail = SAMPLE_TRAILS.find(tr => tr.id === state.id) || SAMPLE_TRAILS[1];
  const [phase, setPhase] = React.useState(state.phase || 'far'); // far | near | on-line | armed | wrong-side | gps-weak

  // Auto-advance demo
  React.useEffect(() => {
    if (!motion) return;
    const order = ['far', 'near', 'on-line'];
    const i = order.indexOf(phase);
    if (i >= 0 && i < order.length - 1) {
      const tm = setTimeout(() => setPhase(order[i + 1]), 3500);
      return () => clearTimeout(tm);
    }
  }, [phase, motion]);

  // Phase config
  const phases = {
    far: {
      distance: 48, distanceLabel: 'do startu', heading: 0,
      title: 'IDŹ',
      help: 'Idź w kierunku strzałki.',
      ringColor: c.textMuted, gpsAcc: '±4m', gpsState: 'dobry',
      arrowColor: c.text, dots: [true, true, true],
    },
    near: {
      distance: 14, distanceLabel: 'do linii', heading: -25,
      title: 'BLISKO',
      help: 'Podejdź do bramki startu.',
      ringColor: c.accent, gpsAcc: '±4m', gpsState: 'dobry',
      arrowColor: c.text, dots: [true, true, true],
    },
    'on-line': {
      distance: null, distanceLabel: null, heading: null,
      title: 'GOTOWY',
      help: 'Dotknij UZBRÓJ — gdy przekroczysz linię, timer ruszy.',
      ringColor: c.accent, gpsAcc: '±4m', gpsState: 'dobry',
      arrowColor: c.accent, dots: [true, true, true], showArm: true,
    },
    armed: {
      distance: null, distanceLabel: null, heading: null,
      title: 'UZBROJONY',
      help: 'Schowaj telefon i jedź — timer startuje gdy przetniesz linię.',
      ringColor: c.accent, gpsAcc: '±4m', gpsState: 'dobry',
      arrowColor: c.accent, dots: [true, true, true], armed: true,
    },
    'wrong-side': {
      distance: null, distanceLabel: null, heading: 180,
      title: 'OBRÓĆ SIĘ',
      help: 'Rusz w kierunku trasy.',
      ringColor: c.warn, gpsAcc: '±4m', gpsState: 'dobry',
      arrowColor: c.warn, dots: [true, true, true], wrongSide: true,
    },
    'gps-weak': {
      distance: null, distanceLabel: null, heading: null,
      title: 'GPS SŁABY',
      help: 'Wyjdź na otwarte niebo. Poczekaj aż sygnał się ustabilizuje.',
      ringColor: c.danger, gpsAcc: '±14m', gpsState: 'słaby',
      arrowColor: c.danger, dots: [true, false, false], weak: true,
    },
  };

  const p = phases[phase];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
      background: c.bg, color: c.text, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient ring background */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 480, height: 480, borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${p.ringColor}18 0%, transparent 60%)`,
        opacity: motion ? 1 : 0.6,
        animation: motion && phase === 'on-line' ? 'breathe 2s ease-in-out infinite' : 'none',
        pointerEvents: 'none',
      }} />

      {/* Top bar */}
      <div style={{ padding: `12px ${d.pad}px 0`, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div>
          <div style={{ fontFamily: t.mono, fontSize: 9, color: c.textDim,
            letterSpacing: '0.22em', textTransform: 'uppercase' }}>Trasa</div>
          <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 22,
            color: c.text, letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>{trail.name}</div>
        </div>
        <Pill c={c} t={t} tone={state.training ? 'default' : 'accent'} icon={state.training ? null : 'bolt'}>
          {state.training ? 'Trening' : 'Ranking'}
        </Pill>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: `0 ${d.pad}px`,
        position: 'relative', textAlign: 'center', gap: 16 }}>

        {p.distance != null ? (
          // Distance + arrow
          <>
            {/* Compass arrow */}
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: c.bgCard, border: `2px solid ${p.ringColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: phase !== 'far' ? `0 0 40px ${p.ringColor}40` : 'none',
              transition: 'all 400ms ease',
            }}>
              <Icon name="arrow-up" size={48} color={p.arrowColor} stroke={2.5}
                style={{ transform: `rotate(${p.heading}deg)`, transition: 'transform 600ms ease' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <div style={{
                fontFamily: t.timer, fontWeight: t.timerWeight,
                fontSize: 96, lineHeight: 0.9, color: c.text,
                letterSpacing: t.displayTracking, fontVariantNumeric: 'tabular-nums',
              }}>{p.distance}<span style={{ fontSize: 32, color: c.textMuted, fontWeight: 500 }}>m</span></div>
              <div style={{ fontFamily: t.mono, fontSize: 11, fontWeight: 700,
                color: p.ringColor, letterSpacing: '0.32em', textTransform: 'uppercase' }}>
                {p.distanceLabel}
              </div>
            </div>
          </>
        ) : phase === 'wrong-side' ? (
          <>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: c.bgCard, border: `2px solid ${c.warn}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="arrow-down" size={48} color={c.warn} stroke={2.5} />
            </div>
            <div style={{ fontFamily: t.display, fontWeight: 800, fontSize: 36,
              color: c.warn, letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>
              {p.title}
            </div>
          </>
        ) : phase === 'gps-weak' ? (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 12, height: 12, borderRadius: 6,
                  background: i === 0 ? c.danger : c.bgCardHi,
                  border: `1.5px solid ${i === 0 ? c.danger : c.border}`,
                }} />
              ))}
            </div>
            <div style={{ fontFamily: t.display, fontWeight: 800, fontSize: 36,
              color: c.danger, letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>
              {p.title}
            </div>
          </>
        ) : (
          // on-line / armed
          <>
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: c.accentDim, border: `2px solid ${c.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 60px ${c.accent}50`,
              animation: motion ? 'breathe 2s ease-in-out infinite' : 'none',
            }}>
              {phase === 'armed' ? (
                <PulseDot color={c.accent} size={20} />
              ) : (
                <Icon name="check" size={56} color={c.accent} stroke={3} />
              )}
            </div>
            <div style={{ fontFamily: t.display, fontWeight: 800, fontSize: 36,
              color: c.accent, letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>
              {p.title}
            </div>
          </>
        )}

        <div style={{ fontFamily: t.body, fontSize: 14, color: c.textMuted,
          lineHeight: 1.45, maxWidth: 320, padding: '0 12px' }}>{p.help}</div>

        {p.showArm && (
          <Btn c={c} t={t} variant="primary" size="lg" icon="bolt"
            onClick={() => setPhase('armed')} fullWidth={false} style={{ marginTop: 12, paddingLeft: 40, paddingRight: 40 }}>
            Uzbrój
          </Btn>
        )}
      </div>

      {/* Bottom GPS strip */}
      <div style={{ padding: `${d.gap}px ${d.pad}px ${d.pad}px`, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: c.bgCard, border: `1px solid ${c.border}`,
          borderRadius: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {p.dots.map((on, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: 3,
                background: on ? (phase === 'gps-weak' ? c.danger : c.accent) : c.bgCardHi,
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, fontFamily: t.mono, fontSize: 9.5,
            color: c.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            <span>GPS · {p.gpsState}</span>
            <span>{p.gpsAcc}</span>
            <span>0.4 m/s</span>
          </div>
        </div>

        {/* Phase tester (dev) */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {Object.keys(phases).map(ph => (
            <button key={ph} onClick={() => setPhase(ph)} style={{
              height: 22, padding: '0 8px', borderRadius: 11,
              background: phase === ph ? c.accent : 'transparent',
              color: phase === ph ? c.accentInk : c.textDim,
              border: `1px solid ${phase === ph ? c.accent : c.border}`,
              fontFamily: t.mono, fontSize: 8, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            }}>{ph}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn c={c} t={t} variant="ghost" size="md" onClick={() => nav('trail', { id: trail.id })}>Wróć</Btn>
          {phase === 'armed' && (
            <Btn c={c} t={t} variant="primary" size="md" icon="play"
              onClick={() => nav('run-recording', { id: trail.id, training: state.training })}>Symuluj zjazd</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Recording — live timer running
// ─────────────────────────────────────────────────────────────
function ScreenRunRecording({ tweaks, nav, state }) {
  const { c, t, d, motion } = getTokens(tweaks);
  const trail = SAMPLE_TRAILS.find(tr => tr.id === state.id) || SAMPLE_TRAILS[1];
  const [time, setTime] = React.useState(0);

  React.useEffect(() => {
    const start = Date.now();
    const itv = setInterval(() => setTime((Date.now() - start) / 1000), 33);
    return () => clearInterval(itv);
  }, []);

  const secs = Math.floor(time);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const ms = Math.floor((time % 1) * 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
      background: c.bg, color: c.text, position: 'relative', overflow: 'hidden' }}>
      {/* Big ambient pulse */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 40%, ${c.accent}10 0%, transparent 50%)`,
        animation: motion ? 'breathe 1.2s ease-in-out infinite' : 'none',
        pointerEvents: 'none',
      }} />

      <div style={{ padding: `12px ${d.pad}px 0`, position: 'relative',
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <PulseDot color={c.danger} size={10} />
        <div style={{ fontFamily: t.mono, fontSize: 11, color: c.danger,
          letterSpacing: '0.32em', textTransform: 'uppercase', fontWeight: 700 }}>Zapis</div>
        <div style={{ flex: 1 }} />
        <Pill c={c} t={t} tone={state.training ? 'default' : 'accent'}>{state.training ? 'Trening' : 'Ranking'}</Pill>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative', gap: 24 }}>

        <div style={{ fontFamily: t.mono, fontSize: 11, color: c.textMuted,
          letterSpacing: '0.32em', textTransform: 'uppercase' }}>{trail.name}</div>

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'baseline',
          fontFamily: t.timer, fontWeight: t.timerWeight, color: c.accent,
          letterSpacing: t.displayTracking, fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 60px ${c.accent}80`, lineHeight: 1 }}>
          <span style={{ fontSize: 120 }}>{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
          <span style={{ fontSize: 60, color: c.textMuted, marginLeft: 8 }}>.{ms}</span>
        </div>

        {/* GPS bar */}
        <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
          <MiniLive label="Dystans" value="180" unit="m" c={c} t={t} />
          <MiniLive label="Speed" value="34" unit="km/h" c={c} t={t} />
          <MiniLive label="GPS" value="±4" unit="m" c={c} t={t} />
        </div>
      </div>

      <div style={{ padding: `${d.gap}px ${d.pad}px ${d.pad}px`, position: 'relative' }}>
        <Btn c={c} t={t} variant="danger" size="lg"
          onClick={() => nav('run-review', { id: trail.id, training: state.training })}>
          Zatrzymaj
        </Btn>
        <div style={{ textAlign: 'center', marginTop: 12, fontFamily: t.mono, fontSize: 10,
          color: c.textDim, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Auto-stop na bramce mety
        </div>
      </div>
    </div>
  );
}

function MiniLive({ label, value, unit, c, t }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: t.mono, fontSize: 9, color: c.textDim,
        letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: t.timer, fontWeight: t.timerWeight, fontSize: 22,
        color: c.text, letterSpacing: t.displayTracking, fontVariantNumeric: 'tabular-nums' }}>
        {value}<span style={{ fontSize: 11, color: c.textMuted, marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Review — post-run, before validation
// ─────────────────────────────────────────────────────────────
function ScreenRunReview({ tweaks, nav, state }) {
  const { c, t, d } = getTokens(tweaks);
  const trail = SAMPLE_TRAILS.find(tr => tr.id === state.id) || SAMPLE_TRAILS[1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
      background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0` }}>
        <Pill c={c} t={t} tone="accent" icon="check">Gotowy do zatwierdzenia</Pill>
        <h1 style={{ margin: '14px 0 0', fontFamily: t.display, fontWeight: 800,
          fontSize: 32, letterSpacing: t.displayTracking, textTransform: 'uppercase',
          color: c.text, lineHeight: 1 }}>{trail.name}</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `${d.gap}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>

        {/* Hero time */}
        <Card c={c} d={d} hi glow padding={28}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim,
              letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 12 }}>Czas</div>
            <div style={{ fontFamily: t.timer, fontWeight: t.timerWeight, fontSize: 72,
              color: c.accent, letterSpacing: t.displayTracking, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums', textShadow: `0 0 40px ${c.accent}40` }}>
              01:09.0
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatBox label="Dystans" value="225" unit="m" c={c} t={t} d={d} />
          <StatBox label="Spadek" value="16" unit="m" c={c} t={t} d={d} />
          <StatBox label="Punkty GPS" value="24" c={c} t={t} d={d} />
          <StatBox label="Średnia" value="±5.0" unit="m" c={c} t={t} d={d} accent />
        </div>

        {/* Track preview */}
        <Card c={c} d={d}>
          <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Tor · Podgląd</div>
          <svg viewBox="0 0 320 140" width="100%" height="120">
            <path d="M40 20 Q120 50, 160 80 T280 130" fill="none" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round"/>
            {[
              [40, 20], [80, 35], [120, 55], [160, 80], [200, 100], [240, 118], [280, 130]
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3" fill={c.accent}/>
            ))}
            <circle cx="40" cy="20" r="6" fill={c.accent} opacity="0.4"/>
            <circle cx="280" cy="130" r="6" fill={c.accent} opacity="0.4"/>
          </svg>
        </Card>

        {/* Validation checks */}
        <Card c={c} d={d} padding={14}>
          <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Walidacja</div>
          {[
            { label: 'Start na bramce', ok: true },
            { label: 'Linia trasy', ok: true },
            { label: 'Wszystkie checkpointy', ok: true },
            { label: 'Sygnał GPS', ok: true },
          ].map(check => (
            <div key={check.label} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 9,
                background: check.ok ? c.accentDim : 'rgba(255,71,87,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={check.ok ? 'check' : 'x'} size={11}
                  color={check.ok ? c.accent : c.danger} stroke={3} />
              </div>
              <div style={{ flex: 1, fontSize: 13, color: c.text }}>{check.label}</div>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ padding: `${d.gap}px ${d.pad}px ${d.pad}px`, background: c.bg,
        borderTop: `1px solid ${c.border}` }}>
        <Btn c={c} t={t} variant="primary" size="lg" icon="check"
          onClick={() => nav('run-result', { id: trail.id })}>Zatwierdź</Btn>
        <button onClick={() => nav('run-rejected', { reason: 'manual' })}
          style={{ width: '100%', background: 'transparent', border: 0, color: c.danger,
            fontFamily: t.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', padding: '14px 0', cursor: 'pointer', marginTop: 4 }}>
          Odrzuć i jedź ponownie
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Result — POST-validation, the celebration moment
// ─────────────────────────────────────────────────────────────
function ScreenRunResult({ tweaks, nav, state }) {
  const { c, t, d, motion } = getTokens(tweaks);
  const [show, setShow] = React.useState(!motion);
  React.useEffect(() => {
    if (motion) {
      const t1 = setTimeout(() => setShow(true), 300);
      return () => clearTimeout(t1);
    }
  }, [motion]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
      background: c.bg, color: c.text, position: 'relative', overflow: 'hidden' }}>
      {/* Confetti / particle bg */}
      {motion && <Particles c={c} />}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center top, ${c.accent}20 0%, transparent 50%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: `12px ${d.pad}px 0`, position: 'relative' }}>
        <button onClick={() => nav('home')} style={{
          width: 38, height: 38, borderRadius: 19, border: `1px solid ${c.border}`,
          background: 'transparent', color: c.text, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}><Icon name="arrow-left" size={18} /></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `${d.gap}px ${d.pad}px`,
        position: 'relative', display: 'flex', flexDirection: 'column', gap: d.gap }}>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8,
          opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 600ms cubic-bezier(.2,.8,.2,1)' }}>
          <div style={{ fontFamily: t.mono, fontSize: 11, color: c.textMuted,
            letterSpacing: '0.32em', textTransform: 'uppercase' }}>Prezydencka</div>
          <div>
            <Pill c={c} t={t} tone="accent" icon="check">Oficjalny</Pill>
          </div>
          <div style={{
            fontFamily: t.timer, fontWeight: t.timerWeight, fontSize: 88,
            color: c.accent, letterSpacing: t.displayTracking, lineHeight: 1, marginTop: 8,
            fontVariantNumeric: 'tabular-nums', textShadow: `0 0 60px ${c.accent}60`,
          }}>1:21.00</div>
        </div>

        {/* PB ribbon */}
        <Card c={c} d={d} hi glow padding={18}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 22,
                background: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="arrow-up" size={22} color={c.accent} stroke={2.6} />
              </div>
              <div>
                <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim,
                  letterSpacing: '0.18em', textTransform: 'uppercase' }}>Personal Best</div>
                <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 18,
                  color: c.text, letterSpacing: t.displayTracking, marginTop: 2 }}>5.0s szybciej</div>
              </div>
            </div>
            <Icon name="medal" size={28} color={c.accent} />
          </div>
        </Card>

        {/* Podium card */}
        <Card c={c} d={d} padding={20}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim,
              letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 14 }}>Oficjalny Ranking</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 18, marginBottom: 14 }}>
              <PodiumCol rank={2} time="1:23.4" c={c} t={t} h={48} />
              <PodiumCol rank={1} time="1:21.0" c={c} t={t} h={68} you />
              <PodiumCol rank={3} time="1:24.1" c={c} t={t} h={36} />
            </div>
            <Pill c={c} t={t} tone="accentSolid" icon="arrow-up">+2 miejsca</Pill>
          </div>
        </Card>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatBox label="XP" value="+125" c={c} t={t} d={d} accent />
          <StatBox label="Średnia" value="34" unit="km/h" c={c} t={t} d={d} />
          <StatBox label="Max" value="51" unit="km/h" c={c} t={t} d={d} />
          <StatBox label="Punkty GPS" value="148" c={c} t={t} d={d} />
        </div>

        {/* Clean run badge */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '4px 0' }}>
          <Pill c={c} t={t} tone="accent" icon="check">Czysty przejazd</Pill>
          <Pill c={c} t={t} tone="warn" icon="fire">3 dni z rzędu</Pill>
        </div>
      </div>

      <div style={{ padding: `${d.gap}px ${d.pad}px ${d.pad}px`, position: 'relative',
        background: c.bg, borderTop: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Btn c={c} t={t} variant="ghost" size="md" fullWidth icon="trophy" onClick={() => nav('board')}>Tablica</Btn>
          <Btn c={c} t={t} variant="ghost" size="md" fullWidth icon="share" onClick={() => {}}>Udostępnij</Btn>
        </div>
        <Btn c={c} t={t} variant="primary" size="lg" icon="bolt"
          onClick={() => nav('run-approach', { id: state.id })}>Jedź ponownie</Btn>
      </div>
    </div>
  );
}

function PodiumCol({ rank, time, c, t, h, you }) {
  const colors = { 1: c.podium1, 2: c.podium2, 3: c.podium3 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontFamily: t.timer, fontWeight: t.timerWeight, fontSize: 13,
        color: c.textMuted, fontVariantNumeric: 'tabular-nums' }}>{time}</div>
      <div style={{
        width: 56, height: h, borderRadius: '6px 6px 0 0',
        background: `linear-gradient(180deg, ${colors[rank]} 0%, ${colors[rank]}80 100%)`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8px 0',
        position: 'relative', boxShadow: you ? `0 0 30px ${colors[rank]}60` : 'none',
      }}>
        <div style={{ fontFamily: t.display, fontWeight: 800, fontSize: 22, color: c.bg }}>#{rank}</div>
        {you && (
          <div style={{ position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)',
            fontFamily: t.mono, fontSize: 9, color: colors[rank], fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase' }}>TY</div>
        )}
      </div>
    </div>
  );
}

// Particles for celebration
function Particles({ c }) {
  const particles = React.useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 3 + Math.random() * 2,
    size: 2 + Math.random() * 4,
  })), []);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: '-10px',
          width: p.size, height: p.size, borderRadius: '50%',
          background: c.accent, opacity: 0.6,
          animation: `fall ${p.duration}s linear ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Rejected — run failed validation
// ─────────────────────────────────────────────────────────────
function ScreenRunRejected({ tweaks, nav, state }) {
  const { c, t, d } = getTokens(tweaks);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
      background: c.bg, color: c.text, position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center, ${c.danger}20 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: `12px ${d.pad}px 0`, position: 'relative' }}>
        <button onClick={() => nav('run-approach', { id: state.id })} style={{
          width: 38, height: 38, borderRadius: 19, border: `1px solid ${c.border}`,
          background: 'transparent', color: c.text, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}><Icon name="arrow-left" size={18} /></button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: `0 ${d.pad}px`,
        gap: 24, textAlign: 'center', position: 'relative' }}>

        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,71,87,0.1)', border: `2px solid ${c.danger}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 60px ${c.danger}40`,
        }}>
          <Icon name="x" size={56} color={c.danger} stroke={3} />
        </div>

        <div>
          <h1 style={{ margin: 0, fontFamily: t.display, fontWeight: 800, fontSize: 36,
            letterSpacing: t.displayTracking, textTransform: 'uppercase',
            color: c.danger, lineHeight: 1 }}>Niezatwierdzony</h1>
          <p style={{ margin: '14px 0 0', fontSize: 14, color: c.textMuted,
            lineHeight: 1.5, maxWidth: 320 }}>
            Szum w GPS zniekształciłby kalibrację trasy dla innych. Spróbuj ponownie w lepszym sygnale.
          </p>
        </div>

        <Card c={c} d={d} padding={14} style={{ width: '100%' }}>
          {[
            { label: 'Start na bramce', ok: true },
            { label: 'Linia trasy', ok: true },
            { label: 'Sygnał GPS', ok: false, note: '±14m za słaby' },
          ].map(check => (
            <div key={check.label} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 9,
                background: check.ok ? c.accentDim : 'rgba(255,71,87,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={check.ok ? 'check' : 'x'} size={11}
                  color={check.ok ? c.accent : c.danger} stroke={3} />
              </div>
              <div style={{ flex: 1, fontSize: 13, color: c.text, textAlign: 'left' }}>{check.label}</div>
              {check.note && <div style={{ fontFamily: t.mono, fontSize: 10, color: c.danger, letterSpacing: '0.06em' }}>{check.note}</div>}
            </div>
          ))}
        </Card>
      </div>

      <div style={{ padding: `${d.gap}px ${d.pad}px ${d.pad}px`, position: 'relative' }}>
        <Btn c={c} t={t} variant="primary" size="lg"
          onClick={() => nav('run-approach', { id: state.id })}>Spróbuj ponownie</Btn>
        <button onClick={() => nav('trail', { id: state.id })}
          style={{ width: '100%', background: 'transparent', border: 0, color: c.textMuted,
            fontFamily: t.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', padding: '14px 0', cursor: 'pointer', marginTop: 4 }}>
          Wróć do trasy
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenRunApproach, ScreenRunRecording, ScreenRunReview, ScreenRunResult, ScreenRunRejected, MiniLive, PodiumCol, Particles
});
