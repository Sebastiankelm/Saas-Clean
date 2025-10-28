'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent } from '@saas-clean/ui';
import { X, Cookie } from 'lucide-react';
import Link from 'next/link';

const COOKIE_CONSENT_KEY = 'cookie-consent-given';

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Sprawdź czy użytkownik już wyraził zgodę
    const consentGiven = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consentGiven) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setShowBanner(false);
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'false');
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 max-w-2xl mx-auto shadow-lg border-2 border-orange-500 lg:left-auto lg:right-4">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Cookie className="h-6 w-6 text-orange-500" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Pliki cookies
              </h3>
              <button
                onClick={handleReject}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Ta strona wykorzystuje pliki cookies w celu zapewnienia prawidłowego działania,
              analizy ruchu oraz personalizacji treści. Więcej informacji znajdziesz w naszej{' '}
              <Link href="/privacy" className="text-orange-500 hover:underline">
                Polityce Prywatności
              </Link>
              {' '}i{' '}
              <Link href="/cookies" className="text-orange-500 hover:underline">
                Polityce Cookies
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleAccept} className="rounded-full bg-orange-500 hover:bg-orange-600">
                Akceptuję
              </Button>
              <Button onClick={handleReject} variant="outline" className="rounded-full">
                Odrzuć
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

