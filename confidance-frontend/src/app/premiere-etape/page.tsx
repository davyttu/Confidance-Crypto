'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import guideFr from '@/data/guide-wallet-crypto.json';
import guideEn from '@/data/guide-wallet-crypto.en.json';
import guideEs from '@/data/guide-wallet-crypto.es.json';
import guideRu from '@/data/guide-wallet-crypto.ru.json';
import guideZh from '@/data/guide-wallet-crypto.zh.json';

const guideByLang: Record<string, typeof guideFr> = {
  fr: guideFr,
  en: guideEn,
  es: guideEs,
  ru: guideRu,
  zh: guideZh,
};

function WalletIcon({ w }: { w: { id: string; name: string; icon: string; iconUrl?: string; iconImage?: string } }) {
  const [urlFailed, setUrlFailed] = useState(false);
  if (w.iconUrl && !urlFailed) {
    return (
      <span className="flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 shrink-0 p-1.5">
        <img
          src={w.iconUrl}
          alt={w.name}
          width={56}
          height={56}
          className="object-contain w-full h-full"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setUrlFailed(true)}
        />
      </span>
    );
  }
  if (w.iconImage) {
    return (
      <span className="flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 shrink-0 p-1">
        <Image src={w.iconImage} alt={w.name} width={56} height={56} className="object-contain w-full h-full" />
      </span>
    );
  }
  return <span className="text-3xl">{w.icon}</span>;
}

type Section = (typeof guideFr.sections)[number];

function SectionHero({ section }: { section: Section }) {
  if (section.type !== 'hero' || !section.content) return null;
  const c = section.content as {
    icon?: string;
    title?: { text: string; gradient?: boolean; size?: string };
    subtitle?: { text: string };
    description?: { text: string };
    badge?: { text: string };
  };
  const bgColors = (section as any).background?.colors ?? ['#667eea', '#764ba2', '#f093fb'];
  return (
    <section
      className="relative py-20 px-4 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${bgColors[0]} 0%, ${bgColors[1] ?? bgColors[0]} 50%, ${bgColors[2] ?? bgColors[1]} 100%)`,
      }}
    >
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-sm shadow-lg mb-4 ring-4 ring-white/10">
          <Wallet className="w-8 h-8 text-white" strokeWidth={1.75} />
        </span>
        <h1
          className={`text-4xl md:text-5xl font-bold text-white mb-4 ${
            c.title?.gradient ? 'bg-white/90 bg-clip-text text-transparent' : ''
          }`}
        >
          {c.title?.text}
        </h1>
        {c.subtitle?.text && (
          <p className="text-xl text-white/90 mb-6">{c.subtitle.text}</p>
        )}
        {c.description?.text && (
          <p className="text-lg text-white/90 max-w-2xl mx-auto mb-6">
            {c.description.text}
          </p>
        )}
        {c.badge?.text && (
          <span className="inline-block px-4 py-2 rounded-xl bg-white/20 backdrop-blur text-white text-sm font-medium">
            {c.badge.text}
          </span>
        )}
      </div>
    </section>
  );
}

function SectionContentWithVisual({ section }: { section: Section }) {
  if (section.type !== 'content-with-visual' || !section.content) return null;
  const c = section.content as {
    badge?: { text: string };
    title?: { text: string };
    description?: { text: string };
    cards?: Array<{ icon: string; title: string; description: string }>;
    highlight?: { icon: string; text: string };
  };
  return (
    <section className="py-16 px-4 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            {c.badge?.text && (
              <span className="inline-block px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4">
                {c.badge.text}
              </span>
            )}
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {c.title?.text}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              {c.description?.text}
            </p>
            {c.cards && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {c.cards.map((card, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                  >
                    <span className="text-2xl block mb-2">{card.icon}</span>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                      {card.title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {c.highlight && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <span className="mr-2">{c.highlight.icon}</span>
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  {c.highlight.text}
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-center">
            {/* Même logo que la navbar, agrandi par scale pour garder dégradé et forme identiques */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              <div
                className="absolute w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50 origin-center scale-[6.4]"
                aria-hidden
              >
                <span className="text-white font-bold text-[0.9375rem] select-none">C</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionFeatureComparison({ section }: { section: Section }) {
  if (section.type !== 'feature-comparison' || !section.content) return null;
  const c = section.content as {
    badge?: { text: string };
    title?: { text: string };
    subtitle?: { text: string };
    comparison?: {
      left: { title: string; icon: string; items: Array<{ icon: string; text: string }> };
      right: { title: string; icon: string; items: Array<{ icon: string; text: string }> };
    };
    summary?: { icon: string; title: string; text: string };
  };
  return (
    <section
      className="py-16 px-4"
      style={{
        background: 'linear-gradient(180deg, #f8f9ff 0%, #fff 100%)',
      }}
    >
      <div className="max-w-5xl mx-auto">
        {c.badge?.text && (
          <span className="inline-block px-3 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium mb-4">
            {c.badge.text}
          </span>
        )}
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {c.title?.text}
        </h2>
        {c.subtitle?.text && (
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-10">
            {c.subtitle.text}
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{(c.comparison?.left as any)?.icon}</span>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {(c.comparison?.left as any)?.title}
              </h3>
            </div>
            <ul className="space-y-2">
              {((c.comparison?.left as any)?.items ?? []).map((item: any, i: number) => (
                <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-950/20 dark:to-purple-950/20 border-2 border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{(c.comparison?.right as any)?.icon}</span>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {(c.comparison?.right as any)?.title}
              </h3>
            </div>
            <ul className="space-y-2">
              {((c.comparison?.right as any)?.items ?? []).map((item: any, i: number) => (
                <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {c.summary && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-primary-500/10 to-purple-500/10 border border-primary-200 dark:border-primary-800">
            <span className="mr-2">{c.summary.icon}</span>
            <strong className="text-gray-900 dark:text-white">{c.summary.title}</strong>
            <p className="mt-2 text-gray-700 dark:text-gray-300">{c.summary.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionStepByStep({ section }: { section: Section }) {
  if (section.type !== 'step-by-step' || !section.content) return null;
  const c = section.content as {
    badge?: { text: string };
    title?: { text: string };
    subtitle?: { text: string };
    steps?: Array<{
      number: string;
      icon: string;
      title: string;
      description: string;
      color?: string;
      warning?: { text: string; icon: string };
    }>;
    completion?: { icon: string; text: string };
  };
  return (
    <section className="py-16 px-4 bg-white dark:bg-gray-900">
      <div className="max-w-3xl mx-auto">
        {c.badge?.text && (
          <span className="inline-block px-3 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium mb-4">
            {c.badge.text}
          </span>
        )}
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {c.title?.text}
        </h2>
        {c.subtitle?.text && (
          <p className="text-xl bg-gradient-to-r from-primary-500 to-purple-500 bg-clip-text text-transparent font-medium mb-10">
            {c.subtitle.text}
          </p>
        )}
        <div className="space-y-6">
          {(c.steps ?? []).map((step, i) => (
            <div
              key={i}
              className="flex gap-4 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold">
                {step.number}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{step.icon}</span>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {step.title}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {step.description}
                </p>
                {step.warning && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                    <span>{step.warning.icon}</span>
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      {step.warning.text}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {c.completion && (
          <div className="mt-10 p-6 rounded-2xl bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 text-center">
            <span className="text-3xl block mb-2">{c.completion.icon}</span>
            <p className="text-lg font-semibold text-green-800 dark:text-green-200">
              {c.completion.text}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionWalletCards({ section }: { section: Section }) {
  if (section.type !== 'wallet-cards' || !section.content) return null;
  const c = section.content as {
    badge?: { text: string };
    title?: { text: string };
    subtitle?: { text: string };
    wallets?: Array<{
      id: string;
      name: string;
      tagline: string;
      description: string;
      icon: string;
      iconImage?: string;
      iconUrl?: string;
      color?: string;
      platforms?: string[];
      url: string;
      features: string[];
      difficulty: string;
      recommended?: boolean;
    }>;
    warning?: { icon: string; title: string; text: string };
  };
  return (
    <section
      className="py-16 px-4"
      style={{ background: 'linear-gradient(180deg, #fff 0%, #f8f9ff 100%)' }}
    >
      <div className="max-w-5xl mx-auto">
        {c.badge?.text && (
          <span className="inline-block px-3 py-1 rounded-lg bg-gradient-to-r from-primary-500/20 to-purple-500/20 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
            {c.badge.text}
          </span>
        )}
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {c.title?.text}
        </h2>
        {c.subtitle?.text && (
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-10">
            {c.subtitle.text}
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          {(c.wallets ?? []).map((w) => (
            <a
              key={w.id}
              href={w.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 transition-all hover:shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <WalletIcon w={w} />
                {w.recommended && (
                  <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                    Recommandé
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {w.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {w.tagline}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                {w.description}
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {(w.platforms ?? []).map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Difficulté : {w.difficulty}
              </p>
            </a>
          ))}
        </div>
        {c.warning && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <span className="mr-2">{c.warning.icon}</span>
            <strong className="text-amber-800 dark:text-amber-200">{c.warning.title}</strong>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{c.warning.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionSecurityRules({ section }: { section: Section }) {
  if (section.type !== 'security-rules' || !section.content) return null;
  const c = section.content as {
    badge?: { text: string };
    title?: { text: string };
    subtitle?: { text: string };
    rules?: Array<{
      number: string;
      icon: string;
      title: string;
      description: string;
      severity?: string;
      color?: string;
    }>;
    bonus?: { icon: string; title: string; text: string };
  };
  return (
    <section
      className="py-16 px-4"
      style={{
        background: 'linear-gradient(180deg, #fef3c7 0%, #fef3c7 50%, #fff 100%)',
      }}
    >
      <div className="max-w-3xl mx-auto">
        {c.badge?.text && (
          <span className="inline-block px-3 py-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm font-medium mb-4">
            {c.badge.text}
          </span>
        )}
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {c.title?.text}
        </h2>
        {c.subtitle?.text && (
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-10">
            {c.subtitle.text}
          </p>
        )}
        <div className="space-y-4 mb-10">
          {(c.rules ?? []).map((rule, i) => (
            <div
              key={i}
              className="p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                  {rule.number}
                </span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{rule.icon}</span>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {rule.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {rule.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {c.bonus && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800">
            <span className="mr-2">{c.bonus.icon}</span>
            <strong className="text-gray-900 dark:text-white">{c.bonus.title}</strong>
            <p className="mt-2 text-gray-700 dark:text-gray-300">{c.bonus.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionPhilosophy({ section }: { section: Section }) {
  if (section.type !== 'philosophy' || !section.content) return null;
  const c = section.content as {
    badge?: { text: string };
    title?: { text: string };
    subtitle?: { text: string };
    features?: Array<{ icon: string; title: string; description: string }>;
    principles?: { title: string; items: Array<{ icon: string; title: string; description: string }> };
    conclusion?: { text: string };
  };
  return (
    <section
      className="py-20 px-4 text-white relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div className="max-w-4xl mx-auto relative z-10">
        {c.badge?.text && (
          <span className="inline-block px-3 py-1 rounded-lg bg-white/20 backdrop-blur text-white text-sm font-medium mb-4">
            {c.badge.text}
          </span>
        )}
        <h2 className="text-3xl font-bold mb-4">{c.title?.text}</h2>
        {c.subtitle?.text && (
          <p className="text-lg text-white/90 mb-10">{c.subtitle.text}</p>
        )}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {(c.features ?? []).map((f, i) => (
            <div key={i} className="text-center">
              <span className="text-3xl block mb-2">{f.icon}</span>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-white/80">{f.description}</p>
            </div>
          ))}
        </div>
        {c.principles && (
          <div className="mb-10">
            <h3 className="text-xl font-semibold mb-4">{c.principles.title}</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {c.principles.items.map((item, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/10 backdrop-blur">
                  <span className="text-2xl block mb-2">{item.icon}</span>
                  <h4 className="font-semibold mb-1">{item.title}</h4>
                  <p className="text-sm text-white/80">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {c.conclusion?.text && (
          <p className="text-lg text-center text-white/95 font-medium max-w-2xl mx-auto">
            {c.conclusion.text}
          </p>
        )}
      </div>
    </section>
  );
}

function SectionFinalCta({ section }: { section: Section }) {
  if (section.type !== 'final-cta' || !section.content) return null;
  const c = section.content as {
    icon?: string;
    title?: { text: string };
    subtitle?: { text: string };
    description?: { text: string };
    cta?: {
      primary?: { text: string; icon: string; url: string; style: string };
      secondary?: { text: string; icon: string; url: string; style: string };
    };
    helpLinks?: { title: string; links: Array<{ text: string; icon: string; url: string }> };
  };
  return (
    <section className="py-20 px-4 bg-white dark:bg-gray-900">
      <div className="max-w-2xl mx-auto text-center">
        {c.icon && <span className="text-5xl block mb-4">{c.icon}</span>}
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {c.title?.text}
        </h2>
        {c.subtitle?.text && (
          <p className="text-2xl bg-gradient-to-r from-primary-500 to-purple-500 bg-clip-text text-transparent font-semibold mb-4">
            {c.subtitle.text}
          </p>
        )}
        {c.description?.text && (
          <p className="text-gray-600 dark:text-gray-400 mb-8">{c.description.text}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          {c.cta?.primary && (
            <Link
              href={c.cta.primary.url}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary-500 to-purple-500 text-white font-bold text-lg hover:opacity-90 transition-opacity"
            >
              <span>{c.cta.primary.icon}</span>
              {c.cta.primary.text}
            </Link>
          )}
        </div>
        {c.helpLinks && (
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              {c.helpLinks.title}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {c.helpLinks.links
                .filter((link) => !link.url.toLowerCase().includes('discord'))
                .map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <span>{link.icon}</span>
                    {link.text}
                  </a>
                ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function RenderSection({ section }: { section: Section }) {
  switch (section.type) {
    case 'hero':
      return <SectionHero section={section} />;
    case 'content-with-visual':
      return <SectionContentWithVisual section={section} />;
    case 'feature-comparison':
      return <SectionFeatureComparison section={section} />;
    case 'step-by-step':
      return <SectionStepByStep section={section} />;
    case 'wallet-cards':
      return <SectionWalletCards section={section} />;
    case 'security-rules':
      return <SectionSecurityRules section={section} />;
    case 'philosophy':
      return <SectionPhilosophy section={section} />;
    case 'final-cta':
      return <SectionFinalCta section={section} />;
    default:
      return null;
  }
}

export default function PremiereEtapePage() {
  const { i18n } = useTranslation();
  // Use fixed 'fr' until mount to avoid hydration mismatch (server vs client language)
  const [lang, setLang] = useState<string>('fr');

  useEffect(() => {
    setLang((i18n.language || 'fr').split('-')[0]);
  }, [i18n.language]);

  const guideData = guideByLang[lang] || guideFr;

  useEffect(() => {
    if (guideData.title) document.title = `${guideData.title} | Confidance`;
  }, [guideData.title]);

  return (
    <div className="min-h-screen">
      {guideData.sections.map((section) => (
        <RenderSection key={section.id} section={section} />
      ))}
    </div>
  );
}
