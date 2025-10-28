import type { TestimonialEntry } from '@saas-clean/cms';

type TestimonialsSectionProps = {
  title: string;
  description: string;
  testimonials: TestimonialEntry[];
};

export function TestimonialsSection({ title, description, testimonials }: TestimonialsSectionProps) {
  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section className="bg-gray-50 py-16 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">{title}</h2>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{description}</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article
              key={`${testimonial.locale}-${testimonial.name}`}
              className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-950"
            >
              <p className="text-base text-gray-700 dark:text-gray-300">“{testimonial.quote}”</p>
              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{testimonial.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
