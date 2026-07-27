const DEFAULT_SITE_URL =
  'https://yechan-car-finance-2026.godwkd1030.chatgpt.site';

export function siteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): URL {
  try {
    const parsed = new URL(value?.trim() || DEFAULT_SITE_URL);
    return parsed.protocol === 'https:' ? parsed : new URL(DEFAULT_SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}
