import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Regulamin — New World Disorder',
  description: 'Zasady korzystania z aplikacji NWD i ligi gravity.',
};

export default function TermsPage() {
  return (
    <main>
      <span className="eyebrow">Dokument prawny</span>
      <h1>Regulamin</h1>
      <p className="meta">Wersja robocza · ostatnia aktualizacja: 2026-04-08</p>

      <div className="draft-banner">
        WERSJA ROBOCZA — dokument w finalizacji prawnej. Treść może ulec zmianie
        przed publiczną publikacją w App Store.
      </div>

      <p className="lead">
        Korzystając z aplikacji New World Disorder („NWD", „aplikacja")
        akceptujesz poniższe warunki. Jeżeli się z nimi nie zgadzasz, nie
        korzystaj z aplikacji.
      </p>

      <h2>1. Czym jest NWD</h2>
      <p>
        NWD to mobilna aplikacja ligi gravity dla riderów MTB. Umożliwia
        nagrywanie zjazdów na oficjalnych trasach z weryfikacją GPS, prowadzenie
        sezonowych rankingów, zdobywanie rekordów osobistych i porównywanie
        wyników z innymi riderami.
      </p>

      <h2>2. Konto użytkownika</h2>
      <ul>
        <li>
          Aby brać udział w lidze, musisz założyć konto w aplikacji, podając
          adres e-mail i potwierdzając go jednorazowym kodem.
        </li>
        <li>
          Jesteś odpowiedzialny za ochronę dostępu do swojej skrzynki e-mail
          oraz konta.
        </li>
        <li>
          Jedna osoba — jedno konto. Posiadanie kilku kont w celu manipulacji
          rankingiem jest zakazane i może skutkować trwałym usunięciem
          wszystkich kont.
        </li>
        <li>
          Konto można usunąć w dowolnym momencie z poziomu aplikacji
          (Profil → Usuń konto). Szczegóły:{' '}
          <a href="/delete-account">/delete-account</a>.
        </li>
      </ul>

      <h2>3. Bezpieczeństwo i odpowiedzialność rider'a</h2>
      <div className="callout">
        <p>
          <strong>OSTRZEŻENIE.</strong> Kolarstwo gravity / downhill jest
          sportem o wysokim ryzyku obrażeń, w tym poważnych. NWD nie zastępuje
          rozsądku, doświadczenia ani sprzętu ochronnego.
        </p>
      </div>
      <ul>
        <li>
          Korzystasz z aplikacji <strong>na własną odpowiedzialność</strong>.
        </li>
        <li>
          Zawsze nosisz kask i odpowiedni sprzęt ochronny. Stosujesz się do
          regulaminu ośrodka, oznaczeń trasy i zasad fair-play.
        </li>
        <li>
          Sprawdzasz stan trasy przed zjazdem. Nie wjeżdżasz na trasę, której
          nie potrafisz bezpiecznie zjechać.
        </li>
        <li>
          Nie używaj aplikacji w sposób, który odwraca Twoją uwagę od jazdy.
          Aplikacja jest narzędziem pomiarowym — nie nawigatorem.
        </li>
        <li>
          NWD <strong>nie ponosi odpowiedzialności</strong> za wypadki,
          obrażenia, szkody materialne ani szkody osób trzecich powstałe w
          związku z korzystaniem z aplikacji.
        </li>
      </ul>

      <h2>4. Dokładność GPS i dostępność usługi</h2>
      <ul>
        <li>
          Pomiary GPS zależą od urządzenia użytkownika, warunków atmosferycznych,
          ukształtowania terenu i innych czynników, na które nie mamy wpływu.
        </li>
        <li>
          NWD <strong>nie gwarantuje</strong> 100% dokładności pomiaru czasu,
          dystansu, prędkości ani prawidłowej weryfikacji każdego zjazdu.
        </li>
        <li>
          NWD nie gwarantuje nieprzerwanej dostępności usługi. Możemy
          przeprowadzać prace techniczne, aktualizacje i okresowe wyłączenia.
        </li>
      </ul>

      <h2>5. Treści użytkownika</h2>
      <p>
        Treści, które tworzysz w aplikacji (nazwa rider tag, nazwa wyświetlana,
        zdjęcie profilowe), są Twoje. Udzielasz nam ograniczonej, niewyłącznej
        licencji na ich wyświetlanie w obrębie aplikacji w celu prowadzenia
        ligi.
      </p>
      <p>Zabronione jest publikowanie:</p>
      <ul>
        <li>Treści wulgarnych, obraźliwych, dyskryminujących lub nawołujących do nienawiści.</li>
        <li>Treści naruszających prawa osób trzecich, w tym prawa autorskie.</li>
        <li>Treści wprowadzających w błąd lub podszywających się pod inne osoby.</li>
        <li>Reklam, spamu, linków do treści zewnętrznych.</li>
      </ul>
      <p>
        Naruszające treści mogą zostać usunięte bez ostrzeżenia, a konto może
        zostać zawieszone lub trwale usunięte.
      </p>

      <h2>6. Integralność rankingu</h2>
      <p>
        Liga gravity ma sens tylko wtedy, gdy wyniki są prawdziwe. Z tego powodu
        zakazane jest:
      </p>
      <ul>
        <li>Manipulowanie sygnałem GPS lub używanie narzędzi spoofingowych.</li>
        <li>Symulowanie zjazdów bez fizycznej obecności na trasie.</li>
        <li>Zapisywanie przejazdów innych osób na własnym koncie.</li>
        <li>Wszelkie inne formy oszustwa wpływające na wynik na tablicy.</li>
      </ul>
      <p>
        Naruszenie tych zasad skutkuje unieważnieniem wyników, zerowaniem
        rankingu, a w poważnych przypadkach trwałym banem konta i powiązanego
        urządzenia.
      </p>

      <h2>7. Zawieszenie i usunięcie konta</h2>
      <p>
        Zastrzegamy sobie prawo do zawieszenia lub trwałego usunięcia konta w
        przypadku:
      </p>
      <ul>
        <li>Naruszenia niniejszego regulaminu.</li>
        <li>Zagrożenia dla bezpieczeństwa innych użytkowników lub systemu.</li>
        <li>Działania na szkodę integralności ligi.</li>
        <li>Wyraźnego żądania właściwych organów państwowych.</li>
      </ul>

      <h2>8. Własność intelektualna</h2>
      <p>
        Marka NWD, logotypy, kod aplikacji, projekt graficzny i mechaniki ligi
        należą do operatora aplikacji. Nie udzielamy licencji na ich
        kopiowanie, redystrybucję ani modyfikację bez wyraźnej zgody.
      </p>

      <h2>9. Zmiany regulaminu</h2>
      <p>
        Możemy aktualizować regulamin. O istotnych zmianach poinformujemy w
        aplikacji lub mailem. Dalsze korzystanie z aplikacji po wejściu zmian w
        życie oznacza ich akceptację.
      </p>

      <h2>10. Prawo właściwe</h2>
      <p>
        Regulamin podlega prawu polskiemu. Sądem właściwym do rozstrzygania
        sporów jest sąd właściwy dla siedziby operatora aplikacji, chyba że
        bezwzględnie obowiązujące przepisy o ochronie konsumentów stanowią
        inaczej.
      </p>

      <h2>Kontakt</h2>
      <p>
        Pytania dotyczące regulaminu:{' '}
        <a href="mailto:legal@nwdisorder.com">legal@nwdisorder.com</a>
        <br />
        Wsparcie ogólne:{' '}
        <a href="mailto:support@nwdisorder.com">support@nwdisorder.com</a>
      </p>
    </main>
  );
}
