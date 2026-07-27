import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

const paths = ['/', '/guide', '/methodology', '/about', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return paths.map((path) => ({
    url: new URL(path, base).toString(),
    lastModified: new Date('2026-07-28T00:00:00+09:00'),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
