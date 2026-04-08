import Link from 'next/link';
import Image from 'next/image';

// Real product asset — the actual NWD iOS app icon
const APP_ICON = '/brand/icon.png';

export default function HomePage() {
  return (
    <main className="landing">
      {/* ════════════════════════════════════════════════
          DESCENT RAIL — fixed left edge, desktop only
          Four phases of a run. The fill grows as the
          visitor scrolls the page using scroll-linked CSS
          animation-timeline. Static 4-dot fallback on
          browsers without scroll timelines.
         ════════════════════════════════════════════════ */}
      <aside className="lp-descent-rail" aria-hidden="true">
        <div className="rail-track">
          <div className="rail-fill" />
          <div className="rail-stops">
            <div className="stop">
              <span className="dot" />
              <span className="lbl">BRAMKA</span>
            </div>
            <div className="stop">
              <span className="dot" />
              <span className="lbl">ROZPĘD</span>
            </div>
            <div className="stop">
              <span className="dot" />
              <span className="lbl">META</span>
            </div>
            <div className="stop">
              <span className="dot" />
              <span className="lbl">LOOP</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════
          1 // HERO
         ════════════════════════════════════════════════ */}
      <section className="lp-hero2">
        <div className="lp-wide">
          {/* Telemetry strip — reduced to 3 cells */}
          <div className="lp-telestrip" aria-hidden="true">
            <div>
              <span className="k">SEZON</span>
              <span className="v">01 / 2026</span>
            </div>
            <div>
              <span className="k">STAGE</span>
              <span className="v">01 — SŁOTWINY ARENA</span>
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
                  width={64}
                  height={64}
                  priority
                  className="lp-hero-icon"
                />
                <div className="lp-hero-icon-meta">
                  <span className="t1">LIGA GRAVITY · iOS · SEZON 01</span>
                </div>
              </div>

              <h1 className="lp-stage-h1">
                <span className="line">WJEDŹ.</span>
                <span className="line">ZJEDŹ.</span>
                <span className="line">WRÓĆ <span className="red">NA GÓRĘ<span className="dot" /></span></span>
              </h1>

              <p className="lp-stage-sub">
                Arcade racing na prawdziwej górze. Twój czas staje obok
                innych. <strong>Twój rywal już wie, że pojedzie w weekend.</strong>
              </p>

              <div className="lp-cta-row3">
                <a className="lp-btn-mega" href="#cta">
                  <span className="label">
                    <span className="big">Dołącz do ligi</span>
                    <span className="small">Zapisz się zanim zapiszą cię inni · Sezon 01</span>
                  </span>
                  <span className="arr">→</span>
                </a>
                <a className="lp-btn-ghost" href="#loop">
                  <span className="num">§01</span>
                  Jak to działa
                </a>
              </div>
            </div>

            {/* HUD result tower */}
            <div style={{ position: 'relative' }}>
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
            Twój czas to Twoja pozycja. Twoja pozycja to Twój rywal.
            Twój rywal czeka na weekend.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          3 // EKRANY — screen showcase (centerpiece)
         ════════════════════════════════════════════════ */}
      <section className="lp-block showcase">
        <div className="lp-block-label">
          <span><span className="num">§03</span> // EKRANY</span>
        </div>
        <div className="lp-wide">
          <h2 className="lp-h2-2 lp-h2-show">
            TRZY EKRANY.<br />
            <span className="red">JEDNO PYTANIE.</span>
          </h2>
          <p className="lp-h2-show-sub">
            Start. Wynik. Tablica. Cała liga mieści się w trzech ekranach
            — i w jednym pytaniu, które zadaje Ci meta.
          </p>

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
                <span className="ix">01 / 03</span>
                <span className="ttl">RIDER</span>
                <span className="tag">HUNTER · LVL 12</span>
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
                <span className="ix">02 / 03</span>
                <span className="ttl">START</span>
                <span className="tag">SŁOTWINY · S01</span>
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
                <span className="ix">03 / 03</span>
                <span className="ttl">TABLICA</span>
                <span className="tag">SEZON 01</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          4 // FINAL CTA — finale block
         ════════════════════════════════════════════════ */}
      <section className="lp-block finale" id="cta">
        <div className="lp-block-label">
          <span><span className="num">§04</span> // META</span>
        </div>
        <div className="lp-wide">
          <div className="lp-finale">
            <div className="lp-finale-stamp">
              <span className="pulse" />
              SEZON 01 ▸ iOS ▸ WKRÓTCE W APP STORE
            </div>
            <h2 className="lp-finale-h">
              BRAMKA<br />
              <span className="red">OTWARTA</span>.
            </h2>
            <p className="lp-finale-sub">
              Sezon 01 pisze się raz. Pierwsi riderzy wpisują się
              do historii ligi. Weekend w Słotwinach decyduje
              o pierwszym podium całego sezonu.
            </p>

            <Link className="lp-btn-finale" href="/support">
              <span className="left">
                <span className="line1">DOŁĄCZ DO LIGI</span>
                <span className="line2">Podium otwarte · Wejdź zanim zajmą</span>
              </span>
              <span className="arr">→</span>
            </Link>

            {/* Stage dossier — launch manifest */}
            <div className="lp-finale-dossier" aria-label="Stage 01 — Słotwiny Arena">
              <div className="dossier-head">
                <div className="left">
                  <div className="tag gold">
                    <Image src={APP_ICON} alt="" width={16} height={16} className="ico" />
                    STAGE 01 · LAUNCH WORLD
                  </div>
                  <div className="name">Słotwiny Arena</div>
                  <div className="region">Krynica-Zdrój · Polska</div>
                </div>
                <div className="right">
                  <div className="kv"><span className="k">SEZON</span><span className="v">01 / 2026</span></div>
                  <div className="kv"><span className="k">TRASY</span><span className="v">4 OFICJALNE</span></div>
                  <div className="kv"><span className="k">WERYFIKACJA</span><span className="v">GPS · LIVE</span></div>
                </div>
              </div>
              <div className="dossier-trails">
                <div className="trail">
                  <div className="ix">01</div>
                  <div className="nm">Gałgan</div>
                  <div className="meta">FLOW · 2.4 km · ↓180 m</div>
                  <div className="df easy">EASY</div>
                  <div className="podium">
                    <span className="plabel">PODIUM</span>
                    <span className="slots"><em>1</em> — · <em>2</em> — · <em>3</em> —</span>
                  </div>
                </div>
                <div className="trail">
                  <div className="ix">02</div>
                  <div className="nm">Dookoła Świata</div>
                  <div className="meta">FLOW · 3.1 km · ↓155 m</div>
                  <div className="df easy">EASY</div>
                  <div className="podium">
                    <span className="plabel">PODIUM</span>
                    <span className="slots"><em>1</em> — · <em>2</em> — · <em>3</em> —</span>
                  </div>
                </div>
                <div className="trail">
                  <div className="ix">03</div>
                  <div className="nm">Kometa</div>
                  <div className="meta">FLOW · 2.3 km · ↓184 m</div>
                  <div className="df med">MEDIUM</div>
                  <div className="podium">
                    <span className="plabel">PODIUM</span>
                    <span className="slots"><em>1</em> — · <em>2</em> — · <em>3</em> —</span>
                  </div>
                </div>
                <div className="trail">
                  <div className="ix">04</div>
                  <div className="nm">Dzida</div>
                  <div className="meta">TECH · 1.5 km · ↓165 m</div>
                  <div className="df hard">HARD</div>
                  <div className="podium">
                    <span className="plabel">PODIUM</span>
                    <span className="slots"><em>1</em> — · <em>2</em> — · <em>3</em> —</span>
                  </div>
                </div>
              </div>
              <div className="dossier-foot">
                <span className="dot" />
                WSZYSTKIE MIEJSCA NA PODIUM OTWARTE · SEZON 01 / 2026
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          END TRANSMISSION — quiet fade to compliance
         ════════════════════════════════════════════════ */}
      <div className="lp-end">
        <div className="lp-wide">
          <div className="lp-end-rule">
            <span className="bar" />
            <span className="label">§ END OF TRANSMISSION</span>
            <span className="bar" />
          </div>
          <nav className="lp-end-links" aria-label="Compliance">
            <Link href="/privacy">Prywatność</Link>
            <span className="sep" aria-hidden="true">·</span>
            <Link href="/terms">Regulamin</Link>
            <span className="sep" aria-hidden="true">·</span>
            <Link href="/support">Wsparcie</Link>
            <span className="sep" aria-hidden="true">·</span>
            <Link href="/delete-account">Usunięcie konta</Link>
          </nav>
          <div className="lp-end-colophon">
            NEW WORLD DISORDER · LIGA GRAVITY · SEZON 01 / 2026
          </div>
        </div>
      </div>
    </main>
  );
}
