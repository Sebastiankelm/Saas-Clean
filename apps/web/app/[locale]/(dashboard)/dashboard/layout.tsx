'use client';

import { Button } from '@saas-clean/ui';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Settings, Shield, Activity, Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocaleContext } from '../../LocaleProvider';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { locale } = useLocaleContext();
  const t = useTranslations('dashboard.navigation');

  const navItems = useMemo(
    () => [
      { href: `/${locale}/dashboard`, icon: Users, label: t('team') },
      { href: `/${locale}/dashboard/general`, icon: Settings, label: t('general') },
      { href: `/${locale}/dashboard/activity`, icon: Activity, label: t('activity') },
      { href: `/${locale}/dashboard/security`, icon: Shield, label: t('security') },
    ],
    [locale, t]
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-68px)] w-full max-w-7xl flex-col">
      {/* Mobile header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 lg:hidden">
        <span className="font-medium text-gray-900 dark:text-white">{t('title')}</span>
        <Button
          className="-mr-3"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">{t('toggle')}</span>
        </Button>
      </div>

      <div className="flex h-full flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`absolute inset-y-0 left-0 z-40 w-64 transform border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 lg:relative lg:block lg:bg-gray-50 lg:dark:bg-gray-900 ${
            isSidebarOpen ? 'block' : 'hidden'
          } lg:translate-x-0${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto p-4">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={`my-1 flex w-full justify-start shadow-none ${
                    pathname === item.href
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-white p-0 dark:bg-gray-950 lg:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
