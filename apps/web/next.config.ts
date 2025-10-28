import type { NextConfig } from 'next';
import { locales, defaultLocale } from './src/i18n/config';

const nextConfig: NextConfig = {
  i18n: {
    locales: [...locales],
    defaultLocale,
    localeDetection: true,
  },
  experimental: {
    ppr: true,
    clientSegmentCache: true,
    nodeMiddleware: true,
  },
  transpilePackages: ['@saas-clean/ui'],
};

export default nextConfig;
