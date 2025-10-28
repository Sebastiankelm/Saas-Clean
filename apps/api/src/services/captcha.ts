import { optionalEnv, env } from '../env';

type CaptchaResponse = {
  success: boolean;
  'error-codes'?: string[];
};

export const verifyCaptchaToken = async (token: string, ipAddress?: string | null): Promise<boolean> => {
  if (optionalEnv.skipCaptcha) {
    return true;
  }

  if (!env.turnstileSecret) {
    throw new Error('TURNSTILE_SECRET_KEY (or TURNSTILE_SECRET) must be configured to enforce captcha.');
  }

  const formData = new URLSearchParams();
  formData.append('secret', env.turnstileSecret);
  formData.append('response', token);
  if (ipAddress) {
    formData.append('remoteip', ipAddress);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as CaptchaResponse;
  return payload.success === true;
};
