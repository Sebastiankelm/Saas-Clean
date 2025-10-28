'use client';

import { Button } from '@saas-clean/ui';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

export function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('pricing.button');

  return (
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      className="w-full rounded-full"
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          {t('loading')}
        </>
      ) : (
        <>
          {t('label')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}
