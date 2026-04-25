// Sections 5-8: Elevation, Chrome primitives, Voice/tone, Icons

// =====================================================================================
// SECTION 5 — ELEVATION SYSTEM
// =====================================================================================
function Section5() {
  return (
    <>
      <ArtboardHead num="05" title="Elevation system"
        sub="Game UI ma warstwy: chrome (frame) → panel → row → row-hot → overlay. Dziś mamy tylko bgCard / bgCardHi — za mało żeby budować gęste interfejsy bez gubienia hierarchii." />
      <SplitBody>
        <Column kind="today">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            2 poziomy: bgCard / bgCardHi
          </div>
          <div style={{ background: '#13181A', padding: 16, marginBottom: 16,
            border: `1px solid ${A.border}` }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted, letterSpacing: '0.24em', marginBottom: 6 }}>BGCARD · #13181A</div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: A.text }}>Karta podstawowa</div>
            <div style={{ background: '#1A2124', padding: 12, marginTop: 12,
              border: `1px solid ${A.border}` }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted, letterSpacing: '0.24em', marginBottom: 6 }}>BGCARDHI · #1A2124</div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: A.text }}>...zagnieżdżona</div>
              <div style={{ background: '#1A2124', padding: 10, marginTop: 10,
                border: `1px solid ${A.border}` }}>
                <div style={{ fontFamily: F.body, fontSize: 12, color: A.textMuted }}>i kolejna? (taki sam kolor)</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22, padding: 14, background: 'rgba(255,71,87,0.06)',
            border: `1px solid rgba(255,71,87,0.2)`, fontFamily: F.body, fontSize: 13,
            color: A.text, lineHeight: 1.5 }}>
            ⚠ Po 2 poziomach hierarchia się gubi. Brak różnicy między panelem a aktywnym wierszem.
          </div>
        </Column>

        <Column kind="proposal">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            5 poziomów. Każdy = inna jasność + inny border:
          </div>

          {[
            { name: 'elev.0 · bg', color: '#07090A', border: 'transparent', use: 'tło ekranu' },
            { name: 'elev.1 · chrome', color: '#0E1112', border: 'rgba(255,255,255,0.04)', use: 'paski, nav, frame' },
            { name: 'elev.2 · panel', color: '#13181A', border: 'rgba(255,255,255,0.06)', use: 'karty, sekcje' },
            { name: 'elev.3 · row', color: '#1A2124', border: 'rgba(255,255,255,0.08)', use: 'wiersze listy, tile' },
            { name: 'elev.4 · row-hot', color: '#1A2124', border: A.borderHot,
              use: 'aktywny / armed wiersz', glow: true },
          ].map(e => (
            <div key={e.name} style={{
              background: e.color, padding: '14px 16px', marginBottom: 8,
              border: `1px solid ${e.border}`,
              boxShadow: e.glow ? `0 0 24px rgba(0,255,135,0.15)` : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: A.accent,
                  letterSpacing: '0.24em', fontWeight: 800 }}>{e.name}</div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: A.textMuted, marginTop: 2 }}>
                  {e.use}
                </div>
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textDim }}>{e.color}</div>
            </div>
          ))}

          {/* nested example */}
          <div style={{ background: '#0E1112', padding: 14, marginTop: 18,
            border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textDim, letterSpacing: '0.24em', marginBottom: 10 }}>elev.1</div>
            <div style={{ background: '#13181A', padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textDim, letterSpacing: '0.24em', marginBottom: 8 }}>elev.2</div>
              <div style={{ background: '#1A2124', padding: 10, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: A.text }}>elev.3 — zwykły wiersz</div>
              </div>
              <div style={{ background: '#1A2124', padding: 10, border: `1px solid ${A.borderHot}`,
                boxShadow: `0 0 16px rgba(0,255,135,0.15)` }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: A.text }}>elev.4 — armed wiersz ●</div>
              </div>
            </div>
          </div>
        </Column>

        <Verdict items={[
          '5 poziomów (bg / chrome / panel / row / row-hot) — każdy z kolorem + borderem',
          'elev.4 (row-hot) = jedyny z borderem akcentowym + glow — sygnał "TO TERAZ"',
          'Nigdy nie nestujemy więcej niż 3 poziomów (czytelność)',
          'Glow wyłączony przy reduced-motion, ale border zostaje',
        ]}/>
      </SplitBody>
    </>
  );
}

// =====================================================================================
// SECTION 6 — CHROME PRIMITIVES
// =====================================================================================
function Section6() {
  return (
    <>
      <ArtboardHead num="06" title="Chrome primitives"
        sub="Game UI dekorów (corner brackets, scan lines, race numbers, system text) używamy w 5+ miejscach. Powinny być reusable komponentami z DS, nie kopiowanym SVG-iem." />
      <SplitBody>
        <Column kind="today">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 16 }}>
            Chrome rysowany ad-hoc — kopiuj-wklej SVG paths:
          </div>
          <pre style={{
            fontFamily: F.mono, fontSize: 10, color: A.text, background: A.panel,
            border: `1px solid ${A.border}`, padding: 14, lineHeight: 1.6,
            overflow: 'hidden', margin: 0, whiteSpace: 'pre-wrap',
          }}>{`// w 4 plikach po kawałku:
<path d="M14 28 L14 14 L28 14"
  stroke={c.accent} strokeWidth="1.5"/>
<path d="M326 14 L312 14 L312 28"
  stroke={c.accent} strokeWidth="1.5"/>
// ...mnożone × 4 rogi × 5 ekranów`}</pre>

          <div style={{ marginTop: 22, padding: 14, background: 'rgba(255,71,87,0.06)',
            border: `1px solid rgba(255,71,87,0.2)`, fontFamily: F.body, fontSize: 13,
            color: A.text, lineHeight: 1.5 }}>
            ⚠ Zmiana grubości stroke = edycja w 20 miejscach.
          </div>
        </Column>

        <Column kind="proposal">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 16 }}>
            6 reusable komponentów chrome:
          </div>

          {/* HUD frame demo */}
          <div style={{
            position: 'relative', height: 200, background: A.panel,
            border: `1px solid ${A.border}`, marginBottom: 14, padding: 16,
          }}>
            {/* corner brackets — 4 rogi */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <path d="M2 10 L2 2 L10 2" fill="none" stroke={A.accent} strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
              <path d="M90 2 L98 2 L98 10" fill="none" stroke={A.accent} strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
              <path d="M2 90 L2 98 L10 98" fill="none" stroke={A.accent} strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
              <path d="M90 98 L98 98 L98 90" fill="none" stroke={A.accent} strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
            </svg>
            {/* scan lines */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.06,
              backgroundImage: `repeating-linear-gradient(0deg, ${A.text} 0 0.5px, transparent 0.5px 3px)`,
            }}/>
            {/* big race number */}
            <div style={{
              position: 'absolute', right: 12, top: 12,
              fontFamily: F.display, fontSize: 100, fontWeight: 900,
              color: A.text, opacity: 0.04, letterSpacing: '-0.06em', lineHeight: 0.8,
            }}>03</div>
            {/* system text */}
            <div style={{ position: 'absolute', left: 16, bottom: 14, fontFamily: F.mono,
              fontSize: 9, color: A.textMuted, letterSpacing: '0.24em', fontWeight: 700 }}>
              SLOT 03/07 · SLOTWINY
            </div>
            <div style={{ position: 'absolute', right: 16, bottom: 14, fontFamily: F.mono,
              fontSize: 9, color: A.accent, letterSpacing: '0.24em', fontWeight: 800 }}>
              ● LIVE
            </div>
            {/* center title */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: F.display, fontSize: 24, fontWeight: 800, color: A.text,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>HUD FRAME</div>
          </div>

          {/* primitives list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['<HudFrame>', 'Pełna ramka: corner brackets + scan lines'],
              ['<CornerBrackets size weight>', 'Same brackets, do nakładania'],
              ['<ScanLines opacity>', 'Overlay z liniami CRT'],
              ['<RaceNumber n size>', 'Watermark cyfra w tle (jersey)'],
              ['<SystemText slot>', 'Mono caption w rogu (LIVE / SLOT 01)'],
              ['<HudPanel title status>', 'Panel telemetrii z kapsową etykietą'],
            ].map(([code, desc], i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12,
                padding: '6px 0', borderBottom: `1px solid ${A.border}`, alignItems: 'baseline',
              }}>
                <code style={{ fontFamily: F.mono, fontSize: 11, color: A.accent, fontWeight: 700 }}>
                  {code}
                </code>
                <span style={{ fontFamily: F.body, fontSize: 12, color: A.text }}>{desc}</span>
              </div>
            ))}
          </div>
        </Column>

        <Verdict items={[
          '6 chrome primitives jako komponenty — jedna implementacja, zmiana w 1 miejscu',
          '<HudFrame> opakowuje cały panel — 1 linijka zamiast 4 SVG paths',
          'RaceNumber używa fontu display, opacity 0.04 — game-jersey watermark',
          'Wszystkie primitives czytają z tokens (kolor accentu, font display) — palette swap = wszystko się aktualizuje',
        ]}/>
      </SplitBody>
    </>
  );
}

// =====================================================================================
// SECTION 7 — VOICE & TONE
// =====================================================================================
function Section7() {
  return (
    <>
      <ArtboardHead num="07" title="Voice & tone"
        sub="Copy w produkcie ma silny ton: krótko, kapsy, sport. Ale zasady żyją w głowie autora — design system powinien je kodyfikować." />
      <SplitBody>
        <Column kind="today">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            Inkonsystencje, które już widać w produkcie:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['CTA · onbo 1', 'WEJDŹ DO LIGI', 'CAPS · imperative'],
              ['CTA · onbo 2', 'ROZUMIEM', 'CAPS · 1st person'],
              ['CTA · onbo 3', 'ZACZYNAM', 'CAPS · 1st person'],
              ['CTA · home', 'Wybierz spot', 'Sentence case (?)'],
              ['CTA · auth', 'WYŚLIJ KOD', 'CAPS'],
              ['Status', 'STATUS', 'CAPS · widget label'],
              ['Status', 'Live', 'Title case (?)'],
            ].map(([loc, copy, note], i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px', gap: 12,
                padding: '8px 0', borderBottom: `1px solid ${A.border}`, alignItems: 'baseline' }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: A.textMuted, letterSpacing: '0.2em', fontWeight: 700 }}>{loc}</span>
                <span style={{ fontFamily: F.display, fontSize: 14, color: A.text, fontWeight: 700 }}>{copy}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: A.textDim }}>{note}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, padding: 14, background: 'rgba(255,71,87,0.06)',
            border: `1px solid rgba(255,71,87,0.2)`, fontFamily: F.body, fontSize: 13,
            color: A.text, lineHeight: 1.5 }}>
            ⚠ Mix CAPS / Title / Sentence case bez reguły. Akronimy (PB, DNF, GPS) nie zdefiniowane.
          </div>
        </Column>

        <Column kind="proposal">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            Reguły zapisane jako tokeny voice:
          </div>

          {[
            { token: 'voice.cta', rule: 'CAPS · 1-2 słowa · imperative', samples: ['WEJDŹ', 'ZACZYNAM', 'WYŚLIJ KOD'] },
            { token: 'voice.status', rule: 'CAPS · 1 słowo · stan rzeczy', samples: ['LIVE', 'VERIFIED', 'ARMED'] },
            { token: 'voice.label', rule: 'CAPS · letter-spaced · meta', samples: ['STATUS', 'BIKE PARK', 'RIDER'] },
            { token: 'voice.title', rule: 'Sentence case · krótko · proste', samples: ['Twoja góra. Twój czas.', 'Liczą się tylko czyste zjazdy.'] },
            { token: 'voice.body', rule: 'Sentence case · 1-2 zdania', samples: ['Startuj z bramki, finiszuj na końcu. Tylko czyste przejazdy trafiają na tablicę.'] },
            { token: 'voice.acronym', rule: 'CAPS · zawsze 3 litery max', samples: ['PB', 'DNF', 'GPS', 'KOM', 'DH'] },
          ].map(v => (
            <div key={v.token} style={{ marginBottom: 14, padding: 14, background: A.panel,
              borderLeft: `3px solid ${A.accent}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <code style={{ fontFamily: F.mono, fontSize: 11, color: A.accent, fontWeight: 800 }}>
                  {v.token}
                </code>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted,
                  letterSpacing: '0.2em', fontWeight: 700 }}>{v.rule}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {v.samples.map((s, i) => (
                  <span key={i} style={{
                    fontFamily: v.token === 'voice.title' || v.token === 'voice.body' ? F.body : F.display,
                    fontSize: v.token === 'voice.body' ? 12 : 13,
                    fontWeight: v.token === 'voice.body' ? 400 : 700,
                    color: A.text,
                    padding: '4px 10px',
                    background: A.bg,
                    border: `1px solid ${A.border}`,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          ))}

          {/* Forbidden examples */}
          <div style={{ marginTop: 6, padding: 12, background: 'rgba(255,71,87,0.04)',
            border: '1px dashed rgba(255,71,87,0.25)' }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: A.danger, letterSpacing: '0.24em', fontWeight: 800, marginBottom: 8 }}>
              ✕ NIGDY NIE PISZEMY:
            </div>
            <div style={{ fontFamily: F.body, fontSize: 12, color: A.textMuted, lineHeight: 1.6 }}>
              "Czy chciałbyś rozpocząć przejazd?" · "Świetnie!" · "Niestety, coś poszło nie tak" · pełnych zdań w CTA · emoji w UI
            </div>
          </div>
        </Column>

        <Verdict items={[
          '6 voice tokens: cta / status / label / title / body / acronym',
          'CTA zawsze CAPS + imperative ("WEJDŹ", nie "Wejdź teraz")',
          'Title sentence case (czytelne) · Status CAPS (race-game DNA)',
          'Akronimy 3 litery max — PB/DNF/KOM/DH/GPS — gracze już znają',
          'Zakaz przepraszania, zachęcania emoji, zdań pytających w UI',
        ]}/>
      </SplitBody>
    </>
  );
}

// =====================================================================================
// SECTION 8 — ICON SYSTEM
// =====================================================================================
function Section8() {
  // glyph SVG primitives — proposal version (consistent stroke, square caps, 24x24)
  const Icon = ({ d, size = 28, fill = false }) => (
    <svg viewBox="0 0 24 24" width={size} height={size}
      style={{ stroke: A.text, strokeWidth: 1.6, fill: fill ? A.text : 'none',
        strokeLinecap: 'square', strokeLinejoin: 'miter' }}>
      {d}
    </svg>
  );

  const proposalIcons = [
    { name: 'gate', svg: <><path d="M5 4 L5 20 M19 4 L19 20"/><path d="M5 8 L19 8 M5 12 L19 12 M5 16 L19 16"/></>},
    { name: 'flag', svg: <><path d="M5 21 L5 4"/><path d="M5 5 L19 5 L17 9 L19 13 L5 13"/></>},
    { name: 'split', svg: <><path d="M4 12 L20 12 M4 12 L8 8 M4 12 L8 16 M20 12 L16 8 M20 12 L16 16"/></>},
    { name: 'podium', svg: <><path d="M3 21 L21 21 M9 21 L9 11 L15 11 L15 21 M3 21 L3 15 L9 15 M21 21 L21 17 L15 17"/></>},
    { name: 'verified', svg: <><path d="M3 12 L9 18 L21 6"/></>},
    { name: 'lock', svg: <><path d="M6 11 L18 11 L18 21 L6 21 Z M9 11 L9 7 A3 3 0 0 1 15 7 L15 11"/></>},
    { name: 'lift', svg: <><path d="M3 6 L21 14 M5 5 L7 7 M11 8 L13 10 M17 11 L19 13"/></>},
    { name: 'line', svg: <><path d="M3 18 C8 4, 16 20, 21 6"/></>},
    { name: 'spot', svg: <><circle cx="12" cy="10" r="4"/><path d="M12 14 L12 21 M8 21 L16 21"/></>},
    { name: 'bike', svg: <><circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16 L11 8 L18 16 M11 8 L8 8 M11 8 L13 5"/></>},
    { name: 'timer', svg: <><circle cx="12" cy="13" r="7"/><path d="M12 13 L12 9 M9 4 L15 4"/></>},
    { name: 'rec', svg: <><circle cx="12" cy="12" r="4" fill={A.accent} stroke="none"/><circle cx="12" cy="12" r="9"/></>},
  ];

  return (
    <>
      <ArtboardHead num="08" title="Icon system"
        sub="Dziś ikony rysujemy ad-hoc per ekran (różne stroke, różne caps, różne grid). Game-DH apka potrzebuje ~12 spójnych glifów: gate / flag / split / podium / verified / lock / lift / line / spot / bike / timer / rec." />
      <SplitBody>
        <Column kind="today">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            Niespójne — różne stroke, niejednolite cap style, różne grid:
          </div>
          {/* Demo: same icons drawn 3 different ways */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { sw: 2.5, lc: 'round', size: 32, label: 'onbo: 2.5px round' },
              { sw: 1.5, lc: 'square', size: 24, label: 'home: 1.5px square' },
              { sw: 2, lc: 'butt', size: 28, label: 'spot: 2px butt' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: 14, background: A.panel, border: `1px solid ${A.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <svg viewBox="0 0 24 24" width={s.size} height={s.size}
                  style={{ stroke: A.text, strokeWidth: s.sw, fill: 'none', strokeLinecap: s.lc }}>
                  <path d="M5 4 L5 20 M19 4 L19 20 M5 8 L19 8 M5 12 L19 12 M5 16 L19 16"/>
                </svg>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted,
                  letterSpacing: '0.2em', fontWeight: 700, textAlign: 'center' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, padding: 14, background: 'rgba(255,71,87,0.06)',
            border: `1px solid rgba(255,71,87,0.2)`, fontFamily: F.body, fontSize: 13,
            color: A.text, lineHeight: 1.5 }}>
            ⚠ Ta sama "gate" ikona jest rysowana 3× inaczej w 3 ekranach.
          </div>
        </Column>

        <Column kind="proposal">
          <div style={{ fontFamily: F.body, fontSize: 13, color: A.textMuted, marginBottom: 20 }}>
            12 glifów · 24×24 grid · stroke 1.6px · square caps · #1 fill option:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {proposalIcons.map(ic => (
              <div key={ic.name} style={{
                padding: '14px 8px', background: A.panel, border: `1px solid ${A.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}>
                <Icon d={ic.svg} size={28}/>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: A.textMuted,
                  letterSpacing: '0.16em', fontWeight: 700, textAlign: 'center' }}>{ic.name}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, padding: 12, background: A.panel, border: `1px solid ${A.border}`,
            fontFamily: F.mono, fontSize: 10, color: A.textMuted, lineHeight: 1.7 }}>
            <span style={{ color: A.accent, fontWeight: 800 }}>SPEC</span> · viewBox 0 0 24 24 ·
            stroke 1.6px · linecap square · linejoin miter · domyślnie kolor `c.text` ·
            wariant accent przez prop · wariant filled dla "rec" + "verified" badge
          </div>
        </Column>

        <Verdict items={[
          '12 glifów wystarcza pod cały produkt: gate flag split podium verified lock lift line spot bike timer rec',
          'Wszystkie 24×24, stroke 1.6, square caps — kątowy game-look (nie zaokrąglony Stripe-look)',
          'Każda ma 3 warianty: outline default · accent (kolor) · filled (rec, verified)',
          'Komponent <Icon name="gate" variant="accent"/> — jedna referencja w kodzie',
        ]}/>
      </SplitBody>
    </>
  );
}

Object.assign(window, { Section5, Section6, Section7, Section8 });
