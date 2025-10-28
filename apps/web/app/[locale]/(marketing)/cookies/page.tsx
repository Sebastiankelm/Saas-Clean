export default function CookiesPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16">
      <header className="mb-12">
        <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
          Polityka Cookies
        </h1>
        <p className="text-muted-foreground text-sm">
          Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
        </p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Czym są pliki cookies?</h2>
          <p>
            Pliki cookies to małe pliki tekstowe zapisywane na Twoim urządzeniu (komputerze, tablecie, smartfonie)
            podczas przeglądania stron internetowych.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Jakie cookies używamy?</h2>
          <ul>
            <li><strong>auth-session</strong> - przechowuje sesję użytkownika</li>
            <li><strong>cookie-consent</strong> - zapamiętuje zgodę na cookies</li>
            <li><strong>locale</strong> - zapamiętuje wybrany język</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Zarządzanie cookies</h2>
          <p>
            Możesz zarządzać cookies w ustawieniach swojej przeglądarki lub przez banner zgody
            wyświetlany podczas pierwszej wizyty.
          </p>
        </section>
      </div>
    </article>
  );
}

