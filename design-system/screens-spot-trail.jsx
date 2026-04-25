// screens-spot-trail.jsx — spot detail (bike park + trasy) and trail detail

function ScreenSpotDetail({ tweaks, nav, state }) {
  const { c, t, d } = getTokens(tweaks);
  const spot = SAMPLE_SPOTS.find(s => s.id === state.id) || SAMPLE_SPOTS[0];
  const isNew = spot.status === 'new';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0` }}>
        <TopBar onBack={() => nav('spots')} title="Spot"
          trailing={<Pill c={c} t={t} tone="outline" size="md">S01</Pill>} c={c} t={t} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `0 ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>

        {/* Hero */}
        <div style={{ position: 'relative', padding: '8px 0 4px' }}>
          <Pill c={c} t={t} tone="accent" icon="mountain" style={{ marginBottom: 14 }}>Bike park</Pill>
          <h1 style={{ margin: 0, fontFamily: t.display, fontWeight: 800,
            fontSize: 48, lineHeight: 0.92, color: c.text,
            letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>
            {spot.name}
          </h1>
          <div style={{ fontFamily: t.mono, fontSize: 11, color: c.textMuted,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 10,
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="pin" size={12} /> {spot.region} · {spot.distance}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <StatBox label="Trasy" value={SAMPLE_TRAILS.length} c={c} t={t} d={d} />
          <StatBox label="Riderzy" value={spot.riders} c={c} t={t} d={d} accent />
          <StatBox label="Zjazdy" value="247" c={c} t={t} d={d} />
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn c={c} t={t} variant="ghost" size="md" icon="trophy" onClick={() => nav('board')}>Tablica</Btn>
        </div>

        {isNew && (
          <Card c={c} d={d} padding={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="circle" size={16} color={c.warn} />
              <div style={{ flex: 1, fontSize: 12, color: c.textMuted, lineHeight: 1.4 }}>
                Trasy w walidacji — drugi rider potwierdzi geometrię.
              </div>
            </div>
          </Card>
        )}

        {/* Trails */}
        <SectionHead icon="route" label="Trasy" count={SAMPLE_TRAILS.length} c={c} t={t} />
        {SAMPLE_TRAILS.map(tr => (
          <TrailRow key={tr.id} trail={tr} c={c} t={t} d={d} onClick={() => nav('trail', { id: tr.id })} />
        ))}

        <Btn c={c} t={t} variant="outline" size="md" icon="plus" onClick={() => {}}>Dodaj trasę</Btn>
      </div>
    </div>
  );
}

function TrailRow({ trail, c, t, d, onClick }) {
  const diffColors = { easy: c.accent, med: c.warn, hard: c.danger };
  return (
    <div onClick={onClick} style={{
      background: c.bgCard, border: `1px solid ${c.border}`,
      borderRadius: d.cardRadius, padding: 16, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 200ms',
    }}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = c.borderHi}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = c.border}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 20,
            color: c.text, letterSpacing: t.displayTracking, lineHeight: 1.05,
            textTransform: 'uppercase' }}>{trail.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, height: 20,
              padding: '0 8px', borderRadius: 10,
              background: 'transparent', border: `1px solid ${diffColors[trail.diff] || c.border}`,
              color: diffColors[trail.diff] || c.text,
              fontFamily: t.mono, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: diffColors[trail.diff] }} />
              {trail.diff}
            </span>
            <Pill c={c} t={t} size="xs">{trail.tag}</Pill>
            {trail.status === 'validating' && <Pill c={c} t={t} tone="warn" size="xs">W walidacji</Pill>}
          </div>
        </div>
        {trail.best && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: t.mono, fontSize: 9, color: c.textDim, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Twój PB</div>
            <div style={{ fontFamily: t.timer, fontWeight: t.timerWeight, fontSize: 18,
              color: c.accent, letterSpacing: t.displayTracking, marginTop: 2 }}>{trail.best}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `1px solid ${c.border}`, paddingTop: 10 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{ fontFamily: t.mono, fontSize: 10, color: c.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <Icon name="route" size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {trail.length}
          </span>
          <span style={{ fontFamily: t.mono, fontSize: 10, color: c.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <Icon name="arrow-down" size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {trail.drop}
          </span>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, color: c.accent,
          fontFamily: t.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>
          <Icon name="bolt" size={12} stroke={2.4} /> Jedź
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Trail detail with inline mini-leaderboard
// ─────────────────────────────────────────────────────────────
function ScreenTrailDetail({ tweaks, nav, state }) {
  const { c, t, d } = getTokens(tweaks);
  const trail = SAMPLE_TRAILS.find(tr => tr.id === state.id) || SAMPLE_TRAILS[0];
  const [tab, setTab] = React.useState('season');
  const authed = state.authed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0` }}>
        <TopBar onBack={() => nav('spot', { id: 'wwa' })}
          title="Trasa"
          trailing={<Pill c={c} t={t} tone="outline" size="md">S01</Pill>} c={c} t={t} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `0 ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>

        <div>
          <Pill c={c} t={t} tone="accent" icon="route" style={{ marginBottom: 10 }}>Trasa</Pill>
          <h1 style={{ margin: 0, fontFamily: t.display, fontWeight: 800,
            fontSize: 44, lineHeight: 0.92, color: c.text,
            letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>{trail.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Pill c={c} t={t} tone="accent" icon="check">Easy</Pill>
            <Pill c={c} t={t}>Flow</Pill>
            <Pill c={c} t={t} tone="warn">Trasa kuratora</Pill>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <StatBox label="Długość" value={trail.length} c={c} t={t} d={d} />
          <StatBox label="Spadek" value={trail.drop} c={c} t={t} d={d} />
          <StatBox label="KOM" value="1:21.0" unit="s" c={c} t={t} d={d} accent />
        </div>

        {/* Curator note */}
        <Card c={c} d={d} padding={12} style={{ background: 'rgba(255,176,32,0.06)', borderColor: 'rgba(255,176,32,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="circle-fill" size={6} color={c.warn} style={{ marginTop: 8, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.45 }}>
              <span style={{ color: c.warn, fontFamily: t.mono, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Trasa kuratora</span>
              {' '}— czasy orientacyjne dopóki społeczność nie potwierdzi.
            </div>
          </div>
        </Card>

        {/* Mini leaderboard */}
        <SectionHead icon="trophy" label="Tablica" c={c} t={t} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'today', label: 'Dziś' },
            { id: 'week', label: 'Weekend' },
            { id: 'season', label: 'Sezon' },
          ].map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{
              height: 32, padding: '0 12px', borderRadius: 8,
              background: tab === tb.id ? c.accentDim : 'transparent',
              color: tab === tb.id ? c.accent : c.textMuted,
              border: `1px solid ${tab === tb.id ? c.borderHi : c.border}`,
              fontFamily: t.mono, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
            }}>{tb.label}</button>
          ))}
        </div>

        <Card c={c} d={d} padding={4}>
          {SAMPLE_LEADERBOARD.slice(0, 5).map((row, i) => (
            <LeaderboardRow key={row.rank} row={row} c={c} t={t} isLast={i === 4} />
          ))}
        </Card>
      </div>

      {/* Bottom CTA */}
      <div style={{ padding: `${d.gap}px ${d.pad}px`, background: c.bg, borderTop: `1px solid ${c.border}`,
        display: 'flex', gap: 10 }}>
        {authed ? (
          <>
            <Btn c={c} t={t} variant="primary" size="lg" icon="bolt"
              onClick={() => nav('run-approach', { id: trail.id })}>Jedź ranking</Btn>
            <Btn c={c} t={t} variant="ghost" size="lg" fullWidth={false}
              onClick={() => nav('run-approach', { id: trail.id, training: true })} style={{ minWidth: 110 }}>Trening</Btn>
          </>
        ) : (
          <Btn c={c} t={t} variant="outline" size="lg" onClick={() => nav('auth')}>Zaloguj — jedź ranking</Btn>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({ row, c, t, isLast, full }) {
  const podiumColors = { 1: c.podium1, 2: c.podium2, 3: c.podium3 };
  const rankColor = podiumColors[row.rank] || c.textMuted;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderBottom: isLast ? 'none' : `1px solid ${c.border}`,
      background: row.you ? c.accentDim : 'transparent',
    }}>
      <div style={{
        width: 28, fontFamily: t.display, fontWeight: 800, fontSize: 18,
        color: rankColor, textAlign: 'center', letterSpacing: t.displayTracking,
      }}>
        {row.rank <= 3 ? '#' + row.rank : row.rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: t.body, fontSize: 14, fontWeight: row.you ? 700 : 600,
          color: row.you ? c.accent : c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name} {row.you && <span style={{ fontSize: 10, color: c.accent, marginLeft: 6 }}>· TY</span>}
        </div>
        {full && row.delta && (
          <div style={{ fontFamily: t.mono, fontSize: 9, color: c.textDim, letterSpacing: '0.1em', marginTop: 2 }}>
            {row.delta}s za KOM
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: t.timer, fontWeight: t.timerWeight, fontSize: 16,
          color: row.rank === 1 ? c.accent : c.text, letterSpacing: t.displayTracking,
          fontVariantNumeric: 'tabular-nums' }}>
          {row.rank === 1 && <Icon name="bolt" size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
          {row.time}
        </div>
        {row.delta && (
          <div style={{ fontFamily: t.mono, fontSize: 9, color: c.textDim, letterSpacing: '0.06em', marginTop: 1 }}>
            {row.delta}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ScreenSpotDetail, ScreenTrailDetail, TrailRow, LeaderboardRow });
