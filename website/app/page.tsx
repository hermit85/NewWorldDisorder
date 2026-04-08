import Link from 'next/link';
import Image from 'next/image';

// Real product asset — the actual NWD iOS app icon
const APP_ICON = '/brand/icon.png';

export default function HomePage() {
  return (
    <main className="landing">
      {/* ════════════════════════════════════════════════
          1 // HERO
         ════════════════════════════════════════════════ */}
      <section className="lp-hero2">
        <div className="lp-wide">
          {/* Telemetry strip */}
          <div className="lp-telestrip" aria-hidden="true">
            <div>
              <span className="k">SEZON</span>
              <span className="v">01 / 2026</span>
            </div>
            <div>
              <span className="k">STAGE</span>
              <span className="v">01 — SŁOTWINY</span>
            </div>
            <div>
              <span className="k">TRYB</span>
              <span className="v">LIGA · GRAVITY</span>
            </div>
            <div>
              <span className="live">SYGNAŁ AKTYWNY</span>
            </div>
          </div>

          {/* Headline + HUD */}
          <div className="lp-hero2-grid">
            <div>
              <div className="lp-hero-icon-row">
                <Image
                  src={APP_ICON}
                  alt="NWD"
                  width={72}
                  height={72}
                  priority
                  className="lp-hero-icon"
                />
                <div className="lp-hero-icon-meta">
                  <span className="t1">NEW WORLD DISORDER</span>
                  <span className="t2">LIGA GRAVITY · iOS · SEZON 01</span>
                </div>
              </div>

              <h1 className="lp-stage-h1">
                <span className="line">WJEDŹ.</span>
                <span className="line">ZALICZ.</span>
                <span className="line">WRÓĆ <span className="red">NA GÓRĘ<span className="dot" /></span></span>
              </h1>

              <p className="lp-stage-sub">
                NWD to gra arcade gravity rozgrywana na prawdziwych ośrodkach.
                Bramka, trasa, meta, tablica. Czas albo PB. Pozycja albo żadna.
                Tylko jedno pytanie po mecie: jeszcze raz?
              </p>

              <div className="lp-cta-row2">
                <a className="lp-btn2 red" href="#cta">
                  Bądź na liście <span className="arr">→</span>
                </a>
                <a className="lp-btn2" href="#loop">Jak to działa</a>
                <span className="lp-cta-meta">
                  <span className="pulse" />
                  iOS // App Store // dzień zero
                </span>
              </div>
            </div>

            {/* HUD result tower */}
            <div style={{ position: 'relative' }}>
              <div className="lp-pos-tag" aria-hidden="true">
                <span className="small">POZYCJA</span>
                #07
              </div>
              <div className="lp-hud" aria-hidden="true">
                <div className="lp-hud-head">
                  <span>RESULT // GAŁGAN // STAGE 01</span>
                  <span className="dotline">LIVE</span>
                </div>
                <div className="lp-hud-body">
                  <div className="lp-hud-trail">GAŁGAN · DROP 220m</div>
                  <div className="lp-hud-stat-line">
                    <span className="check">✓</span>
                    ZWERYFIKOWANY · RANKING
                  </div>
                  <div className="lp-hud-time">
                    02:14<span className="ms">.86</span>
                  </div>
                  <div className="lp-hud-pb">
                    <span className="pill">PB</span>
                    −1.4s LEPIEJ NIŻ POPRZEDNIO
                  </div>
                </div>
                <div className="lp-hud-grid3">
                  <div>
                    <span className="label">POZYCJA</span>
                    <span className="value up">#7</span>
                  </div>
                  <div>
                    <span className="label">Δ SEZON</span>
                    <span className="value up">↑3</span>
                  </div>
                  <div>
                    <span className="label">RANGA</span>
                    <span className="value">HUNTER</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          MARQUEE — single slim ticker
         ════════════════════════════════════════════════ */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          <span>STAGE 01 // SŁOTWINY ARENA</span><span className="star">▸</span>
          <span>GAŁGAN — 02:14.86</span><span className="star">◆</span>
          <span>DOOKOŁA ŚWIATA — 03:08.42</span><span className="star">▸</span>
          <span>KOMETA — 02:46.15</span><span className="star">◆</span>
          <span>DZIDA — 01:58.07</span><span className="star">▸</span>
          <span>JESZCZE JEDEN ZJAZD</span><span className="star">◆</span>
          {/* loop dup */}
          <span>STAGE 01 // SŁOTWINY ARENA</span><span className="star">▸</span>
          <span>GAŁGAN — 02:14.86</span><span className="star">◆</span>
          <span>DOOKOŁA ŚWIATA — 03:08.42</span><span className="star">▸</span>
          <span>KOMETA — 02:46.15</span><span className="star">◆</span>
          <span>DZIDA — 01:58.07</span><span className="star">▸</span>
          <span>JESZCZE JEDEN ZJAZD</span><span className="star">◆</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          2 // PĘTLA — compressed inline strip
         ════════════════════════════════════════════════ */}
      <section className="lp-block tight" id="loop">
        <div className="lp-block-label">
          <span><span className="num">§01</span> // PĘTLA</span>
        </div>
        <div className="lp-wide">
          <h2 className="lp-h2-2">
            CZTERY KROKI.<br />
            <span className="red">JEDNA PĘTLA.</span>
          </h2>

          <div className="lp-loop-strip">
            <div className="lp-strip-phase">
              <div className="ix">01 / BRAMKA</div>
              <div className="t">STAŃ PRZY STARCIE</div>
              <div className="d">Apka wykrywa bramkę. Jeden tap — uzbrojenie.</div>
            </div>
            <div className="lp-strip-phase">
              <div className="ix">02 / ZJAZD</div>
              <div className="t">SCHOWAJ TELEFON</div>
              <div className="d">Timer leci od bramki, meta kończy automatycznie.</div>
            </div>
            <div className="lp-strip-phase">
              <div className="ix">03 / WYNIK</div>
              <div className="t">CZAS · POZYCJA</div>
              <div className="d">Weryfikacja, PB delta, rywal nad Tobą — w 60s.</div>
            </div>
            <div className="lp-strip-phase">
              <div className="ix">04 / LOOP</div>
              <div className="t">JESZCZE RAZ</div>
              <div className="d">Wyciąg działa do 17:00. Bramka znów otwarta.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          PULL QUOTE BAND — anti-tracker positioning
         ════════════════════════════════════════════════ */}
      <section className="lp-quote">
        <div className="lp-wide">
          <span className="label">§02 // POZYCJONOWANIE</span>
          <h2>
            TO NIE <span className="strike">TRACKER</span>.<br />
            TO <span className="red">LIGA</span>.
          </h2>
          <p className="sub">
            Bez wykresów, bez treningu, bez wymówek. Tylko czas, miejsce
            i kolejny start.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          3 // EKRANY — screen showcase
         ════════════════════════════════════════════════ */}
      <section className="lp-block tight">
        <div className="lp-block-label">
          <span><span className="num">§03</span> // EKRANY</span>
        </div>
        <div className="lp-wide">
          <h2 className="lp-h2-2">
            TRZY EKRANY.<br />
            JEDNO PYTANIE: <span className="red">JESZCZE RAZ?</span>
          </h2>

          {/* ──────────────────────────────────────────────
              Three phone screens — pixel-faithful HTML
              transcriptions of the actual React Native screens
              shipped in app/(tabs)/profile.tsx,
              app/(tabs)/index.tsx (start/Słotwiny),
              app/(tabs)/leaderboard.tsx.

              Same fonts (Orbitron + Inter), same hex tokens
              (src/theme/colors.ts), same rank icons
              (src/systems/ranks.ts), same trail data
              (src/data/seed/slotwinyOfficial.ts), same copy.
              ────────────────────────────────────────────── */}
          <div className="lp-screens3">
            {/* ═══ PHONE 01 // RIDER ═══ */}
            <div className="lp-scr-wrap">
              <div className="phone3">
                <div className="phone3-screen scr-rider">
                  <div className="scr-status">
                    <span>9:41</span>
                    <span className="ind">●●●●●</span>
                  </div>
                  <div className="scr-rider-card">
                    <div className="scr-rider-avatar">▲</div>
                    <div className="scr-rider-name">k.rajder</div>
                    <div className="scr-rider-rank">
                      <span className="lvl">12</span>
                      <span className="rname">HUNTER</span>
                    </div>
                    <div className="scr-rider-xp">
                      <div className="bar"><i style={{ width: '62%' }} /></div>
                      <div className="cap">LVL 12 · 1240 / 2000 XP</div>
                    </div>
                    <div className="scr-rider-rankprog">
                      <div className="bar"><i style={{ width: '34%' }} /></div>
                      <div className="cap">
                        <span className="from">▲ HUNTER</span>
                        <span className="arrow">→</span>
                        <span className="to">★ SLAYER</span>
                        <span className="need">· 760 XP</span>
                      </div>
                    </div>
                  </div>

                  <div className="scr-rider-stats">
                    <div className="cell">
                      <div className="v">23</div>
                      <div className="l">ZJAZDÓW</div>
                    </div>
                    <div className="cell">
                      <div className="v">4</div>
                      <div className="l">REKORDÓW</div>
                    </div>
                    <div className="cell">
                      <div className="v">#7</div>
                      <div className="l">POZYCJA</div>
                    </div>
                  </div>

                  <div className="scr-section-label">OSIĄGNIĘCIA · 3 / 7</div>
                  <div className="scr-ach-grid">
                    <div className="ach unlocked"><div className="badge">▲</div><div className="nm">First Blood</div></div>
                    <div className="ach unlocked"><div className="badge">★</div><div className="nm">Top 10</div></div>
                    <div className="ach unlocked"><div className="badge">◆</div><div className="nm">Weekend Warrior</div></div>
                    <div className="ach"><div className="badge">⚡</div><div className="nm">???</div></div>
                    <div className="ach"><div className="badge">◇</div><div className="nm">???</div></div>
                    <div className="ach"><div className="badge">♛</div><div className="nm">???</div></div>
                  </div>

                  <div className="scr-tabbar">
                    <div className="tab">START</div>
                    <div className="tab">ZJAZDY</div>
                    <div className="tab">TABLICA</div>
                    <div className="tab active">RIDER</div>
                  </div>
                </div>
              </div>
              <div className="lp-scr-cap">
                <span><span className="num">01</span> RIDER</span>
                <span>HUNTER · LVL 12</span>
              </div>
            </div>

            {/* ═══ PHONE 02 // START — Słotwiny ═══ */}
            <div className="lp-scr-wrap center">
              <div className="phone3">
                <div className="phone3-screen scr-start">
                  <div className="scr-status">
                    <span>9:41</span>
                    <span className="ind">●●●●●</span>
                  </div>
                  <div className="scr-start-head">
                    <div>
                      <div className="brand">NWD</div>
                      <div className="league">LIGA GRAVITY</div>
                    </div>
                    <div className="rankpill">
                      <span className="ico">▲</span>
                      <span className="nm">HUNTER</span>
                      <span className="bar"><i style={{ width: '62%' }} /></span>
                    </div>
                  </div>

                  <div className="scr-venue-rail">
                    <div className="vchip active">
                      SŁOTWINY<div className="under" />
                    </div>
                    <div className="vchip">KASINA</div>
                  </div>

                  <div className="scr-venue-card">
                    <div className="tag">OŚRODEK · SEZON 01</div>
                    <div className="name">SŁOTWINY ARENA</div>
                    <div className="region">Krynica-Zdrój</div>
                    <div className="stats">
                      <div className="s">
                        <div className="v">4</div>
                        <div className="l">TRAS</div>
                      </div>
                      <div className="div" />
                      <div className="s">
                        <div className="v on">23</div>
                        <div className="l">ZJAZDÓW</div>
                      </div>
                      <div className="div" />
                      <div className="s">
                        <div className="v on">8</div>
                        <div className="l">RIDERÓW</div>
                      </div>
                    </div>
                    <div className="cta">WEJDŹ DO OŚRODKA</div>
                  </div>

                  <div className="scr-section-label">TWÓJ STATUS</div>
                  <div className="scr-rider-mini">
                    <div className="cell"><div className="v">23</div><div className="l">ZJAZDÓW</div></div>
                    <div className="cell"><div className="v">4</div><div className="l">REKORDÓW</div></div>
                    <div className="cell"><div className="v on">#7</div><div className="l">POZYCJA</div></div>
                  </div>

                  <div className="scr-trail-row">
                    <div className="dot blue" />
                    <div className="info">
                      <div className="nm">Gałgan</div>
                      <div className="meta">EASY · 2400m · ↓180m</div>
                    </div>
                    <div className="right">
                      <div className="pb">02:14.86</div>
                      <div className="pos">#7</div>
                    </div>
                  </div>

                  <div className="scr-tabbar">
                    <div className="tab active">START</div>
                    <div className="tab">ZJAZDY</div>
                    <div className="tab">TABLICA</div>
                    <div className="tab">RIDER</div>
                  </div>
                </div>
              </div>
              <div className="lp-scr-cap">
                <span><span className="num">02</span> START</span>
                <span>SŁOTWINY · S01</span>
              </div>
            </div>

            {/* ═══ PHONE 03 // TABLICA ═══ */}
            <div className="lp-scr-wrap">
              <div className="phone3">
                <div className="phone3-screen scr-board">
                  <div className="scr-status">
                    <span>9:41</span>
                    <span className="ind">●●●●●</span>
                  </div>
                  <div className="scr-board-head">
                    <div className="title">TABLICA WYNIKÓW<span className="dot" /></div>
                    <div className="sub">TYLKO ZWERYFIKOWANE ZJAZDY</div>
                  </div>

                  <div className="scr-board-tabs">
                    <div className="vt active">SŁOTWINY</div>
                    <div className="vt">KASINA</div>
                  </div>
                  <div className="scr-board-scope">
                    <div className="st">DZIŚ</div>
                    <div className="st">WEEKEND</div>
                    <div className="st active">SEZON</div>
                  </div>

                  <div className="scr-board-trails">
                    <div className="tchip active">
                      <span className="dot blue" />Gałgan
                    </div>
                    <div className="tchip">
                      <span className="dot green" />D. Świata
                    </div>
                    <div className="tchip">
                      <span className="dot blue" />Kometa
                    </div>
                  </div>

                  {/* Podium */}
                  <div className="scr-podium">
                    <div className="prow gold">
                      <div className="pos">1</div>
                      <div className="who">
                        <div className="nm">m.dropek</div>
                        <div className="rk">★ SLAYER</div>
                      </div>
                      <div className="t">02:08.12</div>
                    </div>
                    <div className="prow silver">
                      <div className="pos">2</div>
                      <div className="who">
                        <div className="nm">apex.pl</div>
                        <div className="rk">★ SLAYER</div>
                      </div>
                      <div className="t">02:09.55</div>
                    </div>
                    <div className="prow bronze">
                      <div className="pos">3</div>
                      <div className="who">
                        <div className="nm">slayer22</div>
                        <div className="rk">▲ HUNTER</div>
                      </div>
                      <div className="t">02:11.40</div>
                    </div>
                  </div>

                  <div className="scr-sep">
                    <span /><em>RANKING</em><span />
                  </div>

                  {/* Rider status */}
                  <div className="scr-rider-status">
                    <div className="left">
                      <div className="pos">#7</div>
                      <div className="tier">TOP 10</div>
                    </div>
                    <div className="right">
                      <div className="gap">0.7s do podium</div>
                      <div className="rival">CEL: #6 w.bronk</div>
                    </div>
                  </div>

                  <div className="scr-board-rows">
                    <div className="brow">
                      <div className="pos">4</div>
                      <div className="nm">l.kosa</div>
                      <div className="up">↑2</div>
                      <div className="t">02:12.98</div>
                    </div>
                    <div className="brow">
                      <div className="pos">5</div>
                      <div className="nm">jed.zen</div>
                      <div className="flat">—</div>
                      <div className="t">02:13.20</div>
                    </div>
                    <div className="brow you">
                      <div className="pos">7</div>
                      <div className="nm">k.rajder <em>TY</em></div>
                      <div className="up">↑3</div>
                      <div className="t">02:14.86</div>
                    </div>
                  </div>

                  <div className="scr-tabbar">
                    <div className="tab">START</div>
                    <div className="tab">ZJAZDY</div>
                    <div className="tab active">TABLICA</div>
                    <div className="tab">RIDER</div>
                  </div>
                </div>
              </div>
              <div className="lp-scr-cap">
                <span><span className="num">03</span> TABLICA</span>
                <span>SEZON 01</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          4 // FINAL CTA + Słotwiny stage card inline
         ════════════════════════════════════════════════ */}
      <section className="lp-block tight" id="cta">
        <div className="lp-block-label">
          <span><span className="num">§04</span> // BRAMKA OTWARTA</span>
        </div>
        <div className="lp-wide">
          <div className="lp-final3">
            <div className="lp-final3-grid">
              <div>
                <div className="lp-final3-stamp">
                  <span className="pulse" />
                  SEZON 01 ▸ iOS ▸ WKRÓTCE W APP STORE
                </div>
                <h2 className="h">
                  BRAMKA<br />
                  <span className="red">OTWARTA</span>.
                </h2>
                <p>
                  Aplikacja iOS jest w drodze do App Store. Liga rusza wraz
                  z premierą — pierwsze czasy w Słotwinach idą na tablicę
                  od dnia zero.
                </p>
                <div className="lp-cta-row2">
                  <Link className="lp-btn2 red" href="/support">
                    Bądź na liście <span className="arr">→</span>
                  </Link>
                  <Link className="lp-btn2" href="/support">Kontakt</Link>
                </div>
              </div>

              {/* Inline Słotwiny stage card */}
              <aside className="lp-stage-card" aria-label="Stage 01 — Słotwiny Arena">
                <div className="head">
                  <Image
                    src={APP_ICON}
                    alt=""
                    width={14}
                    height={14}
                    className="lp-stage-card-icon"
                  />
                  STAGE 01 / LAUNCH WORLD
                </div>
                <h3>Słotwiny Arena</h3>
                <div className="meta">
                  <span>KRYNICA-ZDRÓJ</span>
                  <span>4 TRASY</span>
                  <span>GPS · LIVE</span>
                </div>
                <div className="trails">
                  <div className="trail">
                    <span className="nm">Gałgan</span>
                    <span className="df easy">EASY</span>
                  </div>
                  <div className="trail">
                    <span className="nm">D. Świata</span>
                    <span className="df med">MED</span>
                  </div>
                  <div className="trail">
                    <span className="nm">Kometa</span>
                    <span className="df hard">HARD</span>
                  </div>
                  <div className="trail">
                    <span className="nm">Dzida</span>
                    <span className="df pro">PRO</span>
                  </div>
                </div>
                <div className="note">SEZON 01 · 2026</div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          COMPLIANCE — kept accessible, narrower rail
         ════════════════════════════════════════════════ */}
      <div className="compliance-shell">
        <span className="eyebrow">Dokumenty</span>
        <h2 style={{ borderTop: 'none', paddingTop: 0, marginTop: 8 }}>
          Compliance &amp; wsparcie
        </h2>
        <div className="section-grid">
          <Link href="/privacy" className="tile">
            <h3>Polityka prywatności</h3>
            <p>Jakie dane zbieramy i dlaczego.</p>
          </Link>
          <Link href="/terms" className="tile">
            <h3>Regulamin</h3>
            <p>Zasady gry, ligi i odpowiedzialności.</p>
          </Link>
          <Link href="/support" className="tile">
            <h3>Wsparcie</h3>
            <p>Kontakt, FAQ, zgłaszanie problemów.</p>
          </Link>
          <Link href="/delete-account" className="tile">
            <h3>Usunięcie konta</h3>
            <p>Jak trwale usunąć profil i dane.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
