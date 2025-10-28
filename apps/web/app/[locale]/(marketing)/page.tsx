import { Button } from '@saas-clean/ui';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getBlogPosts, getFaqEntries, getFeatures, getTestimonials } from '@saas-clean/cms';
import { BlogSection } from './components/marketing/blog-section';
import { FAQSection } from './components/marketing/faq-section';
import { FeaturesSection } from './components/marketing/features-section';
import { TestimonialsSection } from './components/marketing/testimonials-section';
import { Terminal } from './terminal';

export const dynamic = 'force-static';

export default async function HomePage({
  params,
}: {
  params: { locale: string };
}) {
  const t = await getTranslations('marketing');
  const locale = params.locale === 'pl' ? 'pl' : 'en';

  const features = getFeatures(locale);
  const testimonials = getTestimonials(locale);
  const faq = getFaqEntries(locale);
  const blogPosts = getBlogPosts(locale).slice(0, 3);

  return (
    <main>
      <section className="bg-white py-20 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="md:mx-auto md:max-w-2xl sm:text-center lg:col-span-6 lg:mx-0 lg:text-left">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
                {t('hero.title')}
                <span className="block text-orange-500">{t('hero.highlight')}</span>
              </h1>
              <p className="mt-3 text-base text-gray-600 dark:text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                {t('hero.description')}
              </p>
              <div className="mt-8 sm:mx-auto sm:max-w-lg sm:text-center lg:mx-0 lg:text-left">
                <Link
                  href="https://vercel.com/templates/next.js/next-js-saas-starter"
                  target="_blank"
                  className="inline-block"
                >
                  <Button size="lg" variant="outline" className="rounded-full text-lg">
                    {t('hero.cta')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative mt-12 sm:mx-auto sm:max-w-lg lg:col-span-6 lg:mx-0 lg:flex lg:items-center lg:justify-end lg:pl-8">
              <Terminal />
            </div>
          </div>
        </div>
      </section>

      <FeaturesSection features={features} />

      <TestimonialsSection
        title={t('testimonials.title')}
        description={t('testimonials.description')}
        testimonials={testimonials}
      />

      <FAQSection title={t('faq.title')} description={t('faq.description')} items={faq} />

      <BlogSection
        title={t('blog.title')}
        description={t('blog.description')}
        posts={blogPosts}
        locale={locale}
      />

      <section className="bg-gray-50 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
                {t('cta.title')}
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-gray-600 dark:text-gray-300">
                {t('cta.description')}
              </p>
            </div>
            <div className="mt-8 flex justify-center lg:mt-0 lg:justify-end">
              <Link href="https://github.com/nextjs/saas-starter" target="_blank" className="inline-block">
                <Button size="lg" variant="outline" className="rounded-full text-lg">
                  {t('cta.action')}
                  <ArrowRight className="ml-3 h-6 w-6" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
