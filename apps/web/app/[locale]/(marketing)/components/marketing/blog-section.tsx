import type { BlogEntry } from '@saas-clean/cms';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

function formatDate(date: string, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return formatter.format(new Date(date));
}

type BlogSectionProps = {
  title: string;
  description: string;
  posts: BlogEntry[];
  locale: string;
};

export function BlogSection({ title, description, posts, locale }: BlogSectionProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-16 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">{title}</h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{description}</p>
          </div>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {posts.map((post) => (
            <article
              key={`${post.locale}-${post.slug}`}
              className="group flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-orange-500 hover:shadow-lg dark:border-gray-800 dark:bg-gray-950"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">
                  {formatDate(post.publishedAt, locale)}
                </p>
                <h3 className="mt-4 text-xl font-semibold text-gray-900 transition group-hover:text-orange-500 dark:text-white">
                  {post.title}
                </h3>
                <p className="mt-3 text-base text-gray-600 dark:text-gray-300">{post.excerpt}</p>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>
                  {locale === 'pl'
                    ? `${post.readTimeMinutes} min czytania`
                    : `${post.readTimeMinutes} min read`}
                </span>
                <Link
                  href={`/${locale}/blog/${post.slug}`}
                  className="inline-flex items-center font-semibold text-orange-500 hover:text-orange-400"
                >
                  {locale === 'pl' ? 'Czytaj więcej' : 'Read more'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
