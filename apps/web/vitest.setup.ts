import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('better-auth/integrations/next-js', () => ({
  nextCookies: vi.fn(),
}));

vi.mock('@/lib/auth/better', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));
