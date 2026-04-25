// screens-misc.jsx — board, rider, help, add spot, not found

function ScreenBoard({ tweaks, nav, state }) {
  const { c, t, d } = getTokens(tweaks);
  const authed = state.authed;
  const [tab, setTab] = React.useState('season');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0`, position: 'relative' }}>
        <GridBg c={c} opacity={0.3} />
        <PageTitle kicker="Tablica" title="Ranking" subtitle="Tylko zweryfikowane zjazdy" c={c} t={t} />
      </div>
      <div style={{ padding: `${d.gap}px ${d.pad}px`, display: 'flex', gap: 8 }}>
        {[{id:'today',label:'Dziś'},{id:'week',label:'Weekend'},{id:'season',label:'Sezon'}].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex: 1, height: 38, borderRadius: 12,
            background: tab === tb.id ? c.accent : 'transparent',
            color: tab === tb.id ? c.accentInk : c.textMuted,
            border: `1px solid ${tab === tb.id ? c.accent : c.border}`,
            fontFamily: t.mono, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>{tb.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `0 ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>
        {!authed ? (
          <Card c={c} d={d} padding={28} style={{ textAlign: 'center' }}>
            <Icon name="trophy" size={36} color={c.textMuted} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 18,
              letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>Zaloguj się</div>
            <div style={{ fontSize: 13, color: c.textMuted, marginTop: 8, lineHeight: 1.4 }}>
              Tablica wymaga konta. Zjedź trasę, żeby pojawić się w rankingu.
            </div>
            <Btn c={c} t={t} variant="primary" size="md" onClick={() => nav('auth')} style={{ marginTop: 16 }}>Dołącz do ligi</Btn>
          </Card>
        ) : (
          <>
            <Card c={c} d={d} padding={4}>
              {SAMPLE_LEADERBOARD.map((row, i) => (
                <LeaderboardRow key={row.rank} row={row} c={c} t={t} isLast={i === SAMPLE_LEADERBOARD.length - 1} full />
              ))}
            </Card>
          </>
        )}
      </div>
      <TabBar active="board" onChange={(tab) => nav(tab)} c={c} t={t} />
    </div>
  );
}

function ScreenRider({ tweaks, nav, state }) {
  const { c, t, d } = getTokens(tweaks);
  const authed = state.authed;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ flex: 1, overflow: 'auto', padding: `12px ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>
        {!authed ? (
          <Card c={c} d={d} hi glow padding={20}>
            <Pill c={c} t={t} tone="accent">Konto</Pill>
            <h2 style={{ margin: '12px 0 8px', fontFamily: t.display, fontWeight: 800, fontSize: 26,
              letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>Zaloguj się</h2>
            <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.4, marginBottom: 14 }}>
              Stwórz rider tag, zapisuj zjazdy i dołącz do ligi.
            </div>
            <Btn c={c} t={t} variant="primary" size="md" onClick={() => nav('auth')}>Dołącz do ligi</Btn>
          </Card>
        ) : (
          <>
            <Card c={c} d={d} hi glow padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 32,
                  background: c.accentDim, border: `2px solid ${c.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="helmet" size={30} color={c.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 22,
                    letterSpacing: t.displayTracking, color: c.text }}>@tomek.ride</div>
                  <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textMuted,
                    letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 4 }}>Sezon 01 · #5 ligi</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <MiniStat label="Zjazdy" value="14" c={c} t={t} />
                <MiniStat label="PB" value="1:26.0" c={c} t={t} accent />
                <MiniStat label="XP" value="2.4k" c={c} t={t} />
              </div>
            </Card>

            <SectionHead icon="bolt" label="Statystyki sezonu" c={c} t={t} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatBox label="Czyste przejazdy" value="11/14" c={c} t={t} d={d} />
              <StatBox label="Trasy" value="3" c={c} t={t} d={d} />
              <StatBox label="Podia" value="2" c={c} t={t} d={d} accent />
              <StatBox label="Dystans" value="48.2" unit="km" c={c} t={t} d={d} />
            </div>
          </>
        )}

        <SectionHead label="Konto" c={c} t={t} />
        <Card c={c} d={d} padding={4}>
          {[
            { label: 'Pomoc i zasady', icon: 'help', screen: 'help' },
            { label: 'Ustawienia', icon: 'settings' },
            { label: 'O aplikacji', icon: 'spark' },
          ].map((item, i, arr) => (
            <div key={item.label} onClick={() => item.screen && nav(item.screen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${c.border}`,
                cursor: 'pointer',
              }}>
              <Icon name={item.icon} size={18} color={c.textMuted} />
              <div style={{ flex: 1, fontSize: 14, color: c.text }}>{item.label}</div>
              <Icon name="chevron-right" size={16} color={c.textDim} />
            </div>
          ))}
        </Card>

        <div style={{ textAlign: 'center', padding: '20px 0 0', fontFamily: t.mono, fontSize: 10,
          color: c.textDim, letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1.8 }}>
          New World Disorder<br />
          Sezon 01 · Słotwiny Arena<br />
          <span style={{ color: c.textMuted }}>Polityka · Regulamin · Wsparcie</span>
        </div>
      </div>
      <TabBar active="rider" onChange={(tab) => nav(tab)} c={c} t={t} />
    </div>
  );
}

function ScreenHelp({ tweaks, nav }) {
  const { c, t, d } = getTokens(tweaks);
  const [open, setOpen] = React.useState(0);
  const rules = [
    { n: 1, label: 'Startuj z bramki' },
    { n: 2, label: 'Trzymaj się trasy' },
    { n: 3, label: 'Przejdź checkpointy' },
    { n: 4, label: 'Finiszuj na mecie' },
    { n: 5, label: 'Utrzymuj silny GPS' },
    { n: 6, label: 'Tylko zweryfikowane zjazdy wchodzą na tablicę' },
  ];
  const faqs = [
    { q: 'Co liczy się jako zjazd rankingowy?', a: 'Zjazd musi wystartować z oficjalnej bramki, podążać trasą, przejść wszystkie checkpointy i zakończyć się na bramce mety. Sygnał GPS musi być silny.' },
    { q: 'Dlaczego mój zjazd został oznaczony jako trening?', a: 'Słaby GPS, zła linia, lub niedotarcie do mety. Trening nie wpływa na ranking — pomaga ci jeździć w gorszych warunkach.' },
    { q: 'Jak działa tablica wyników?', a: 'Co tydzień rankingowane są najlepsze czysty czasy. Sezon trwa do końca lokalnej zimy.' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0` }}>
        <TopBar onBack={() => nav('rider')} title="Przewodnik"
          trailing={<Pill c={c} t={t} tone="outline" size="md">S01</Pill>} c={c} t={t} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: `0 ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>
        <PageTitle kicker="Przewodnik" title="Jak działa NWD" subtitle="Zasady ligi i pytania — w jednym miejscu." c={c} t={t} />

        <SectionHead icon="bolt" label="Zasady" c={c} t={t} />
        <Card c={c} d={d} padding={4}>
          {rules.map((r, i) => (
            <div key={r.n} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderBottom: i === rules.length - 1 ? 'none' : `1px solid ${c.border}`,
            }}>
              <div style={{ fontFamily: t.mono, fontSize: 11, color: c.accent, letterSpacing: '0.1em', fontWeight: 700, width: 22 }}>0{r.n}</div>
              <div style={{ flex: 1, fontFamily: t.display, fontWeight: 600, fontSize: 16, color: c.text, letterSpacing: t.displayTracking }}>{r.label}</div>
            </div>
          ))}
        </Card>

        <SectionHead icon="help" label="Pytania" count={faqs.length} c={c} t={t} />
        {faqs.map((f, i) => (
          <Card key={i} c={c} d={d} padding={0} hi={open === i}
            onClick={() => setOpen(open === i ? -1 : i)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
              <div style={{ flex: 1, fontFamily: t.body, fontSize: 14, fontWeight: 600, color: c.text }}>{f.q}</div>
              <Icon name={open === i ? 'x' : 'plus'} size={16} color={open === i ? c.accent : c.textMuted} />
            </div>
            {open === i && (
              <div style={{ padding: '0 16px 16px', fontSize: 13, color: c.textMuted, lineHeight: 1.5 }}>{f.a}</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ScreenAddSpot({ tweaks, nav }) {
  const { c, t, d } = getTokens(tweaks);
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0` }}>
        <TopBar onBack={() => step > 0 ? setStep(step - 1) : nav('spots')} title="Dodaj spot" c={c} t={t} />
      </div>
      <div style={{ padding: `0 ${d.pad}px ${d.gap}px` }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? c.accent : c.border, transition: 'background 200ms' }} />
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: `0 ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>
        {step === 0 && (
          <>
            <PageTitle kicker="Krok 1 / 3" title="Nazwa" subtitle="Jak nazywa się ten bike park?" c={c} t={t} />
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="np. Las Lipowy"
              style={{
                width: '100%', height: 56, borderRadius: 28,
                background: c.bgCard, border: `1px solid ${name ? c.borderHi : c.border}`,
                padding: '0 22px', fontFamily: t.body, fontSize: 16, color: c.text,
                outline: 'none', boxSizing: 'border-box',
              }} />
            <Btn c={c} t={t} variant="primary" size="lg" onClick={() => setStep(1)} disabled={!name}>Dalej</Btn>
          </>
        )}
        {step === 1 && (
          <>
            <PageTitle kicker="Krok 2 / 3" title="Lokalizacja" subtitle="Wskaż na mapie wjazd do parku." c={c} t={t} />
            <Card c={c} d={d} padding={0} style={{ aspectRatio: '4/5', position: 'relative' }}>
              <GridBg c={c} opacity={0.5} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 22,
                  background: c.accentDim, border: `2px solid ${c.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: c.glow,
                }}>
                  <Icon name="pin" size={22} color={c.accent} />
                </div>
              </div>
            </Card>
            <Btn c={c} t={t} variant="primary" size="lg" onClick={() => setStep(2)}>Zatwierdź pozycję</Btn>
          </>
        )}
        {step === 2 && (
          <>
            <Card c={c} d={d} hi glow padding={20}>
              <div style={{
                width: 56, height: 56, borderRadius: 28, marginBottom: 14,
                background: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="check" size={32} color={c.accent} stroke={2.6} />
              </div>
              <h2 style={{ margin: 0, fontFamily: t.display, fontWeight: 800, fontSize: 24,
                letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>Zgłoszono «{name || 'Las Lipowy'}»</h2>
              <div style={{ fontSize: 14, color: c.textMuted, marginTop: 10, lineHeight: 1.4 }}>
                Sprawdzimy w 24h. Dostaniesz notyfikację gdy będzie zatwierdzony.
              </div>
              <Btn c={c} t={t} variant="primary" size="md" onClick={() => nav('spots')} style={{ marginTop: 16 }}>Wróć do listy</Btn>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function ScreenNotFound({ tweaks, nav }) {
  const { c, t, d } = getTokens(tweaks);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0` }}>
        <button onClick={() => nav('home')} style={{
          width: 38, height: 38, borderRadius: 19, border: `1px solid ${c.border}`,
          background: 'transparent', color: c.text, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}><Icon name="arrow-left" size={18} /></button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: `0 ${d.pad}px`, gap: 14, textAlign: 'center' }}>
        <Icon name="ghost" size={64} color={c.textMuted} />
        <h1 style={{ margin: 0, fontFamily: t.display, fontWeight: 800, fontSize: 28,
          letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>Nie znaleziono</h1>
        <div style={{ fontSize: 14, color: c.textMuted }}>Link może być nieaktualny.</div>
      </div>
      <div style={{ padding: `${d.gap}px ${d.pad}px ${d.pad}px` }}>
        <Btn c={c} t={t} variant="primary" size="lg" onClick={() => nav('home')}>Wróć na home</Btn>
      </div>
    </div>
  );
}

// New idea: head-to-head — challenge a specific rider
function ScreenH2H({ tweaks, nav }) {
  const { c, t, d } = getTokens(tweaks);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: c.bg, color: c.text }}>
      <div style={{ padding: `12px ${d.pad}px 0` }}>
        <TopBar onBack={() => nav('home')} title="Head to Head" c={c} t={t} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: `0 ${d.pad}px ${d.pad}px`,
        display: 'flex', flexDirection: 'column', gap: d.gap }}>
        <PageTitle kicker="Wyzwanie" title="1v1" subtitle="Pobij konkretnego rider'a na trasie. 24h na odpowiedź." c={c} t={t} />

        {/* VS card */}
        <Card c={c} d={d} hi padding={20}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'center' }}>
            <RiderCol name="@tomek.ride" time="1:26.0" c={c} t={t} you />
            <div style={{ fontFamily: t.display, fontWeight: 800, fontSize: 32,
              color: c.danger, letterSpacing: t.displayTracking }}>VS</div>
            <RiderCol name="@hermit_nwd" time="1:21.0" c={c} t={t} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 16, fontFamily: t.mono, fontSize: 11,
            color: c.warn, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            Różnica · 5.0s
          </div>
        </Card>

        <Card c={c} d={d} padding={14}>
          <div style={{ fontFamily: t.mono, fontSize: 10, color: c.textDim,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>Trasa</div>
          <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 22,
            letterSpacing: t.displayTracking, textTransform: 'uppercase' }}>Prezydencka</div>
          <div style={{ fontFamily: t.mono, fontSize: 11, color: c.textMuted,
            letterSpacing: '0.1em', marginTop: 6 }}>WWA Bike Park · Easy · Flow</div>
        </Card>

        <Card c={c} d={d} padding={14}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Icon name="ghost" size={20} color={c.accent} />
            <div style={{ flex: 1, fontSize: 13, color: c.text, lineHeight: 1.4 }}>
              Tryb Ghost — zobaczysz pozycję rywala na trasie podczas zjazdu.
            </div>
          </div>
        </Card>
      </div>
      <div style={{ padding: `${d.gap}px ${d.pad}px ${d.pad}px`, borderTop: `1px solid ${c.border}` }}>
        <Btn c={c} t={t} variant="primary" size="lg" icon="bolt"
          onClick={() => nav('run-approach', { id: 'prez' })}>Przyjmij wyzwanie</Btn>
      </div>
    </div>
  );
}

function RiderCol({ name, time, c, t, you }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 28,
        background: you ? c.accentDim : c.bgCardHi,
        border: `2px solid ${you ? c.accent : c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="helmet" size={26} color={you ? c.accent : c.textMuted} />
      </div>
      <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 13,
        color: c.text, letterSpacing: 0 }}>{name}</div>
      <div style={{ fontFamily: t.timer, fontWeight: t.timerWeight, fontSize: 18,
        color: you ? c.accent : c.text, letterSpacing: t.displayTracking,
        fontVariantNumeric: 'tabular-nums' }}>{time}</div>
      {you && <div style={{ fontFamily: t.mono, fontSize: 9, color: c.accent,
        fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>TY</div>}
    </div>
  );
}

Object.assign(window, { ScreenBoard, ScreenRider, ScreenHelp, ScreenAddSpot, ScreenNotFound, ScreenH2H });
