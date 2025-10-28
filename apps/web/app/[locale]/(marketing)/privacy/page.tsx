export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16">
      <header className="mb-12">
        <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
          Polityka Prywatności
        </h1>
        <p className="text-muted-foreground text-sm">
          Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
        </p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Wprowadzenie</h2>
          <p>
            Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych przekazanych przez Użytkowników
            w związku z korzystaniem z usług świadczonych drogą elektroniczną przez [Twoja Firma] (dalej: "Serwis").
          </p>
          <p>
            Administratorem danych osobowych jest [Twoja Firma], z siedzibą w [Adres], wpisana do rejestru przedsiębiorców
            pod numerem NIP: [NIP], REGON: [REGON].
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Podstawa prawna przetwarzania danych</h2>
          <p>Przetwarzamy dane osobowe na podstawie:</p>
          <ul>
            <li>Twojej zgody (Art. 6 ust. 1 lit. a RODO) - gdy rejestrujesz się w Serwisie</li>
            <li>Wykonania umowy (Art. 6 ust. 1 lit. b RODO) - w celu świadczenia usług</li>
            <li>Prawnie usprawiedliwionych interesów (Art. 6 ust. 1 lit. f RODO) - w celu zapewnienia bezpieczeństwa</li>
            <li>Obowiązku prawnego (Art. 6 ust. 1 lit. c RODO) - np. fakturowanie</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Zakres zbieranych danych</h2>
          <p>Przetwarzamy następujące dane osobowe:</p>
          <ul>
            <li>Imię i nazwisko (opcjonalnie)</li>
            <li>Adres e-mail</li>
            <li>Hasło (w formie zahashowanej)</li>
            <li>Dane dotyczące subskrypcji i płatności (przetwarzane przez Stripe)</li>
            <li>Dane o korzystaniu z Serwisu (logi systemowe)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Cele przetwarzania danych</h2>
          <p>Dane osobowe przetwarzamy w celu:</p>
          <ul>
            <li>Świadczenia usług dostępnych w Serwisie</li>
            <li>Obsługi płatności i fakturowania</li>
            <li>Komunikacji z Użytkownikami</li>
            <li>Zapewnienia bezpieczeństwa Serwisu</li>
            <li>Wykonywania obowiązków prawnych (np. podatkowych)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Udostępnienie danych</h2>
          <p>Twoje dane mogą być udostępnione:</p>
          <ul>
            <li><strong>Stripe</strong> - w celu obsługi płatności i faktur (zgodnie z ich polityką prywatności)</li>
            <li><strong>Supabase</strong> - w celu przechowywania danych i autentykacji</li>
            <li>Dostawcom usług hostingowych</li>
            <li>Organom państwowym na żądanie wynikające z przepisów prawa</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Okres przechowywania danych</h2>
          <p>
            Dane przechowujemy przez okres:
          </p>
          <ul>
            <li>Dane użytkownika - przez okres świadczenia usług + 3 lata zgodnie z przepisami o księgowości</li>
            <li>Logi systemowe - 12 miesięcy</li>
            <li>Faktury - zgodnie z przepisami podatkowymi (5 lat niedzielnie)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Twoje prawa (RODO)</h2>
          <p>Przysługuje Ci prawo do:</p>
          <ul>
            <li>Dostępu do swoich danych osobowych</li>
            <li>Sprostowania danych</li>
            <li>Usunięcia danych ("prawo do bycia zapomnianym")</li>
            <li>Ograniczenia przetwarzania</li>
            <li>Przenoszenia danych</li>
            <li>Wniesienia sprzeciwu wobec przetwarzania</li>
            <li>Cofnięcia zgody w dowolnym momencie</li>
            <li>Wniesienia skargi do UODO (https://uodo.gov.pl)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Cookies</h2>
          <p>
            Serwis wykorzystuje pliki cookies w celu zapewnienia poprawnego działania oraz analizy statystyk.
            Możesz zarządzać ustawieniami cookies w swojej przeglądarce.
          </p>
          <p>
            Więcej informacji w naszej <a href="/cookies" className="text-orange-500 hover:underline">Polityce Cookies</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Transfer danych poza EOG</h2>
          <p>
            Niektóre dane mogą być przetwarzane poza Europejskim Obszarem Gospodarczym (Stripe, Supabase).
            Transfer odbywa się na podstawie Standardowych Klauzul Umownych zatwierdzonych Mit Komisji Europejskiej.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Kontakt</h2>
          <p>
            W sprawach dotyczących ochrony danych osobowych kontakt:<br />
            <strong>E-mail:</strong> privacy@[twoja-domena].pl<br />
            <strong>Adres:</strong> [Twój adres do korespondencji]
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Zmiany w polityce</h2>
          <p>
            Zastrzegamy sobie prawo do wprowadzania zmian w niniejszej Polityce Prywatności.
            O zmianach poinformujemy Użytkowników poprzez wiadomość e-mail oraz aktualizację daty "Ostatnia aktualizacja".
          </p>
        </section>
      </div>
    </article>
  );
}

