'use client';

import {
  Button,
  Input,
  Label,
} from '@saas-clean/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CircleIcon, Loader2 } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { useTranslations } from 'next-intl';
import { useLocaleContext } from '../LocaleProvider';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const inviteId = searchParams.get('inviteId');
  const { locale } = useLocaleContext();
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );

  const toggleParams = new URLSearchParams();
  if (redirect) toggleParams.set('redirect', redirect);
  if (priceId) toggleParams.set('priceId', priceId);
  if (inviteId) toggleParams.set('inviteId', inviteId);
  const toggleQuery = toggleParams.toString();
  const toggleHref = `/${locale}/${
    mode === 'signin' ? 'sign-up' : 'sign-in'
  }${toggleQuery ? `?${toggleQuery}` : ''}`;

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <CircleIcon className="h-12 w-12 text-orange-500" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          {mode === 'signin' ? t('signinTitle') : t('signupTitle')}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <form className="space-y-6" action={formAction}>
          <input type="hidden" name="redirect" value={redirect || ''} />
          <input type="hidden" name="priceId" value={priceId || ''} />
          <input type="hidden" name="inviteId" value={inviteId || ''} />
          <input type="hidden" name="locale" value={locale} />
          <div>
            <Label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('emailLabel')}
            </Label>
            <div className="mt-1">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={state.email}
                required
                maxLength={50}
                className="w-full rounded-full border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder={t('emailPlaceholder')}
              />
            </div>
          </div>

          <div>
            <Label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('passwordLabel')}
            </Label>
            <div className="mt-1">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                defaultValue={state.password}
                required
                minLength={8}
                maxLength={100}
                className="w-full rounded-full border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder={t('passwordPlaceholder')}
              />
            </div>
          </div>

          {state?.error && (
            <div className="text-sm text-red-500">{state.error}</div>
          )}

          <div>
            <Button
              type="submit"
              className="flex w-full items-center justify-center rounded-full border border-transparent bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('loading')}
                </>
              ) : mode === 'signin' ? (
                t('signinButton')
              ) : (
                t('signupButton')
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-50 px-2 text-gray-500 dark:bg-gray-950 dark:text-gray-300">
                {mode === 'signin' ? t('newHere') : t('existingUser')}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href={toggleHref}
              className="flex w-full justify-center rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {mode === 'signin' ? t('createAccount') : t('signinExisting')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
