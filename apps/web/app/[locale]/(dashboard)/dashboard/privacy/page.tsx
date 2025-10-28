'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@saas-clean/ui';
import { Download, Trash2, Shield, Loader2 } from 'lucide-react';

export default function PrivacySettingsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const response = await fetch('/api/user/data-export');
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      setExportError('Wystąpił błąd podczas eksportu danych. Spróbuj ponownie.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Ustawienia Prywatności
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Zarządzaj swoimi danymi osobowymi zgodnie z RODO
        </p>
      </div>

      <div className="space-y-6">
        {/* GDPR Rights */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-orange-500" />
              <div>
                <CardTitle>Twoje prawa (RODO)</CardTitle>
                <CardDescription>
                  Zarządzaj zgodnie z Rozporządzeniem Ogólnym o Ochronie Danych
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Twoje prawa:
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Prawo dostępu do danych (Art. 15)</li>
                <li>Prawo do sprostowania danych (Art. 16)</li>
                <li>Prawo do usunięcia danych (Art. 17)</li>
                <li>Prawo do ograniczenia przetwarzania (Art. 18)</li>
                <li>Prawo do przenoszenia danych (Art. 20)</li>
                <li>Prawo sprzeciwu (Art. 21)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Download className="h-6 w-6 text-green-600" />
              <div>
                <CardTitle>Eksport danych (Art. 15 RODO)</CardTitle>
                <CardDescription>
                  Pobierz wszystkie swoje dane w formacie JSON
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Możesz pobrać kopię wszystkich swoich danych osobistych austawien, które przechowujemy w systemie.
              Dane zostaną wyeksportowane w formacie JSON.
            </p>
            {exportError && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
                {exportError}
              </div>
            )}
            <Button
              onClick={handleExportData}
              disabled={isExporting}
              className="rounded-full bg-green-600 hover:bg-green-700"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eksportowanie...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Pobierz dane
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Deletion */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Trash2 className="h-6 w-6 text-red-600" />
              <div>
                <CardTitle>Usunięcie konta (Art. 17 RODO)</CardTitle>
                <CardDescription>
                  Trwale usuń swoje konto i wszystkie dane
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800 mb-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Uwaga:</strong> Ta akcja jest nieodwracalna. Wszystkie Twoje dane zostaną trwale usunięte,
                w tym historia aktywności, zaproszenia i dostęp do zespołów. Nie będzie możliwości odzyskania danych.
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Jeśli chcesz usunąć swoje konto, przejdź do sekcji{' '}
              <a href="/dashboard/security" className="text-orange-500 hover:underline">
                Bezpieczeństwo
              </a>
              .
            </p>
          </CardContent>
        </Card>

        {/* Privacy Policy Links */}
        <Card>
          <CardHeader>
            <CardTitle>Dokumenty</CardTitle>
            <CardDescription>
              Zapoznaj się z naszą dokumentacją dotyczącą prywatności
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-orange-500 hover:underline"
            >
              → Polityka Prywatności
            </a>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-orange-500 hover:underline"
            >
              → Regulamin Serwisu
            </a>
            <a
              href="/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-orange-500 hover:underline"
            >
              → Polityka Cookies
            </a>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

