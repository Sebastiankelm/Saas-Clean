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
import { useActionState, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { updateAccount } from '@/app/[locale]/(auth)/actions';
import type { User } from '@/lib/db/schema';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

type ActionState = {
  name?: string;
  error?: string;
  success?: string;
};

type AccountFormProps = {
  state: ActionState;
  nameValue?: string;
  emailValue?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function AccountForm({
  state,
  nameValue = '',
  emailValue = '',
}: AccountFormProps) {
  const t = useTranslations('dashboard.general.form');
  return (
    <>
      <div>
        <Label htmlFor="name" className="mb-2">
          {t('nameLabel')}
        </Label>
        <Input
          id="name"
          name="name"
          placeholder={t('namePlaceholder')}
          defaultValue={state.name || nameValue}
          required
        />
      </div>
      <div>
        <Label htmlFor="email" className="mb-2">
          {t('emailLabel')}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          defaultValue={emailValue}
          required
        />
      </div>
    </>
  );
}

function AccountFormWithData({ state }: { state: ActionState }) {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  return (
    <AccountForm
      state={state}
      nameValue={user?.name ?? ''}
      emailValue={user?.email ?? ''}
    />
  );
}

export default function GeneralPage() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateAccount,
    {}
  );
  const t = useTranslations('dashboard.general');
  const formTranslations = useTranslations('dashboard.general.form');

  return (
    <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
      <h1 className="mb-6 text-lg font-medium text-gray-900 dark:text-white lg:text-2xl">
        {t('title')}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action={formAction}>
            <Suspense fallback={<AccountForm state={state} />}>
              <AccountFormWithData state={state} />
            </Suspense>
            {state.error && (
              <p className="text-sm text-red-500">{state.error}</p>
            )}
            {state.success && (
              <p className="text-sm text-green-500">
                {formTranslations('success')}
              </p>
            )}
            <Button
              type="submit"
              className="rounded-full bg-orange-500 text-white hover:bg-orange-600"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {formTranslations('saving')}
                </>
              ) : (
                formTranslations('submit')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
