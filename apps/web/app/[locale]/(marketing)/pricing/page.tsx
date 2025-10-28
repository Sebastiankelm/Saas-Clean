import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { getTranslations } from 'next-intl/server';
import { SubmitButton } from './submit-button';

// Prices are fresh for one hour max
export const revalidate = 3600;

type PricingCardProps = {
  name: string;
  price: number;
  interval: string;
  trialDays: number;
  features: string[];
  priceId?: string;
  trialLabel: (days: number) => string;
  intervalLabel: (interval: string) => string;
};

export default async function PricingPage() {
  const t = await getTranslations('pricing');
  const [prices, products] = await Promise.all([
    getStripePrices(),
    getStripeProducts(),
  ]);

  const basePlan = products.find((product) => product.name === 'Base');
  const plusPlan = products.find((product) => product.name === 'Plus');

  const basePrice = prices.find((price) => price.productId === basePlan?.id);
  const plusPrice = prices.find((price) => price.productId === plusPlan?.id);

  const translateTrialLabel = (days: number) =>
    t('trial', { days });
  const translateIntervalLabel = (interval: string) =>
    t(`interval.${interval}` as const, { default: interval });

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-xl gap-8 md:grid-cols-2">
        <PricingCard
          name={basePlan?.name || t('plans.base.name')}
          price={basePrice?.unitAmount || 800}
          interval={basePrice?.interval || 'month'}
          trialDays={basePrice?.trialPeriodDays || 7}
          features={(t.raw('plans.base.features') as string[]) ?? []}
          priceId={basePrice?.id}
          trialLabel={translateTrialLabel}
          intervalLabel={translateIntervalLabel}
        />
        <PricingCard
          name={plusPlan?.name || t('plans.plus.name')}
          price={plusPrice?.unitAmount || 1200}
          interval={plusPrice?.interval || 'month'}
          trialDays={plusPrice?.trialPeriodDays || 7}
          features={(t.raw('plans.plus.features') as string[]) ?? []}
          priceId={plusPrice?.id}
          trialLabel={translateTrialLabel}
          intervalLabel={translateIntervalLabel}
        />
      </div>
    </main>
  );
}

function PricingCard({
  name,
  price,
  interval,
  trialDays,
  features,
  priceId,
  trialLabel,
  intervalLabel,
}: PricingCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-lg dark:border-gray-800 dark:bg-gray-950">
      <h2 className="mb-2 text-2xl font-medium text-gray-900 dark:text-white">{name}</h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {trialLabel(trialDays)}
      </p>
      <p className="mb-6 text-4xl font-medium text-gray-900 dark:text-white">
        ${price / 100}{' '}
        <span className="text-xl font-normal text-gray-600 dark:text-gray-300">
          {intervalLabel(interval)}
        </span>
      </p>
      <ul className="mb-8 space-y-4">
        {features.map((feature, index) => (
          <li key={`${feature}-${index}`} className="flex items-start">
            <Check className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
            <span className="text-gray-700 dark:text-gray-200">{feature}</span>
          </li>
        ))}
      </ul>
      <form action={checkoutAction}>
        <input type="hidden" name="priceId" value={priceId} />
        <SubmitButton />
      </form>
    </div>
  );
}
