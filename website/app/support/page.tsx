import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Wsparcie — New World Disorder',
  description: 'Skontaktuj się z zespołem NWD. Pomoc, zgłoszenia, problemy.',
};

export default function SupportPage() {
  return (
    <main>
      <span className="eyebrow">Pomoc</span>
      <h1>Wsparcie</h1>
      <p className="meta">Czas odpowiedzi: do 3 dni roboczych</p>

      <p className="lead">
        Masz problem ze zjazdem, weryfikacją GPS, kontem albo rankingiem?
        Napisz do nas. Każde zgłoszenie jest realnie czytane.
      </p>

      <div className="callout">
        <p>
          <strong>Główny kanał kontaktu:</strong>
          <br />
          <a href="mailto:support@nwdisorder.com">support@nwdisorder.com</a>
        </p>
      </div>

      <h2>Z czym możemy pomóc</h2>
      <ul>
        <li>
          <strong>Zjazd nie został zweryfikowany</strong> — sprawdzimy logi
          GPS i checkpointów dla danego zjazdu. Podaj datę, trasę i (jeśli
          masz) ID zjazdu z ekranu wyniku.
        </li>
        <li>
          <strong>Niewłaściwy ranking lub PB</strong> — zgłoś czas, który Twoim
          zdaniem powinien się liczyć, oraz datę zjazdu.
        </li>
        <li>
          <strong>Problemy z logowaniem</strong> — kod OTP nie dochodzi, błąd
          podczas weryfikacji, zablokowane konto. Podaj adres e-mail powiązany
          z kontem.
        </li>
        <li>
          <strong>Problemy z aplikacją</strong> — crashe, błędy, dziwne
          zachowanie. Podaj model urządzenia, wersję iOS i wersję aplikacji
          (Profil → na dole ekranu).
        </li>
        <li>
          <strong>Zgłoszenie naruszenia</strong> — obraźliwa nazwa rider tag,
          podejrzenie oszustwa, podejrzane wyniki. Opisz konkretnie kogo i
          dlaczego zgłaszasz.
        </li>
        <li>
          <strong>Pytania o prywatność</strong> —{' '}
          <a href="mailto:privacy@nwdisorder.com">privacy@nwdisorder.com</a>
        </li>
      </ul>

      <h2>Usunięcie konta</h2>
      <p>
        Konto najszybciej usuniesz bezpośrednio z poziomu aplikacji:{' '}
        <strong>Profil → Usuń konto</strong>. Operacja jest natychmiastowa i
        nieodwracalna.
      </p>
      <p>
        Jeżeli z jakiegokolwiek powodu nie możesz tego zrobić w aplikacji,
        napisz na <a href="mailto:support@nwdisorder.com">support@nwdisorder.com</a>{' '}
        z adresu e-mail powiązanego z kontem, a usuniemy je ręcznie w ciągu 30
        dni. Szczegóły: <Link href="/delete-account">/delete-account</Link>.
      </p>

      <h2>Co warto dołączyć do zgłoszenia</h2>
      <ul>
        <li>Adres e-mail powiązany z kontem.</li>
        <li>Wersja aplikacji (Profil → stopka ekranu).</li>
        <li>Model urządzenia i wersja iOS.</li>
        <li>Krótki opis problemu i kroki, które do niego prowadzą.</li>
        <li>Zrzut ekranu, jeśli to możliwe.</li>
      </ul>

      <h2>Czego nie obsługujemy mailowo</h2>
      <ul>
        <li>Próśb o ustawienie hasła lub zmianę nazwy konta — to robisz sam w aplikacji.</li>
        <li>Reklamacji wyników bez weryfikowalnego zjazdu w systemie.</li>
        <li>Anonimowych zgłoszeń bez adresu e-mail powiązanego z kontem.</li>
      </ul>

      <h2>Test buildy / TestFlight</h2>
      <p>
        Jeżeli korzystasz z buildu testowego (TestFlight) i chcesz zgłosić błąd,
        wpisz w temacie wiadomości <strong>[BUILD]</strong> i podaj numer
        buildu z TestFlight.
      </p>

      <h2>Inne kanały</h2>
      <p>
        Aktualnie wsparcie prowadzimy wyłącznie mailowo. Kanały społecznościowe
        zostaną uruchomione w późniejszym etapie i ogłoszone na stronie głównej.
      </p>
    </main>
  );
}
