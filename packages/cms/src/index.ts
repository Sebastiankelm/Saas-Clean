import {
  allBlogs,
  allFaqs,
  allTestimonials,
  allFeatures,
} from '../.content-collections/generated/index.js';

type Locale = 'en' | 'pl';

function resolveLocale(locale: string): Locale {
  const normalized = locale.toLowerCase();
  if (normalized === 'pl') {
    return 'pl';
  }
  return 'en';
}

type BlogEntry = (typeof allBlogs)[number];
type FaqEntry = (typeof allFaqs)[number];
type TestimonialEntry = (typeof allTestimonials)[number];
type FeatureEntry = (typeof allFeatures)[number];

export function getBlogPosts(locale: string): BlogEntry[] {
  const target = resolveLocale(locale);
  return allBlogs
    .filter((post: BlogEntry) => post.locale === target)
    .sort((a: BlogEntry, b: BlogEntry) =>
      a.publishedAt > b.publishedAt ? -1 : a.publishedAt < b.publishedAt ? 1 : 0,
    );
}

export function getFaqEntries(locale: string): FaqEntry[] {
  const target = resolveLocale(locale);
  return allFaqs
    .filter((entry: FaqEntry) => entry.locale === target)
    .sort((a: FaqEntry, b: FaqEntry) => a.order - b.order);
}

export function getTestimonials(locale: string): TestimonialEntry[] {
  const target = resolveLocale(locale);
  return allTestimonials.filter((testimonial: TestimonialEntry) => testimonial.locale === target);
}

export function getFeatures(locale: string): FeatureEntry[] {
  const target = resolveLocale(locale);
  return allFeatures
    .filter((feature: FeatureEntry) => feature.locale === target)
    .sort((a: FeatureEntry, b: FeatureEntry) => a.order - b.order);
}

export type { BlogEntry, FaqEntry, TestimonialEntry, FeatureEntry };
export type { Locale };
