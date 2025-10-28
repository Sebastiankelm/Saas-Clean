'use client';

import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
} from '@saas-clean/ui';
import { Lock, Trash2, Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { updatePassword, deleteAccount } from '@/app/[locale]/(auth)/actions';
import { useTranslations } from 'next-intl';
import { useLocaleContext } from '../../../LocaleProvider';

type PasswordState = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  error?: string;
  success?: string;
};

type DeleteState = {
  password?: string;
  error?: string;
  success?: string;
};

export default function SecurityPage() {
  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    PasswordState,
    FormData
  >(updatePassword, {});

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    DeleteState,
    FormData
  >(deleteAccount, {});

  const t = useTranslations('dashboard.security');
  const passwordTranslations = useTranslations('dashboard.security.password');
  const deleteTranslations = useTranslations('dashboard.security.delete');
  const { locale } = useLocaleContext();

  return (
    <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
      <h1 className="mb-6 text-lg font-medium text-gray-900 dark:text-white lg:text-2xl">
        {t('title')}
      </h1>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{passwordTranslations('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action={passwordAction}>
            <input type="hidden" name="locale" value={locale} />
            <div>
              <Label htmlFor="current-password" className="mb-2">
                {passwordTranslations('currentLabel')}
              </Label>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                maxLength={100}
                defaultValue={passwordState.currentPassword}
              />
            </div>
            <div>
              <Label htmlFor="new-password" className="mb-2">
                {passwordTranslations('newLabel')}
              </Label>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={100}
                defaultValue={passwordState.newPassword}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password" className="mb-2">
                {passwordTranslations('confirmLabel')}
              </Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                maxLength={100}
                defaultValue={passwordState.confirmPassword}
              />
            </div>
            {passwordState.error && (
              <p className="text-sm text-red-500">{passwordState.error}</p>
            )}
            {passwordState.success && (
              <p className="text-sm text-green-500">{passwordState.success}</p>
            )}
            <Button
              type="submit"
              className="rounded-full bg-orange-500 text-white hover:bg-orange-600"
              disabled={isPasswordPending}
            >
              {isPasswordPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {passwordTranslations('updating')}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {passwordTranslations('submit')}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{deleteTranslations('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            {deleteTranslations('description')}
          </p>
          <form action={deleteAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <div>
              <Label htmlFor="delete-password" className="mb-2">
                {deleteTranslations('confirmLabel')}
              </Label>
              <Input
                id="delete-password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={100}
                defaultValue={deleteState.password}
              />
            </div>
            {deleteState.error && (
              <p className="text-sm text-red-500">{deleteState.error}</p>
            )}
            <Button
              type="submit"
              variant="destructive"
              className="rounded-full bg-red-600 text-white hover:bg-red-700"
              disabled={isDeletePending}
            >
              {isDeletePending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {deleteTranslations('deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteTranslations('submit')}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
