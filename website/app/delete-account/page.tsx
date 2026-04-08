import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Usunięcie konta — New World Disorder',
  description:
    'Jak trwale usunąć konto NWD i wszystkie powiązane dane.',
};

export default function DeleteAccountPage() {
  return (
    <main>
      <span className="eyebrow">Konto</span>
      <h1>Usuń konto</h1>
      <p className="meta">Operacja nieodwracalna</p>

      <p className="lead">
        Możesz w dowolnym momencie trwale usunąć swoje konto New World Disorder
        i wszystkie powiązane z nim dane. Najszybsza ścieżka prowadzi przez
        aplikację.
      </p>

      <div className="callout">
        <p>
          <strong>Z poziomu aplikacji:</strong>
          <br />
          Profil → przycisk <strong>USUŃ KONTO</strong> → potwierdzenie wpisaniem słowa „USUŃ".
        </p>
      </div>

      <h2>Co zostanie trwale usunięte</h2>
      <ul>
        <li>Twój profil i rider tag.</li>
        <li>Adres e-mail powiązany z kontem (logowanie OTP).</li>
        <li>Historia wszystkich zjazdów i nagrane ślady GPS.</li>
        <li>Rekordy osobiste (PB) i pozycje na tablicach wyników.</li>
        <li>XP, ranga, ukończone wyzwania i osiągnięcia.</li>
        <li>Zdjęcie profilowe.</li>
        <li>Dostęp do konta z każdego urządzenia.</li>
      </ul>

      <h2>Co dzieje się po usunięciu</h2>
      <ul>
        <li>
          Twoje dane są usuwane <strong>natychmiast</strong> z aktywnej bazy
          produkcyjnej.
        </li>
        <li>
          Pozostałości w technicznych kopiach zapasowych są kasowane w cyklu do{' '}
          <strong>30 dni</strong>.
        </li>
        <li>
          Po usunięciu konto nie jest możliwe do przywrócenia — jeśli będziesz
          chciał wrócić, zakładasz nowe konto od zera.
        </li>
        <li>
          Wyniki, które trafiły wcześniej na publiczne tablice, znikną razem z
          kontem.
        </li>
      </ul>

      <h2>Ścieżka awaryjna (mail)</h2>
      <p>
        Jeżeli z jakiegokolwiek powodu nie możesz wykonać operacji w aplikacji
        (np. utrata dostępu do urządzenia, błąd techniczny), wyślij wiadomość:
      </p>
      <ul>
        <li>
          <strong>Z adresu e-mail powiązanego z kontem</strong>
        </li>
        <li>
          Na adres:{' '}
          <a href="mailto:support@nwdisorder.com?subject=Usunięcie konta NWD">
            support@nwdisorder.com
          </a>
        </li>
        <li>
          W temacie: <code>Usunięcie konta NWD</code>
        </li>
        <li>
          W treści: jednoznaczna prośba o usunięcie konta i (opcjonalnie) swój
          rider tag.
        </li>
      </ul>
      <p>
        Konto zostanie usunięte ręcznie w ciągu maksymalnie <strong>30 dni</strong>{' '}
        od zweryfikowanego zgłoszenia. Otrzymasz potwierdzenie e-mailem.
      </p>

      <h2>Pytania powiązane</h2>
      <ul>
        <li>
          <Link href="/privacy">Polityka prywatności</Link> — pełen opis tego,
          jakie dane przechowujemy.
        </li>
        <li>
          <Link href="/support">Wsparcie</Link> — inne sprawy dotyczące konta.
        </li>
      </ul>
    </main>
  );
}
