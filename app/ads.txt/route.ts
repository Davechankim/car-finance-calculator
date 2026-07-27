import { getAdsenseConfig } from '@/lib/adsense';

export function GET() {
  const config = getAdsenseConfig();
  if (!config.active) {
    return new Response('AdSense publisher is not configured.\n', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
  return new Response(
    `google.com, ${config.publisherId}, DIRECT, f08c47fec0942fa0\n`,
    {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    },
  );
}
