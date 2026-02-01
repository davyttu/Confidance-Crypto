// src/components/layout/Footer.tsx
'use client';

import Link from 'next/link';
import { Github, Twitter, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

const FOOTER_FALLBACKS = {
  description: "Because payments shouldn't depend on trust. They should depend on code.",
  product: 'Product',
  resources: 'Resources',
  legal: 'Legal',
  firstStep: 'First step',
  secondStep: 'Second step',
  documentation: 'Documentation',
  terms: 'Legal notice',
  privacy: 'Privacy',
  paymentCreate: 'Create payment',
  copyright: '© {{year}} Confidance Crypto. All rights reserved.',
  madeWith: 'Made with',
  forDeFi: 'for DeFi',
} as const;

export function Footer() {
  const { t, ready } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [text, setText] = useState(FOOTER_FALLBACKS);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !ready) return;
    setText({
      description: t('footer.description'),
      product: t('footer.product'),
      resources: t('footer.resources'),
      legal: t('footer.legal'),
      firstStep: t('footer.firstStep'),
      secondStep: t('footer.secondStep'),
      documentation: t('footer.documentation'),
      terms: t('footer.terms'),
      privacy: t('footer.privacy'),
      paymentCreate: t('payment.create'),
      copyright: t('footer.copyright', { year: currentYear }),
      madeWith: t('footer.madeWith'),
      forDeFi: t('footer.forDeFi'),
    });
  }, [isMounted, ready, t, currentYear]);

  const links = {
    product: [
      { label: text.firstStep, href: '/premiere-etape' },
      { label: text.paymentCreate, href: '/payment' },
      { label: text.documentation, href: '/docs' },
    ],
    resources: [
      { label: text.secondStep, href: '/second-step' },
      { label: 'Base Mainnet', href: 'https://base.org', external: true },
      { label: 'Basescan', href: 'https://basescan.org', external: true, logo: '/basescan-logo.png' },
    ],
    legal: [
      { label: text.terms, href: '/legal' },
      { label: text.privacy, href: '/privacy' },
    ],
  };

  const socials = [
    { icon: Github, href: 'https://github.com', label: 'GitHub' },
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Send, href: 'https://t.me', label: 'Telegram' },
  ];

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50 backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                <span className="text-white font-bold text-xl">C</span>
              </div>
              <span className="font-bold text-xl gradient-text">Confidance</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
              {text.description}
            </p>
            <div className="flex items-center gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 glass rounded-lg flex items-center justify-center hover:scale-110 transition-all hover:shadow-lg hover:shadow-primary-500/20"
                  aria-label={social.label}
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{text.product}</h3>
            <ul className="space-y-3">
              {links.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{text.resources}</h3>
            <ul className="space-y-3">
              {links.resources.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{text.legal}</h3>
            <ul className="space-y-3">
              {links.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {text.copyright.replace('{{year}}', String(currentYear))}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{text.madeWith}</span>
            <span className="text-red-500 animate-pulse">❤️</span>
            <span className="text-xs text-gray-500">{text.forDeFi}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}