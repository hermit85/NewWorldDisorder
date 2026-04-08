import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Polityka prywatności — New World Disorder',
  description: 'Jakie dane zbieramy w aplikacji NWD i jak je przetwarzamy.',
};

export default function PrivacyPage() {
  return (
    <main>
      <span className="eyebrow">Dokument prawny</span>
      <h1>Polityka prywatności</h1>
      <p className="meta">Wersja robocza · ostatnia aktualizacja: 2026-04-08</p>

      <div className="draft-banner">
        WERSJA ROBOCZA — dokument w finalizacji prawnej. Treść może ulec zmianie
        przed publiczną publikacją w App Store.
      </div>

      <p className="lead">
        New World Disorder („NWD", „my", „nas") to mobilna aplikacja ligi
        gravity. Niniejszy dokument opisuje, jakie dane osobowe zbieramy, w
        jakim celu i jakie prawa Ci przysługują.
      </p>

      <h2>1. Administrator danych</h2>
      <p>
        Administratorem Twoich danych osobowych w rozumieniu RODO jest podmiot
        prowadzący New World Disorder. Pełne dane rejestrowe administratora
        zostaną uzupełnione przed publikacją produkcyjną.
      </p>
      <p>
        Kontakt w sprawach prywatności:{' '}
        <a href="mailto:privacy@nwdisorder.com">privacy@nwdisorder.com</a>
      </p>

      <h2>2. Jakie dane zbieramy</h2>

      <h3>2.1 Dane konta</h3>
      <ul>
        <li>
          <strong>Adres e-mail</strong> — używany wyłącznie do logowania
          jednorazowym kodem (OTP). Nie wysyłamy newslettera bez Twojej zgody.
        </li>
        <li>
          <strong>Nazwa rider tag</strong> oraz opcjonalna nazwa wyświetlana —
          ustalana przez Ciebie podczas rejestracji.
        </li>
        <li>
          <strong>Identyfikator użytkownika</strong> — wewnętrzny UUID
          przypisywany do Twojego konta.
        </li>
      </ul>

      <h3>2.2 Zdjęcie profilowe (opcjonalne)</h3>
      <p>
        Jeżeli zdecydujesz się dodać zdjęcie profilowe, zostanie ono zapisane w
        zaszyfrowanym storage'u i powiązane wyłącznie z Twoim profilem
        publicznym w lidze. Możesz je w dowolnym momencie zmienić lub usunąć.
      </p>

      <h3>2.3 Dane lokalizacji (GPS)</h3>
      <p>
        NWD używa <strong>precyzyjnej lokalizacji GPS</strong> wyłącznie podczas
        aktywnego zjazdu — czyli od momentu, w którym świadomie rozpoczniesz
        nagrywanie zjazdu w aplikacji, do momentu jego zakończenia.
      </p>
      <ul>
        <li>
          GPS służy do nagrywania trasy zjazdu, weryfikacji checkpointów i
          ustalania Twojego oficjalnego czasu na trasie.
        </li>
        <li>
          NWD <strong>nie zbiera lokalizacji w tle</strong>. GPS nie działa,
          gdy aplikacja jest zamknięta lub gdy nie jesteś w trakcie zjazdu.
        </li>
        <li>
          Surowe ślady GPS są przechowywane wyłącznie dla zjazdów, które Ty
          świadomie zapisałeś. Można je usunąć razem z kontem.
        </li>
      </ul>

      <h3>2.4 Dane gry i rankingowe</h3>
      <ul>
        <li>Czas zjazdu, prędkość, dystans, przewyższenie.</li>
        <li>Status weryfikacji zjazdu (rankingowy / treningowy / odrzucony).</li>
        <li>Rekordy osobiste (PB), pozycje na tablicach wyników.</li>
        <li>XP, ranga, ukończone wyzwania i osiągnięcia.</li>
      </ul>
      <p>
        Te dane są częścią mechaniki ligi i — w zakresie, w jakim trafiają na
        tablice wyników — są <strong>publiczne</strong> dla innych użytkowników
        aplikacji.
      </p>

      <h3>2.5 Dane techniczne i diagnostyczne</h3>
      <ul>
        <li>Wersja systemu operacyjnego, model urządzenia, wersja aplikacji.</li>
        <li>Anonimizowane dane diagnostyczne pomagające naprawiać błędy.</li>
        <li>Logi GPS-fix związane z weryfikacją zjazdu.</li>
      </ul>
      <p>
        Nie używamy żadnych SDK reklamowych, śledzących między aplikacjami
        (cross-app tracking) ani identyfikatora reklamowego (IDFA). NWD nie
        uruchamia App Tracking Transparency, ponieważ nie śledzi użytkowników w
        rozumieniu wymagań Apple.
      </p>

      <h2>3. Cele i podstawy prawne</h2>
      <ul>
        <li>
          <strong>Realizacja umowy</strong> (art. 6 ust. 1 lit. b RODO) —
          prowadzenie konta, rankingu, nagrywanie i weryfikacja zjazdów.
        </li>
        <li>
          <strong>Uzasadniony interes</strong> (art. 6 ust. 1 lit. f RODO) —
          bezpieczeństwo systemu, integralność rankingu, zapobieganie nadużyciom.
        </li>
        <li>
          <strong>Zgoda</strong> (art. 6 ust. 1 lit. a RODO) — opcjonalne
          funkcje takie jak zdjęcie profilowe lub powiadomienia push.
        </li>
      </ul>

      <h2>4. Komu udostępniamy dane</h2>
      <p>
        NWD nie sprzedaje danych osobowych. Korzystamy z następujących
        procesorów infrastrukturalnych:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (lub równoważny operator backendu) —
          hosting bazy danych, autoryzacja, storage zdjęć profilowych. Dane są
          przetwarzane w regionie UE.
        </li>
        <li>
          <strong>Apple App Store / TestFlight</strong> — dystrybucja aplikacji
          oraz raportowanie błędów (zgodnie z polityką Apple).
        </li>
      </ul>
      <p>
        Pełna lista podprocesorów wraz z lokalizacjami przetwarzania zostanie
        opublikowana w finalnej wersji dokumentu.
      </p>

      <h2>5. Czas przechowywania</h2>
      <ul>
        <li>
          Dane konta i historia zjazdów — do momentu usunięcia konta przez Ciebie.
        </li>
        <li>
          Po usunięciu konta dane są kasowane <strong>natychmiast</strong> z
          aktywnej bazy. Pozostałości w kopiach zapasowych są usuwane w cyklu do
          30 dni.
        </li>
        <li>
          Logi diagnostyczne — maksymalnie 90 dni od daty zdarzenia.
        </li>
      </ul>

      <h2>6. Twoje prawa</h2>
      <ul>
        <li>Prawo dostępu do danych i otrzymania kopii.</li>
        <li>Prawo do sprostowania niepoprawnych danych.</li>
        <li>Prawo do usunięcia („prawo do bycia zapomnianym").</li>
        <li>Prawo do ograniczenia przetwarzania.</li>
        <li>Prawo do przenoszenia danych.</li>
        <li>Prawo do wniesienia sprzeciwu.</li>
        <li>
          Prawo do złożenia skargi do organu nadzorczego (w Polsce: Prezes
          Urzędu Ochrony Danych Osobowych).
        </li>
      </ul>
      <p>
        Aby skorzystać z powyższych praw, napisz na{' '}
        <a href="mailto:privacy@nwdisorder.com">privacy@nwdisorder.com</a>.
      </p>

      <h2>7. Usunięcie konta</h2>
      <p>
        Konto i wszystkie powiązane dane możesz usunąć bezpośrednio w
        aplikacji: <strong>Profil → Usuń konto</strong>. Operacja jest
        nieodwracalna. Szczegóły:{' '}
        <a href="/delete-account">/delete-account</a>.
      </p>

      <h2>8. Bezpieczeństwo</h2>
      <p>
        Stosujemy szyfrowanie w spoczynku i w tranzycie (TLS), kontrolę dostępu
        opartą na rolach (RLS w bazie danych) oraz ścisłą izolację danych
        między użytkownikami. Mimo to żadna usługa internetowa nie może
        zagwarantować absolutnego bezpieczeństwa.
      </p>

      <h2>9. Dzieci</h2>
      <p>
        Aplikacja nie jest skierowana do osób poniżej 13 roku życia. Jeżeli
        wiesz, że konto należące do dziecka zostało założone bez zgody opiekuna
        prawnego, skontaktuj się z nami i niezwłocznie je usuniemy.
      </p>

      <h2>10. Zmiany dokumentu</h2>
      <p>
        Możemy aktualizować niniejszą politykę. O istotnych zmianach
        poinformujemy w aplikacji lub mailem. Bieżąca wersja i data publikacji
        są zawsze podane na górze dokumentu.
      </p>

      <h2>Kontakt</h2>
      <p>
        Pytania dotyczące prywatności:{' '}
        <a href="mailto:privacy@nwdisorder.com">privacy@nwdisorder.com</a>
        <br />
        Wsparcie ogólne:{' '}
        <a href="mailto:support@nwdisorder.com">support@nwdisorder.com</a>
      </p>
    </main>
  );
}
