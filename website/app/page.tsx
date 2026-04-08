import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <span className="hero-tag">SEZON 01 · LIGA GRAVITY</span>
        <h1 className="hero">
          NEW WORLD<br />DISORDER
        </h1>
        <p className="lead">
          Liga gravity dla riderów. Oficjalne ośrodki, weryfikowane zjazdy GPS,
          sezonowe rankingi i osobiste rekordy. Jedna apka — od bramki startowej
          po tablicę wyników.
        </p>
        <div className="hero-cta-row">
          <a className="btn primary" href="#launch">Sezon 01</a>
          <Link className="btn" href="/support">Kontakt</Link>
        </div>
      </section>

      <section className="section" id="launch">
        <span className="eyebrow">Ośrodek startowy</span>
        <h2 style={{ borderTop: 'none', paddingTop: 0, marginTop: 8 }}>
          Słotwiny Arena
        </h2>
        <p>
          Sezon 01 startuje w Słotwiny Arena (Krynica-Zdrój). Cztery oficjalne
          trasy gravity: <strong>Gałgan</strong>, <strong>Dookoła Świata</strong>,{' '}
          <strong>Kometa</strong>, <strong>Dzida</strong>. Każdy zjazd, który
          przejdzie weryfikację GPS, trafia na sezonową tablicę.
        </p>
        <p>
          Kolejne ośrodki dołączą w następnych sezonach. Lista trwa.
        </p>
      </section>

      <section className="section">
        <span className="eyebrow">App Store</span>
        <h2 style={{ borderTop: 'none', paddingTop: 0, marginTop: 8 }}>
          Pobierz aplikację
        </h2>
        <p>
          Aplikacja iOS jest w przygotowaniu do publikacji w App Store. Link
          zostanie opublikowany tutaj po zatwierdzeniu przez Apple.
        </p>
        <div className="callout">
          <p style={{ fontSize: 13, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            App Store badge — placeholder
          </p>
        </div>
      </section>

      <section className="section">
        <span className="eyebrow">Compliance</span>
        <h2 style={{ borderTop: 'none', paddingTop: 0, marginTop: 8 }}>
          Dokumenty i wsparcie
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
      </section>
    </main>
  );
}
