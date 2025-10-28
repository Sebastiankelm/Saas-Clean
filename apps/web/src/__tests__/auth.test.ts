import { comparePasswords, hashPassword } from '@/lib/auth/session';

describe('authentication flows', () => {
  it('hashes and compares credentials', async () => {
    const password = 'Sup3r$ecret!';
    const hashed = await hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(hashed.length).toBeGreaterThan(password.length);
    await expect(comparePasswords(password, hashed)).resolves.toBe(true);
  });

  it('detects invalid credentials', async () => {
    const hashed = await hashPassword('valid-password');

    await expect(comparePasswords('invalid-password', hashed)).resolves.toBe(false);
  });
});
