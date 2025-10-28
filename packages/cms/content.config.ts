import { defineCollection, defineConfig } from '@content-collections/core';
import { z } from 'zod';

const blog = defineCollection({
  name: 'blog',
  directory: 'content/blog',
  include: '*.json',
  parser: 'json',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    excerpt: z.string(),
    locale: z.string().min(2),
    publishedAt: z.string(),
    author: z.string(),
    readTimeMinutes: z.number().int().positive(),
  }),
});

const faq = defineCollection({
  name: 'faq',
  directory: 'content/faq',
  include: '*.json',
  parser: 'json',
  schema: z.object({
    question: z.string(),
    answer: z.string(),
    locale: z.string().min(2),
    order: z.number().int().nonnegative(),
  }),
});

const testimonials = defineCollection({
  name: 'testimonials',
  directory: 'content/testimonials',
  include: '*.json',
  parser: 'json',
  schema: z.object({
    name: z.string(),
    role: z.string(),
    quote: z.string(),
    locale: z.string().min(2),
    company: z.string().optional(),
    avatar: z.string().optional(),
  }),
});

const features = defineCollection({
  name: 'features',
  directory: 'content/features',
  include: '*.json',
  parser: 'json',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    locale: z.string().min(2),
    icon: z.enum(['terminal', 'database', 'payments', 'automation']),
    order: z.number().int().nonnegative(),
  }),
});

export default defineConfig({
  collections: [blog, faq, testimonials, features],
});
