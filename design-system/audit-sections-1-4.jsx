// Sections 1-4: Race states, Type scale, Telemetry, Motion

// =====================================================================================
// SECTION 1 — RACE STATE TOKENS
// =====================================================================================
function Section1() {
  // visualize a state pill + glow demo for each
  const Demo = ({ color, label, anim, blurb }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '12px 0' }}>
      <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: color === A.training ? 'rgba(255,255,255,0.06)' : `${color}22`,
          border: `1.5px solid ${color}`,
          animation: anim,
        }}/>
        <div style={{
          position: 'absolute', inset: 18, borderRadius: '50%',
          background: color, opacity: color === A.training ? 0.4 : 1,
        }}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: A.text,
          textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginTop: 2 }}>{blurb}</div>
      </div>
    </div>
  );

  return (
    <>
      <ArtboardHead num="01" title="Race state tokens"
        sub="Stan przejazdu to RDZEŃ produktu — TRENING / ARMED / RANKED / INVALID / PENDING. Dziś wszystko leci na jednym `accent` zielonym, więc 'jadę pod ranking' wygląda tak samo jak 'liga zaliczona'." />
      <SplitBody>
        <Column kind="today">
          <div style={{ marginBottom: 18 }}>
            <Pill variant="accent">accent</Pill>
            <span style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginLeft: 12 }}>
              jeden token, używany do wszystkiego
            </span>
          </div>

          {/* All identical */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Demo color={A.accent} label="Armed (jadę pod liga)" anim={null} blurb="zielony"/>
            <Demo color={A.accent} label="Verified (zaliczone)" anim={null} blurb="zielony"/>
            <Demo color={A.accent} label="Pending (waliduje się)" anim={null} blurb="zielony"/>
            <Demo color={A.danger} label="Invalid (odrzucone)" anim={null} blurb="czerwony — ale używany ad-hoc"/>
          </div>

          <div style={{ marginTop: 22, padding: 14, background: 'rgba(255,71,87,0.06)',
            border: `1px solid rgba(255,71,87,0.2)`, fontFamily: F.body, fontSize: 13,
            color: A.text, lineHeight: 1.5 }}>
            ⚠ Trening wygląda jak ranking. Brak wizualnego sygnału "to jest na serio".
          </div>
        </Column>

        <Column kind="proposal">
          <div style={{ marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Pill variant="neutral">state.training</Pill>
            <Pill variant="accent">state.armed</Pill>
            <Pill variant="accent">state.verified</Pill>
            <Pill variant="warn">state.pending</Pill>
            <Pill variant="danger">state.invalid</Pill>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Demo color={A.training} label="Training"
              anim={null}
              blurb="muted gray · brak pulsa · 'nie liczy się'"/>
            <Demo color={A.armed} label="Armed"
              anim="auditPulseFast 1.2s ease-in-out infinite"
              blurb="szybki puls · 'jadę po wynik'"/>
            <Demo color={A.verified} label="Verified"
              anim="auditPulseSlow 2.4s ease-in-out infinite"
              blurb="wolny oddech · 'zaliczone, leży'"/>
            <Demo color={A.pending} label="Pending"
              anim="auditBlink 0.6s linear infinite"
              blurb="amber blink · 'walidujemy'"/>
            <Demo color={A.invalid} label="Invalid"
              anim={null}
              blurb="solid red · DNF/DSQ"/>
          </div>
        </Column>

        <Verdict items={[
          'Każdy stan ma własny kolor + tempo animacji + kapsową etykietę',
          'Training = neutral (nie kradnie uwagi rankingowi)',
          'Armed pulsuje szybko (urgency), Verified oddycha wolno (calm)',
          'Pending amber + invalid red dają trzecią warstwę informacji',
        ]}/>
      </SplitBody>
    </>
  );
}

// =====================================================================================
// SECTION 2 — TYPE SCALE
// =====================================================================================
function Section2() {
  const todaySizes = [32, 28, 22, 20, 18, 15, 14, 12, 11, 10, 9, 8];
  const proposalScale = [
    { name: 'hero',    size: 56, weight: 800, lh: 0.95, track: '-0.02em', use: 'race time, leaderboard hero' },
    { name: 'title',   size: 32, weight: 700, lh: 1.05, track: '-0.01em', use: 'screen titles' },
    { name: 'lead',    size: 22, weight: 600, lh: 1.2,  track: '-0.005em', use: 'section heads, modal heads' },
    { name: 'body',    size: 15, weight: 400, lh: 1.5,  track: '0',        use: 'paragraphs, descriptions' },
    { name: 'caption', size: 13, weight: 500, lh: 1.4,  track: '0',        use: 'metadata, secondary' },
    { name: 'label',   size: 11, weight: 800, lh: 1.0,  track: '0.24em',   use: 'kickers, pills, navigation' },
    { name: 'micro',   size: 9,  weight: 700, lh: 1.0,  track: '0.32em',   use: 'system text, tags' },
  ];

  return (
    <>
      <ArtboardHead num="02" title="Type scale"
        sub="Dziś rozmiary fontów lecą ad-hoc — spotkałem 12+ różnych. Brak nazwanego scale = brak hierarchii." />
      <SplitBody>
        <Column kind="today">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 16 }}>
            12 różnych rozmiarów, brak nazewnictwa, hierarchia improwizowana per komponent:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {todaySizes.map(s => (
              <div key={s} style={{
                fontFamily: F.mono, fontSize: 11, color: A.text,
                padding: '6px 10px', border: `1px solid ${A.border}`,
                background: A.panel, fontWeight: 700, letterSpacing: '0.05em',
              }}>{s}px</div>
            ))}
          </div>
          <div style={{ marginTop: 28, padding: 14, background: 'rgba(255,71,87,0.06)',
            border: `1px solid rgba(255,71,87,0.2)`, fontFamily: F.body, fontSize: 13,
            color: A.text, lineHeight: 1.5 }}>
            ⚠ Czytasz "fontSize: 14" w 30 miejscach i nie wiesz czy to body, caption czy label.
          </div>
        </Column>

        <Column kind="proposal">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            7 nazwanych poziomów. Każdy z line-height + tracking. Aliasy w kodzie: <code style={{
              fontFamily: F.mono, color: A.accent }}>t.size.title</code>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {proposalScale.map(s => (
              <div key={s.name} style={{
                display: 'grid', gridTemplateColumns: '76px 1fr',
                alignItems: 'baseline', gap: 14, padding: '10px 0',
                borderBottom: `1px solid ${A.border}`,
              }}>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: A.accent,
                    letterSpacing: '0.24em', fontWeight: 800 }}>{s.name.toUpperCase()}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: A.textMuted,
                    marginTop: 3 }}>{s.size}/{s.weight}</div>
                </div>
                <div>
                  <div style={{
                    fontFamily: s.name === 'micro' || s.name === 'label' ? F.mono : F.display,
                    fontSize: Math.min(s.size, 38), fontWeight: s.weight, color: A.text,
                    lineHeight: s.lh, letterSpacing: s.track,
                    textTransform: s.name === 'label' || s.name === 'micro' ? 'uppercase' : 'none',
                  }}>
                    {s.name === 'hero' ? '02:14.83' :
                     s.name === 'title' ? 'Real trasy.' :
                     s.name === 'lead' ? 'Twoja góra. Twój czas.' :
                     s.name === 'body' ? 'Startuj z bramki, finiszuj na końcu.' :
                     s.name === 'caption' ? 'Słotwiny Arena · 2.4 km' :
                     s.name === 'label' ? 'STATUS' : 'GPS · 4G · LIVE'}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 11, color: A.textDim, marginTop: 4 }}>
                    {s.use}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Column>

        <Verdict items={[
          '7 poziomów: hero / title / lead / body / caption / label / micro',
          'Display font dla hero/title/lead/body, mono dla label/micro',
          'Każdy poziom ma określone line-height i tracking — nigdy nie improwizujemy',
          'Hero rezerwowany dla telemetrii (race time) i leaderboardu — 56px+',
        ]}/>
      </SplitBody>
    </>
  );
}

// =====================================================================================
// SECTION 3 — TELEMETRY TOKENS
// =====================================================================================
function Section3() {
  return (
    <>
      <ArtboardHead num="03" title="Telemetry tokens"
        sub="Race times, splits, deltas, rank numbers — RDZEŃ produktu. Dziś każdy ekran rysuje je inaczej. Powinny mieć dedykowane tokeny." />
      <SplitBody>
        <Column kind="today">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            Każdy ekran improwizuje:
          </div>
          {/* sample 1 */}
          <div style={{ marginBottom: 18, padding: 14, border: `1px solid ${A.border}`, background: A.panel }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted, marginBottom: 8,
              letterSpacing: '0.24em', fontWeight: 700 }}>RUN REVIEW</div>
            <div style={{ fontFamily: F.display, fontSize: 56, fontWeight: 800, color: A.text,
              letterSpacing: '-0.01em', lineHeight: 1 }}>02:14.83</div>
          </div>
          {/* sample 2 */}
          <div style={{ marginBottom: 18, padding: 14, border: `1px solid ${A.border}`, background: A.panel }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted, marginBottom: 8,
              letterSpacing: '0.24em', fontWeight: 700 }}>LEADERBOARD ROW</div>
            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: A.text }}>2:14.83</div>
          </div>
          {/* sample 3 */}
          <div style={{ padding: 14, border: `1px solid ${A.border}`, background: A.panel }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted, marginBottom: 8,
              letterSpacing: '0.24em', fontWeight: 700 }}>HOME WIDGET</div>
            <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, color: A.text }}>2:14</div>
          </div>

          <div style={{ marginTop: 22, padding: 14, background: 'rgba(255,71,87,0.06)',
            border: `1px solid rgba(255,71,87,0.2)`, fontFamily: F.body, fontSize: 13,
            color: A.text, lineHeight: 1.5 }}>
            ⚠ Ta sama dana (2:14.83) wygląda za każdym razem inaczej. Brak DNA telemetrii.
          </div>
        </Column>

        <Column kind="proposal">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            Dedykowane tokeny dla danych liczbowych — zawsze tak samo:
          </div>

          {/* timer.hero */}
          <div style={{ marginBottom: 14, padding: 16, background: A.panel,
            borderLeft: `3px solid ${A.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: A.accent,
                letterSpacing: '0.24em', fontWeight: 800 }}>TIMER · HERO</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted }}>56/800/-1</span>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 56, fontWeight: 800, color: A.text,
              letterSpacing: '-0.01em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              02:14.<span style={{ color: A.textMuted }}>83</span>
            </div>
          </div>

          {/* timer.split */}
          <div style={{ marginBottom: 14, padding: 16, background: A.panel,
            borderLeft: `3px solid ${A.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: A.accent,
                letterSpacing: '0.24em', fontWeight: 800 }}>TIMER · SPLIT</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted }}>26/700</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: A.textMuted,
                letterSpacing: '0.2em', fontWeight: 700 }}>G2</span>
              <span style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, color: A.text,
                fontVariantNumeric: 'tabular-nums' }}>00:31.8</span>
              <span style={{ fontFamily: F.mono, fontSize: 13, color: A.accent, fontWeight: 800 }}>−0.5</span>
            </div>
          </div>

          {/* delta */}
          <div style={{ marginBottom: 14, padding: 16, background: A.panel,
            borderLeft: `3px solid ${A.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: A.accent,
                letterSpacing: '0.24em', fontWeight: 800 }}>DELTA · PB</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted }}>18/800</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 800, color: A.accent,
                fontVariantNumeric: 'tabular-nums' }}>−1.42</span>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: A.textMuted,
                letterSpacing: '0.24em', fontWeight: 700 }}>PB</span>
            </div>
          </div>

          {/* position.rank */}
          <div style={{ padding: 16, background: A.panel,
            borderLeft: `3px solid ${A.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: A.accent,
                letterSpacing: '0.24em', fontWeight: 800 }}>POSITION · RANK</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted }}>88/900/-2</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: F.display, fontSize: 88, fontWeight: 900, color: A.text,
                letterSpacing: '-0.04em', lineHeight: 0.85, fontVariantNumeric: 'tabular-nums' }}>07</span>
              <span style={{ fontFamily: F.mono, fontSize: 12, color: A.textMuted,
                letterSpacing: '0.2em', fontWeight: 700 }}>/ 142</span>
            </div>
          </div>
        </Column>

        <Verdict items={[
          'timer.hero (56px) · timer.split (26px) · delta (18px mono) · position.rank (88px display)',
          'Wszystkie liczby z fontVariantNumeric: tabular-nums (cyfry o stałej szerokości — kluczowe dla telemetrii)',
          'Setne sekundy w hero przyciemnione (.83) — wzrok łapie 02:14, sotne to detal',
          'Delta zawsze w mono z znakiem ±, kolor = stan (zielony lepiej, czerwony gorzej)',
        ]}/>
      </SplitBody>
    </>
  );
}

// =====================================================================================
// SECTION 4 — MOTION TOKENS
// =====================================================================================
function Section4() {
  return (
    <>
      <ArtboardHead num="04" title="Motion tokens"
        sub="Animacje są dziś hard-coded w komponentach (1.4s breathe, 2s pulse). Każda ma intencję — powinny być nazwane wg roli, nie czasu trwania." />
      <SplitBody>
        <Column kind="today">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            Magic numbers rozsiane po projekcie:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: F.mono, fontSize: 12 }}>
            {[
              ['screens-run.jsx', 'breathe 1.4s ease-in-out infinite'],
              ['screens-onboarding.jsx', 'breathe 1s ease-in-out infinite'],
              ['screens-onboarding.jsx', 'gateLight 1.2s ease-in-out'],
              ['screens-onboarding.jsx', 'spark 2.8s ease-out'],
              ['screens-onboarding.jsx', 'glitchScan 4.2s ease-in-out infinite'],
              ['ui.jsx', 'pulse-ring 2.4s ease-out infinite'],
              ['screens-run.jsx', 'dashScroll 0.8s linear infinite'],
            ].map(([file, anim], i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12,
                padding: '6px 0', borderBottom: `1px solid ${A.border}` }}>
                <span style={{ color: A.textMuted, fontSize: 10 }}>{file}</span>
                <span style={{ color: A.text }}>{anim}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22, padding: 14, background: 'rgba(255,71,87,0.06)',
            border: `1px solid rgba(255,71,87,0.2)`, fontFamily: F.body, fontSize: 13,
            color: A.text, lineHeight: 1.5 }}>
            ⚠ "1.4s breathe" — ale czy to armed czy verified? Nikt nie wie bez czytania.
          </div>
        </Column>

        <Column kind="proposal">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            Nazwane wg INTENCJI — szybkość kodowana w nazwie:
          </div>

          {[
            { name: 'pulse.armed', dur: '1.2s', use: 'jadę pod ranking · puls "live"',
              demo: <div style={{ width: 32, height: 32, borderRadius: '50%', background: A.accent,
                animation: 'auditPulseFast 1.2s ease-in-out infinite' }}/> },
            { name: 'pulse.verified', dur: '2.4s', use: 'zaliczone · spokojny oddech',
              demo: <div style={{ width: 32, height: 32, borderRadius: '50%', background: A.accent,
                animation: 'auditPulseSlow 2.4s ease-in-out infinite' }}/> },
            { name: 'pulse.pending', dur: '0.6s', use: 'walidujemy · niespokojny blink',
              demo: <div style={{ width: 32, height: 32, borderRadius: '50%', background: A.warn,
                animation: 'auditBlink 0.6s linear infinite' }}/> },
            { name: 'scan.ambient', dur: '4.2s', use: 'scan line w game-HUD · ambient',
              demo: <div style={{ width: 32, height: 32, position: 'relative', overflow: 'hidden',
                border: `1px solid ${A.borderHot}` }}>
                <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: A.accent,
                  animation: 'auditScan 4.2s ease-in-out infinite' }}/>
              </div> },
            { name: 'spark.particle', dur: '2.8s', use: 'iskry · particle field',
              demo: <div style={{ width: 32, height: 32, position: 'relative' }}>
                {[0, 0.4, 0.8, 1.2].map(d => (
                  <div key={d} style={{ position: 'absolute', left: '50%', bottom: 4, width: 3, height: 3,
                    background: A.accent, borderRadius: '50%',
                    animation: `auditSpark 2.8s ease-out ${d}s infinite` }}/>
                ))}
              </div> },
            { name: 'glitch.event', dur: '0.4s', use: 'rzadki glitch · ważne wydarzenie',
              demo: <div style={{ width: 32, height: 32, position: 'relative',
                background: A.panelHi, border: `1px solid ${A.border}`,
                animation: 'auditGlitch 5s linear infinite' }}/> },
          ].map(m => (
            <div key={m.name} style={{
              display: 'grid', gridTemplateColumns: '40px 140px 60px 1fr', gap: 12,
              alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${A.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.demo}
              </div>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: A.accent, fontWeight: 800 }}>
                {m.name}
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: A.textMuted }}>{m.dur}</span>
              <span style={{ fontFamily: F.body, fontSize: 12, color: A.text }}>{m.use}</span>
            </div>
          ))}
        </Column>

        <Verdict items={[
          'Animacje nazwane przez ROLĘ: pulse.armed, scan.ambient, glitch.event',
          'Tempo koduje stan: szybsze = bardziej urgent (armed 1.2s vs verified 2.4s)',
          'Jeden token w kodzie = jeden behavior w produkcie',
          'Możemy wyłączyć motion = honoruj prefers-reduced-motion z poziomu DS',
        ]}/>
      </SplitBody>
    </>
  );
}

Object.assign(window, { Section1, Section2, Section3, Section4 });
