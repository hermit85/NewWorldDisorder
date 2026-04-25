// screens-home.jsx — home, spots list, spot detail, trail detail, board
// Redesign focus: less text, clearer hierarchy, more iconography, fast scanning.

// Sample data
const SAMPLE_SPOTS = [
  { id: 'wwa', name: 'WWA Bike Park', region: 'Mazowieckie', trails: 1, status: 'new', distance: '4 km', riders: 8 },
  { id: 'slot', name: 'Słotwiny Arena', region: 'Małopolskie', trails: 12, status: 'active', distance: '320 km', riders: 142 },
  { id: 'kluszk', name: 'Kluszkowce', region: 'Małopolskie', trails: 7, status: 'active', distance: '380 km', riders: 64 },
];

const SAMPLE_TRAILS = [
  { id: 'prez', name: 'Prezydencka', diff: 'easy', tag: 'flow', status: 'validating', length: '0.8 km', drop: '120 m', best: null },
  { id: 'park', name: 'Parkowa', diff: 'easy', tag: 'flow', status: 'live', length: '1.2 km', drop: '180 m', best: '1:21.00' },
  { id: 'czar', name: 'Czarna', diff: 'hard', tag: 'tech', status: 'live', length: '1.6 km', drop: '320 m', best: '2:08.40' },
];

const SAMPLE_LEADERBOARD = [
  { rank: 1, name: 'hermit_nwd', time: '1:21.00', delta: null, you: false, podium: 1 },
  { rank: 2, name: 'kuba.dh', time: '1:23.40', delta: '+2.4', you: false, podium: 2 },
  { rank: 3, name: 'zoska', time: '1:24.10', delta: '+3.1', you: false, podium: 3 },
  { rank: 4, name: 'wojtek_27', time: '1:25.80', delta: '+4.8', you: false },
  { rank: 5, name: 'tomek.ride', time: '1:26.00', delta: '+5.0', you: true },
  { rank: 6, name: 'marek_dh', time: '1:27.20', delta: '+6.2', you: false },
  { rank: 7, name: 'ania_park', time: '1:28.40', delta: '+7.4', you: false },
  { rank: 8, name: 'rider_22', time: '1:29.10', delta: '+8.1', you: false },
];

// ─────────────────────────────────────────────────────────────
// Home — for logged-in user, dashboard with current season + nearby
// For logged-out, hero CTA card
// ─────────────────────────────────────────────────────────────
function ScreenHome({ tweaks, nav, state }) {
  const { c, t, d, motion } = getTokens(tweaks);
  const authed = state.authed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      {/* Hero strip */}
      <div style={{ position: 'relative', padding: `12px ${d.pad}px 8px`, overflow: 'hidden' }}>
        <GridBg c={c} opacity={0.35} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <div>
            <div style={{ fontFamily: t.display, fontWeight: 800, fontSize: 28,
              letterSpacing: '0.06em', color: c.text, lineHeight: 1 }}>NWD</div>
            <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textMuted,
              letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 4 }}>Liga Gravity</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Pill c={c} t={t} tone="default" size="md" icon="bolt">Sezon 01</Pill>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `8px ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>

        {!authed && (
          <Card c={c} d={d} hi glow padding={20}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Pill c={c} t={t} tone="accent">Sezon 01 · Słotwiny</Pill>
              <h2 style={{ margin: 0, fontFamily: t.display, fontWeight: 800, fontSize: 28,
                letterSpacing: t.displayTracking, color: c.text, textTransform: 'uppercase', lineHeight: 1 }}>
                Dołącz do ligi
              </h2>
              <div style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.45 }}>
                Stwórz rider tag, zapisuj zjazdy, walcz o miejsce na tablicy.
              </div>
              <Btn c={c} t={t} variant="primary" size="lg" onClick={() => nav('auth')}>
                Zaloguj się
              </Btn>
            </div>
          </Card>
        )}

        {authed && (
          <>
            {/* Live status card */}
            <Card c={c} d={d} hi glow padding={18}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: t.mono, fontSize: 10, fontWeight: 700,
                    color: c.accent, letterSpacing: '0.22em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PulseDot color={c.accent} /> W lidze
                  </div>
                  <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 22,
                    color: c.text, marginTop: 6, letterSpacing: t.displayTracking }}>@tomek.ride</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: t.mono, fontSize: 9, color: c.textDim, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Ranking</div>
                  <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 22, color: c.podium2, marginTop: 2 }}>#5</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <MiniStat label="Zjazdy" value="14" c={c} t={t} />
                <MiniStat label="PB" value="1:26.0" c={c} t={t} accent />
                <MiniStat label="XP" value="2.4k" c={c} t={t} />
              </div>
            </Card>

            {/* Quick action: ride */}
            <Btn c={c} t={t} variant="primary" size="lg" icon="bolt"
              onClick={() => nav('spot', { id: 'wwa' })}>Jedź teraz</Btn>
          </>
        )}

        {/* Live event card */}
        <Card c={c} d={d}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <PulseDot color={c.danger} />
            <div style={{ fontFamily: t.mono, fontSize: 10, fontWeight: 700,
              color: c.danger, letterSpacing: '0.22em', textTransform: 'uppercase' }}>Live · Weekend</div>
          </div>
          <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 22,
            color: c.text, letterSpacing: t.displayTracking, lineHeight: 1.05 }}>
            Słotwiny Arena<br />
            <span style={{ color: c.textMuted, fontSize: 14, fontWeight: 500, letterSpacing: 0 }}>72 zjazdy · 41 riderów</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Btn c={c} t={t} variant="outline" size="sm" fullWidth={false} onClick={() => nav('spot', { id: 'slot' })}>Zobacz</Btn>
            <Btn c={c} t={t} variant="ghost" size="sm" fullWidth={false} icon="trophy" onClick={() => nav('board')}>Tablica</Btn>
          </div>
        </Card>

        {/* Nearby spots */}
        <SectionHead icon="pin" label="W okolicy" count={`${SAMPLE_SPOTS.length} spoty`} c={c} t={t} />
        {SAMPLE_SPOTS.slice(0, 2).map(spot => (
          <SpotRow key={spot.id} spot={spot} c={c} t={t} d={d} onClick={() => nav('spot', { id: spot.id })} />
        ))}

        {/* Trending card */}
        <Card c={c} d={d}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Icon name="fire" size={16} color={c.warn} stroke={2.4} />
            <div style={{ fontFamily: t.mono, fontSize: 10, fontWeight: 700,
              color: c.warn, letterSpacing: '0.22em', textTransform: 'uppercase' }}>Hot dziś</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 18, color: c.text }}>Czarna · Słotwiny</div>
              <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textMuted, letterSpacing: '0.1em', marginTop: 4 }}>
                28 zjazdów dziś · KOM zmienił się 2x
              </div>
            </div>
            <Icon name="chevron-right" size={20} color={c.textMuted} />
          </div>
        </Card>
      </div>

      <TabBar active="home" onChange={(tab) => nav(tab)} c={c} t={t} />
    </div>
  );
}

function MiniStat({ label, value, accent, c, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: t.mono, fontSize: 9, color: c.textDim, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 18, color: accent ? c.accent : c.text, letterSpacing: t.displayTracking }}>{value}</div>
    </div>
  );
}

function SpotRow({ spot, c, t, d, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: c.bgCard, border: `1px solid ${c.border}`,
      borderRadius: d.cardRadius, padding: '14px 16px', cursor: 'pointer',
      transition: 'border-color 200ms, transform 150ms',
    }}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = c.borderHi}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = c.border}>
      {/* Marker */}
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: spot.status === 'new' ? 'transparent' : c.accentDim,
        border: `1.5px solid ${spot.status === 'new' ? c.warn : c.borderHi}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="mountain" size={20} color={spot.status === 'new' ? c.warn : c.accent} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 17,
            color: c.text, letterSpacing: t.displayTracking, textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {spot.name}
          </div>
        </div>
        <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textMuted,
          letterSpacing: '0.1em', marginTop: 2, textTransform: 'uppercase',
          display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{spot.region}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{spot.distance}</span>
          {spot.trails > 0 && (<>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{spot.trails} {spot.trails === 1 ? 'trasa' : 'tras'}</span>
          </>)}
        </div>
      </div>

      {spot.status === 'new' ? <Pill c={c} t={t} tone="warn">Nowy</Pill> : <Pill c={c} t={t} tone="accent">{spot.riders}</Pill>}
      <Icon name="chevron-right" size={16} color={c.textDim} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Spots list
// ─────────────────────────────────────────────────────────────
function ScreenSpots({ tweaks, nav }) {
  const { c, t, d } = getTokens(tweaks);
  const [filter, setFilter] = React.useState('all');
  const filtered = SAMPLE_SPOTS.filter(s => filter === 'all' || (filter === 'active' && s.status === 'active') || (filter === 'new' && s.status === 'new'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0`, position: 'relative' }}>
        <GridBg c={c} opacity={0.3} />
        <PageTitle kicker="Spoty" title="Bike parki" subtitle={`${SAMPLE_SPOTS.length} spotów · ${SAMPLE_SPOTS.filter(s => s.status === 'active').length} aktywne`} c={c} t={t} />
      </div>

      <div style={{ padding: `${d.gap}px ${d.pad}px`, display: 'flex', gap: 8 }}>
        {[
          { id: 'all', label: 'Wszystkie' },
          { id: 'active', label: 'Aktywne' },
          { id: 'new', label: 'Nowe' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            height: 36, padding: '0 14px', borderRadius: 18,
            background: filter === f.id ? c.text : 'transparent',
            color: filter === f.id ? c.bg : c.textMuted,
            border: `1px solid ${filter === f.id ? c.text : c.border}`,
            fontFamily: t.mono, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all 150ms',
          }}>{f.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `0 ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(s => <SpotRow key={s.id} spot={s} c={c} t={t} d={d} onClick={() => nav('spot', { id: s.id })} />)}

        <Btn c={c} t={t} variant="outline" size="md" icon="plus"
          onClick={() => nav('add-spot')} style={{ marginTop: 8 }}>Dodaj bike park</Btn>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: c.textMuted, fontSize: 13 }}>
            Brak spotów w tej kategorii.
          </div>
        )}
      </div>

      <TabBar active="spots" onChange={(tab) => nav(tab)} c={c} t={t} />
    </div>
  );
}

Object.assign(window, { ScreenHome, ScreenSpots, SAMPLE_SPOTS, SAMPLE_TRAILS, SAMPLE_LEADERBOARD, SpotRow, MiniStat });
