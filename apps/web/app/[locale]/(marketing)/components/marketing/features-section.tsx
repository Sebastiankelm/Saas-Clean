import type { FeatureEntry } from '@saas-clean/cms';
import { CreditCard, Database, Terminal as TerminalIcon, Workflow } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

const ICONS: Record<FeatureEntry['icon'], ComponentType<SVGProps<SVGSVGElement>>> = {
  terminal: TerminalIcon,
  database: Database,
  payments: CreditCard,
  automation: Workflow,
};

type FeaturesSectionProps = {
  features: FeatureEntry[];
};

export function FeaturesSection({ features }: FeaturesSectionProps) {
  return (
    <section className="w-full bg-white py-16 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = ICONS[feature.icon];
            return (
              <article key={`${feature.locale}-${feature.title}`} className={index === 0 ? '' : 'mt-10 lg:mt-0'}>
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-orange-500 text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-5">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">{feature.title}</h2>
                  <p className="mt-2 text-base text-gray-600 dark:text-gray-300">{feature.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
