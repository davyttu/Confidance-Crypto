import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const paths: { path: string; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number }[] = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/docs', changeFrequency: 'monthly', priority: 0.95 },
    { path: '/premiere-etape', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/second-step', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/find-proof', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/legal', changeFrequency: 'yearly', priority: 0.6 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.6 },
    { path: '/aide', changeFrequency: 'monthly', priority: 0.75 },
    { path: '/aide/debuter', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/aide/guides', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/aide/faq', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/aide/contact', changeFrequency: 'monthly', priority: 0.65 },
    { path: '/payment', changeFrequency: 'weekly', priority: 0.85 },
    { path: '/liquidity', changeFrequency: 'weekly', priority: 0.7 },
  ];

  return paths.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
