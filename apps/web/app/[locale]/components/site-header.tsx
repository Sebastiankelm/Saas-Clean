'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@saas-clean/ui';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { CircleIcon, Home, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LanguageSwitcher } from './language-switcher';
import { useLocaleContext } from '../LocaleProvider';
import { signOut } from '../(auth)/actions';
import useSWR, { mutate } from 'swr';
import type { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { locale } = useLocaleContext();
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const router = useRouter();
  const t = useTranslations('navigation');

  async function handleSignOut() {
    await signOut();
    mutate('/api/user');
    router.push(`/${locale}`);
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href={`/${locale}/pricing`}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
        >
          {t('links.pricing')}
        </Link>
        <Button asChild className="rounded-full">
          <Link href={`/${locale}/sign-up`}>{t('links.signUp')}</Link>
        </Button>
      </div>
    );
  }

  const initials = (user.name || user.email)
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger>
        <Avatar className="cursor-pointer size-9">
          <AvatarImage alt={user.name || ''} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <DropdownMenuItem className="cursor-pointer">
          <Link href={`/${locale}/dashboard`} className="flex w-full items-center">
            <Home className="mr-2 h-4 w-4" />
            <span>{t('links.dashboard')}</span>
          </Link>
        </DropdownMenuItem>
        <form action={handleSignOut} className="w-full">
          <button type="submit" className="flex w-full">
            <DropdownMenuItem className="w-full flex-1 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('actions.signOut')}</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const t = useTranslations('navigation');
  const { locale } = useLocaleContext();

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between md:justify-start">
          <Link href={`/${locale}`} className="flex items-center">
            <CircleIcon className="h-6 w-6 text-orange-500" />
            <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('brand')}
            </span>
          </Link>
        </div>
        <div className="flex items-center justify-between gap-4 md:justify-end">
          <LanguageSwitcher />
          <Suspense fallback={<div className="h-9 w-24" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
