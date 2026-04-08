import Link from 'next/link';
import Image from 'next/image';
import fs from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────
// Real-asset detection.
//
// At build time we check whether the marketing team has dropped
// real iPhone captures into website/public/screens/. If yes, the
// phone frames in §03 EKRANY render those screenshots and the
// CSS-built mocks are skipped. If no, the CSS mocks render.
//
// See website/public/screens/README.md for the drop spec.
// ─────────────────────────────────────────────────────────────
const SCREENS_DIR = path.join(process.cwd(), 'public', 'screens');
const has = (name: string) =>
  fs.existsSync(path.join(SCREENS_DIR, name));

const realScreens = {
  result: has('result.png'),
  profile: has('profile.png'),
  leaderboard: has('leaderboard.png'),
};

// Real product asset — the actual app icon, copied from
// assets/icon.png into public/brand/icon.png
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
              <div className="lp-stage-label">
                <span className="bar" />
                <Image
                  src={APP_ICON}
                  alt="NWD"
                  width={18}
                  height={18}
                  priority
                  className="lp-brand-icon"
                />
                <span>NEW WORLD DISORDER ▸ LIGA GRAVITY</span>
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

          <div className="lp-screens2">
            {/* Result */}
            <div className="lp-screen-wrap">
              <div className="phone2">
                {realScreens.result ? (
                  <div className="phone2-screen real">
                    <Image
                      src="/screens/result.png"
                      alt="NWD — ekran wyniku zjazdu"
                      fill
                      sizes="(max-width: 980px) 320px, 380px"
                      className="phone2-img"
                      priority
                    />
                  </div>
                ) : (
                  <div className="phone2-screen ph2-r">
                    <div className="small">META · STAGE 01</div>
                    <div className="trail">GAŁGAN</div>
                    <div className="verified">✓ ZWERYFIKOWANY · RANKING</div>
                    <div className="time">02:14<span className="ms">.86</span></div>
                    <div className="pb">PB · −1.4s</div>
                    <div className="grid">
                      <div className="cell">
                        <span className="l">POZYCJA</span>
                        <span className="v up">#7</span>
                      </div>
                      <div className="cell">
                        <span className="l">SEZON Δ</span>
                        <span className="v up">↑3</span>
                      </div>
                      <div className="cell">
                        <span className="l">XP</span>
                        <span className="v">+185</span>
                      </div>
                      <div className="cell">
                        <span className="l">RANGA</span>
                        <span className="v">HUNTER</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="lp-screen-cap">
                <span><span className="num">01</span> // RESULT</span>
                <span>STAGE 01</span>
              </div>
            </div>

            {/* Profile */}
            <div className="lp-screen-wrap center">
              <div className="phone2">
                {realScreens.profile ? (
                  <div className="phone2-screen real">
                    <Image
                      src="/screens/profile.png"
                      alt="NWD — profil ridera"
                      fill
                      sizes="(max-width: 980px) 320px, 380px"
                      className="phone2-img"
                    />
                  </div>
                ) : (
                  <div className="phone2-screen ph2-p">
                    <div className="small">RIDER</div>
                    <div className="avatar">▲</div>
                    <div className="name">k.rajder</div>
                    <div className="rank">★ HUNTER · LVL 12</div>
                    <div className="bar"><i /></div>
                    <div className="xp">LVL 12 · 1240 / 2000 XP</div>
                    <div className="grid">
                      <div className="c">
                        <span className="v">23</span>
                        <span className="l">ZJAZDÓW</span>
                      </div>
                      <div className="c">
                        <span className="v">4</span>
                        <span className="l">PB</span>
                      </div>
                      <div className="c">
                        <span className="v">#7</span>
                        <span className="l">BEST</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="lp-screen-cap">
                <span><span className="num">02</span> // RIDER</span>
                <span>HUNTER</span>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="lp-screen-wrap">
              <div className="phone2">
                {realScreens.leaderboard ? (
                  <div className="phone2-screen real">
                    <Image
                      src="/screens/leaderboard.png"
                      alt="NWD — tablica wyników"
                      fill
                      sizes="(max-width: 980px) 320px, 380px"
                      className="phone2-img"
                    />
                  </div>
                ) : (
                  <div className="phone2-screen ph2-b">
                    <div className="small">TABLICA · GAŁGAN</div>
                    <div className="title">SEZON 01</div>
                    <div className="row gold">
                      <div className="pos">1</div>
                      <div className="who">m.dropek</div>
                      <div className="t">02:08.12</div>
                    </div>
                    <div className="row silver">
                      <div className="pos">2</div>
                      <div className="who">apex.pl</div>
                      <div className="t">02:09.55</div>
                    </div>
                    <div className="row bronze">
                      <div className="pos">3</div>
                      <div className="who">slayer22</div>
                      <div className="t">02:11.40</div>
                    </div>
                    <div className="row">
                      <div className="pos">4</div>
                      <div className="who">l.kosa</div>
                      <div className="t">02:12.98</div>
                    </div>
                    <div className="row">
                      <div className="pos">5</div>
                      <div className="who">jed.zen</div>
                      <div className="t">02:13.20</div>
                    </div>
                    <div className="row">
                      <div className="pos">6</div>
                      <div className="who">w.bronk</div>
                      <div className="t">02:14.10</div>
                    </div>
                    <div className="row you">
                      <div className="pos">7</div>
                      <div className="who">k.rajder · TY</div>
                      <div className="t">02:14.86</div>
                    </div>
                    <div className="row">
                      <div className="pos">8</div>
                      <div className="who">tomek.dh</div>
                      <div className="t">02:15.40</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="lp-screen-cap">
                <span><span className="num">03</span> // TABLICA</span>
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
