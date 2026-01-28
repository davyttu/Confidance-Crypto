// src/components/layout/Footer.tsx
'use client';

import Link from 'next/link';
import { Github, Twitter, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export function Footer() {
  const { t, ready } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const links = {
    product: [
      { label: isMounted && ready ? t('footer.firstStep') : 'First step', href: '/premiere-etape' },
      { label: isMounted && ready ? t('payment.create') : 'Créer un paiement', href: '/payment' },
      { label: isMounted && ready ? t('footer.documentation') : 'Documentation', href: '/docs' },
    ],
    resources: [
      { label: 'Base Mainnet', href: 'https://base.org', external: true },
      { label: 'Basescan', href: 'https://basescan.org', external: true },
      { label: isMounted && ready ? t('footer.support') : 'Support', href: '/support' },
    ],
    legal: [
      { label: isMounted && ready ? t('footer.terms') : 'Conditions', href: '/legal' },
      { label: isMounted && ready ? t('footer.privacy') : 'Confidentialité', href: '/privacy' },
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
              {isMounted && ready ? t('footer.description') : 'Paiements programmés décentralisés sur Base Mainnet. Simple, sécurisé, automatique.'}
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
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{isMounted && ready ? t('footer.product') : 'Produit'}</h3>
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
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{isMounted && ready ? t('footer.resources') : 'Ressources'}</h3>
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
            <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{isMounted && ready ? t('footer.legal') : 'Légal'}</h3>
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
            {isMounted && ready ? t('footer.copyright', { year: currentYear }) : `© ${currentYear} Confidance Crypto. Tous droits réservés.`}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Made with</span>
            <span className="text-red-500 animate-pulse">❤️</span>
            <span className="text-xs text-gray-500">for DeFi</span>
          </div>
        </div>
      </div>
    </footer>
  );
}