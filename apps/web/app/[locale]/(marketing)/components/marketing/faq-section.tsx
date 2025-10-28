import type { FaqEntry } from '@saas-clean/cms';

type FAQSectionProps = {
  title: string;
  description: string;
  items: FaqEntry[];
};

export function FAQSection({ title, description, items }: FAQSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-16 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">{title}</h2>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{description}</p>
        </div>
        <dl className="mt-12 space-y-6">
          {items.map((item) => (
            <div key={`${item.locale}-${item.question}`} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <dt className="text-lg font-semibold text-gray-900 dark:text-white">{item.question}</dt>
              <dd className="mt-3 text-base text-gray-600 dark:text-gray-300">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
