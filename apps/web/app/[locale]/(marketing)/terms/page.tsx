export default function TermsPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16">
      <header className="mb-12">
        <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
          Regulamin Serwisu
        </h1>
        <p className="text-muted-foreground text-sm">
          Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
        </p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Postanowienia Ogólne</h2>
          <p>
            Niniejszy Regulamin określa zasady korzystania z usług świadczonych przez [Twoja Firma]
            za pośrednictwem platformy SaaS dostępnej pod adresem [twoja-domena.pl].
          </p>
          <p>
            Usługodawcą jest [Twoja Firma], z siedzibą w [Adres], NIP: [NIP].
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Definicje</h2>
          <ul>
            <li><strong>Serwis</strong> - platforma SaaS dostępna pod adresem [twoja-domena.pl]</li>
            <li><strong>Użytkownik</strong> - osoba fizyczna, prawna lub jednostka organizacyjna korzystająca z Serwisu</li>
            <li><strong>Konto</strong> - konto użytkownika utworzone w Serwisie</li>
            <li><strong>Subskrypcja</strong> - płatna usługa dostępna w ramach różnych planów cenowych</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Zakres Usług</h2>
          <p>Usługodawca świadczy następujące usługi:</p>
          <ul>
            <li>WAWA udostępnienie platformy SaaS</li>
            <li>Przechowywanie danych użytkownika</li>
            <li>Obsługa płatności online</li>
            <li>Wsparcie techniczne</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Rejestracja i Konto Użytkownika</h2>
          <ul>
            <li>Rejestracja wymaga podania ważnego adresu e-mail oraz hasła</li>
            <li>Użytkownik zobowiązuje się do zachowania poufności danych logowania</li>
            <li>Użytkownik ponosi odpowiedzialność za działania wykonane z jego Konta</li>
            <li>Jeden użytkownik może utworzyć jedno konto</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Plany i Płatności</h2>
          <ul>
            <li>Ceny usług podane są w złotych polskich (PLN) i zawierają podatek VAT</li>
            <li>Płatności realizowane są przez Stripe</li>
            <li>Subskrypcja jest automatycznie odnawiana</li>
            <li>Użytkownik może anulować subskrypcję w dowolnym momencie</li>
            <li>Zwroty środków realizowane są według polityki zwrotów Stripe</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Obowiązki Użytkownika</h2>
          <p>Użytkownik zobowiązuje się do:</p>
          <ul>
            <li>Podawania prawdziwych i aktualnych danych</li>
            <li>Nietyki niel-legalnego wykorzystywania usług</li>
            <li>Przestrzegania przepisów prawa</li>
            <li>Nieprzekazywania danych logowania osobom trzecim</li>
            <li>Poszanowania praw własności intelektualnej Usługodawcy</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Zakazane Działania</h2>
          <p>Zabronione jest:</p>
          <ul>
            <li>Wykorzystywanie Serwisu do działań niezgodnych z prawem</li>
            <li>Prób włamania lub naruszenia bezpieczeństwa</li>
            <li>Wysyłanie spamu lub niechcianej korespondencji</li>
            <li>Kopiowanie lub rozpowszechnianie treści bez zgody</li>
            <li>Zakłócanie pracy Serwisu</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Odpowiedzialność</h2>
          <ul>
            <li>Usługodawca nie ponosi odpowiedzialności za awarie niezależne od niego</li>
            <li>Użytkownik odpowiada za treści zamieszczane w Serwisie</li>
            <li>Usługodawca nie gwarantuje ciągłości działania Serwisu</li>
            <li>Odpowiedzialność Usługodawcy ograniczona jest do wysokości opłat za ostatni okres rozliczeniowy</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Własność Intelektualna</h2>
          <p>
            Wszelkie prawa do Serwisu, w tym kodu, interfejsu, nazwy i loga, należą do Usługodawcy.
            Użytkownik otrzymuje ograniczone, niewyłączne prawo do korzystania z Serwisu.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Rezygnacja i Rozwiązanie Umowy</h2>
          <ul>
            <li>Użytkownik może usunąć swoje konto w dowolnym momencie</li>
            <li>Usługodawca może zablokować dostęp do Konta w przypadku naruszenia Regulaminu</li>
            <li>Po usunięciu konta dane zostaną usunięte zgodnie z Polityką Prywatności</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Postanowienia Końcowe</h2>
          <ul>
            <li>Regulamin wchodzi w życie z chwilą rozpoczęcia korzystania z Serwisu</li>
            <li>Usługodawca zastrzega sobie prawo do zmian Regulaminu</li>
            <li>W sprawach nieuregulowanych Regulaminem stosuje się przepisy prawa polskiego</li>
            <li>Spory rozstrzygane będą przez sąd właściwy dla siedziby Usługodawcy</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">12. Kontakt</h2>
          <p>
            W sprawach dotyczących Regulaminu kontakt:<br />
            <strong>E-mail:</strong> support@[twoja-domena].pl<br />
            <strong>Adres:</strong> [Twój adres]
          </p>
        </section>
      </div>
    </article>
  );
}

