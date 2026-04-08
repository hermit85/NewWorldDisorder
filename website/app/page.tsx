import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing">
      {/* ════════════════════════════════════════════════
          HERO — STAGE-START TIMING TOWER
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

          {/* Headline + HUD grid */}
          <div className="lp-hero2-grid">
            <div>
              <div className="lp-stage-label">
                <span className="bar" />
                <span><span className="num">▸</span> NEW WORLD DISORDER ▸ LIGA GRAVITY</span>
              </div>

              <h1 className="lp-stage-h1">
                <span className="line">WJEDŹ.</span>
                <span className="line">ZALICZ.</span>
                <span className="line">WRÓĆ <span className="red">NA GÓRĘ<span className="dot" /></span></span>
              </h1>

              <p className="lp-stage-sub">
                NWD to gra arcade gravity rozgrywana na prawdziwych ośrodkach.
                Bramka, trasa, meta, tablica. <strong>Czas albo PB.</strong>{' '}
                <strong>Pozycja albo żadna.</strong> Bez wykresów, bez treningu,
                bez wymówek. Tylko jedno pytanie po mecie: jeszcze raz?
              </p>

              <div className="lp-cta-row2">
                <a className="lp-btn2 red" href="#launch">
                  Stage 01 ▸ Słotwiny <span className="arr">→</span>
                </a>
                <a className="lp-btn2" href="#loop">Pętla</a>
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
          MARQUEE — TELEMETRY TICKER
         ════════════════════════════════════════════════ */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          <span>STAGE 01 // SŁOTWINY ARENA</span><span className="star">▸</span>
          <span className="ghost">GAŁGAN — 02:14.86</span><span className="star">◆</span>
          <span>DOOKOŁA ŚWIATA — 03:08.42</span><span className="star">▸</span>
          <span className="ghost">KOMETA — 02:46.15</span><span className="star">◆</span>
          <span>DZIDA — 01:58.07</span><span className="star">▸</span>
          <span className="ghost">PB +0 // RANKING +3 // RANGA HUNTER</span><span className="star">◆</span>
          <span>JESZCZE JEDEN ZJAZD</span><span className="star">▸</span>
          <span className="ghost">JESZCZE JEDEN ZJAZD</span><span className="star">◆</span>
          {/* Duplicate for seamless loop */}
          <span>STAGE 01 // SŁOTWINY ARENA</span><span className="star">▸</span>
          <span className="ghost">GAŁGAN — 02:14.86</span><span className="star">◆</span>
          <span>DOOKOŁA ŚWIATA — 03:08.42</span><span className="star">▸</span>
          <span className="ghost">KOMETA — 02:46.15</span><span className="star">◆</span>
          <span>DZIDA — 01:58.07</span><span className="star">▸</span>
          <span className="ghost">PB +0 // RANKING +3 // RANGA HUNTER</span><span className="star">◆</span>
          <span>JESZCZE JEDEN ZJAZD</span><span className="star">▸</span>
          <span className="ghost">JESZCZE JEDEN ZJAZD</span><span className="star">◆</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          §02 — PĘTLA / THE LOOP
         ════════════════════════════════════════════════ */}
      <section className="lp-block" id="loop">
        <div className="lp-block-label">
          <span><span className="num">§02</span> // PĘTLA</span>
        </div>
        <div className="lp-wide">
          <h2 className="lp-h2-2">
            JEDEN ZJAZD.<br />
            JEDNA POZYCJA.<br />
            <span className="red">JEDEN POWÓD,</span><br />
            ŻEBY WRÓCIĆ.
          </h2>
          <p className="lp-body2">
            Bramka. Trasa. Meta. Tablica. Wynik znasz w minutę po finiszu —
            pozycja, delta, rywal nad Tobą. Wyciąg działa do 17:00, masz jeszcze
            cztery przejazdy. To nie jest dzienniczek. To <strong>pętla</strong>,
            z której nie chcesz wyjść.
          </p>

          <div className="lp-loop">
            <div className="lp-phase">
              <div className="num">01</div>
              <div className="title">BRAMKA</div>
              <div className="desc">
                Apka wykrywa, że stoisz przy starcie. Pokazuje gotowość GPS,
                checkpointy, dystans. Jeden tap — uzbrojenie.
              </div>
              <div className="meta">PRZED ZJAZDEM</div>
            </div>
            <div className="lp-phase">
              <div className="num">02</div>
              <div className="title">ZJAZD</div>
              <div className="desc">
                Schowaj telefon. Timer startuje na bramce. Meta kończy
                automatycznie. Apka pilnuje linii i checkpointów po GPS.
              </div>
              <div className="meta">W RUCHU</div>
            </div>
            <div className="lp-phase">
              <div className="num">03</div>
              <div className="title">WYNIK</div>
              <div className="desc">
                ✓ ZALICZONY albo NIE. Czas, weryfikacja, PB delta, pozycja
                w sezonowej tabeli, ranga, postęp. Wszystko w 60 sekund.
              </div>
              <div className="meta">META</div>
            </div>
            <div className="lp-phase">
              <div className="num">04</div>
              <div className="title">JESZCZE RAZ</div>
              <div className="desc">
                Wiesz, że Cię obudziło. Wiesz, kto goni. Wiesz, ile sekund
                zostało do podium. Wracasz na wyciąg. Bramka znów otwarta.
              </div>
              <div className="meta">LOOP</div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          §03 — TRACKER vs LIGA
         ════════════════════════════════════════════════ */}
      <section className="lp-block">
        <div className="lp-block-label">
          <span><span className="num">§03</span> // GRA. NIE TRENING.</span>
        </div>
        <div className="lp-wide">
          <h2 className="lp-h2-2">
            TO NIE JEST<br />
            <span className="strike">APKA TRENINGOWA</span>.<br />
            TO <span className="red">LIGA</span>.
          </h2>
          <p className="lp-body2">
            Apki treningowe mierzą każde tętno na nudnej rolce. NWD jest
            po drugiej stronie tej samej góry — tam, gdzie się rywalizuje,
            a nie tam, gdzie się ćwiczy.
          </p>

          <div className="lp-vs">
            <div className="col bad">
              <span className="stamp">// TRACKER</span>
              <h3>APKA TRENINGOWA</h3>
              <ul>
                <li>Mierzy każdy ruch dnia</li>
                <li>Wykresy tętna, mocy, kalorii</li>
                <li>„Plany treningowe" i „strefy"</li>
                <li>Trasa = surowy log GPS</li>
                <li>Twój rywal to wczorajszy Ty</li>
                <li>Nikt nie pilnuje, czy zjechałeś po linii</li>
              </ul>
            </div>
            <div className="col good">
              <span className="stamp">// LIGA NWD</span>
              <h3>
                GRA <span className="red">GRAVITY</span>
              </h3>
              <ul>
                <li>Tylko zjazdy. Żadnego dziennika dnia</li>
                <li>Czas. Pozycja. Delta. Ranga. Koniec listy</li>
                <li>Sezon. Weekend. Podium</li>
                <li>Trasa = oficjalna linia z bramki do mety</li>
                <li>Twój rywal to lokal nad Tobą w tabeli</li>
                <li>GPS pilnuje. Bez skrótów. Bez ściemy</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          §04 — SŁOTWINY LAUNCH WORLD
         ════════════════════════════════════════════════ */}
      <section className="lp-block" id="launch">
        <div className="lp-block-label">
          <span><span className="num">§04</span> // LAUNCH WORLD</span>
        </div>
        <div className="lp-wide">
          <div className="lp-launch">
            <div className="lp-launch-head">
              <span className="lp-launch-eyebrow">
                ▸ STAGE 01 ▸ KRYNICA-ZDRÓJ ▸ POLSKA
              </span>
              <h2 className="lp-launch-h">
                SŁOTWINY <span className="red">ARENA</span>.
                <span className="small">
                  4 OFICJALNE TRASY · 1 WYCIĄG · 1 SEZONOWA TABLICA ·{' '}
                  <span className="v">PIERWSZE CZASY OD DNIA ZERO</span>
                </span>
              </h2>
            </div>

            <div className="lp-launch-grid">
              <div className="lp-stage-list">
                <div className="lp-stage-row">
                  <div className="num">01</div>
                  <div>
                    <div className="name">Gałgan</div>
                    <div className="meta">
                      FLOW <span className="sep">·</span> 1.2 KM <span className="sep">·</span> ↓ 220 M
                    </div>
                  </div>
                  <div className="diff easy">EASY</div>
                </div>
                <div className="lp-stage-row">
                  <div className="num">02</div>
                  <div>
                    <div className="name">Dookoła Świata</div>
                    <div className="meta">
                      TRAIL <span className="sep">·</span> 1.6 KM <span className="sep">·</span> ↓ 240 M
                    </div>
                  </div>
                  <div className="diff med">MEDIUM</div>
                </div>
                <div className="lp-stage-row">
                  <div className="num">03</div>
                  <div>
                    <div className="name">Kometa</div>
                    <div className="meta">
                      TECH <span className="sep">·</span> 1.1 KM <span className="sep">·</span> ↓ 250 M
                    </div>
                  </div>
                  <div className="diff hard">HARD</div>
                </div>
                <div className="lp-stage-row">
                  <div className="num">04</div>
                  <div>
                    <div className="name">Dzida</div>
                    <div className="meta">
                      DH <span className="sep">·</span> 0.9 KM <span className="sep">·</span> ↓ 260 M
                    </div>
                  </div>
                  <div className="diff pro">PRO</div>
                </div>
              </div>

              <aside className="lp-launch-spec">
                <div className="row">
                  <span className="k">SEZON</span>
                  <span className="v">01 / 2026</span>
                </div>
                <div className="row">
                  <span className="k">REGION</span>
                  <span className="v">KRYNICA-ZDRÓJ</span>
                </div>
                <div className="row">
                  <span className="k">TRASY</span>
                  <span className="v">4 OFICJALNE</span>
                </div>
                <div className="row">
                  <span className="k">WERYFIKACJA</span>
                  <span className="v">GPS · LIVE</span>
                </div>
                <div className="row">
                  <span className="k">TRYB</span>
                  <span className="v">LIGA + TRENING</span>
                </div>
                <p className="note">
                  Kolejne ośrodki dołączą w następnych sezonach.
                  Lista trwa, ale każdy nowy świat musi przejść
                  własną weryfikację tras zanim wjedzie do ligi.
                </p>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          §05 — SCREENS
         ════════════════════════════════════════════════ */}
      <section className="lp-block">
        <div className="lp-block-label">
          <span><span className="num">§05</span> // EKRANY</span>
        </div>
        <div className="lp-wide">
          <h2 className="lp-h2-2">
            TRZY EKRANY.<br />
            JEDNO PYTANIE: <span className="red">JESZCZE RAZ?</span>
          </h2>
          <p className="lp-body2">
            Wynik. Profil. Tablica. Cała gra mieści się w trzech ekranach,
            które otwierasz między zjazdami.
          </p>

          <div className="lp-screens2">
            {/* Result */}
            <div className="lp-screen-wrap">
              <div className="phone2">
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
              </div>
              <div className="lp-screen-cap">
                <span><span className="num">01</span> // RESULT</span>
                <span>STAGE 01</span>
              </div>
            </div>

            {/* Profile */}
            <div className="lp-screen-wrap center">
              <div className="phone2">
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
              </div>
              <div className="lp-screen-cap">
                <span><span className="num">02</span> // RIDER</span>
                <span>HUNTER</span>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="lp-screen-wrap">
              <div className="phone2">
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
          MARQUEE — between screens and final CTA
         ════════════════════════════════════════════════ */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          <span className="ghost">BRAMKA OTWARTA</span><span className="star">▸</span>
          <span>BRAMKA OTWARTA</span><span className="star">◆</span>
          <span className="ghost">SEZON 01 // SŁOTWINY ARENA</span><span className="star">▸</span>
          <span>iOS // APP STORE // DZIEŃ ZERO</span><span className="star">◆</span>
          <span className="ghost">PB ALBO NIC</span><span className="star">▸</span>
          <span>JESZCZE JEDEN ZJAZD</span><span className="star">◆</span>
          <span className="ghost">BRAMKA OTWARTA</span><span className="star">▸</span>
          <span>BRAMKA OTWARTA</span><span className="star">◆</span>
          <span className="ghost">SEZON 01 // SŁOTWINY ARENA</span><span className="star">▸</span>
          <span>iOS // APP STORE // DZIEŃ ZERO</span><span className="star">◆</span>
          <span className="ghost">PB ALBO NIC</span><span className="star">▸</span>
          <span>JESZCZE JEDEN ZJAZD</span><span className="star">◆</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          §06 — FINAL STAGE-START CTA
         ════════════════════════════════════════════════ */}
      <section className="lp-block">
        <div className="lp-block-label">
          <span><span className="num">§06</span> // BRAMKA OTWARTA</span>
        </div>
        <div className="lp-wide">
          <div className="lp-final2">
            <div className="stamp">
              <span className="pulse" />
              SEZON 01 ▸ iOS ▸ WKRÓTCE W APP STORE
            </div>
            <h2 className="h">
              BRAMKA<br />
              <span className="red">OTWARTA</span>.
            </h2>
            <p>
              Aplikacja iOS jest w drodze do App Store. Liga rusza wraz
              z premierą — pierwsze czasy w Słotwinach idą do tablicy
              od dnia zero. Bądź na liście, jak chcesz zająć podium
              zanim ktokolwiek zdąży się rozgrzać.
            </p>
            <div className="lp-cta-row2">
              <Link className="lp-btn2 red" href="/support">
                Bądź na liście <span className="arr">→</span>
              </Link>
              <Link className="lp-btn2" href="/support">Kontakt</Link>
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
