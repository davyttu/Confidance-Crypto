'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  QuestionMarkCircleIcon, 
  XMarkIcon,
  RocketLaunchIcon,
  BookOpenIcon,
  VideoCameraIcon,
  ChatBubbleLeftIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

export function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const helpLinks = [
    {
      icon: RocketLaunchIcon,
      label: 'Débuter avec Confidance',
      href: '/aide/debuter',
      description: 'Guide pour nouveaux utilisateurs'
    },
    {
      icon: BookOpenIcon,
      label: 'Guides pratiques',
      href: '/aide/guides',
      description: 'Tutoriels pas-à-pas'
    },
    {
      icon: QuestionMarkCircleIcon,
      label: 'Questions fréquentes',
      href: '/aide/faq',
      description: 'FAQ complète'
    },
    {
      icon: VideoCameraIcon,
      label: 'Tutoriels vidéo',
      href: '/aide/videos',
      description: 'Apprenez en vidéo'
    },
  ];

  const supportLinks = [
    {
      icon: ChatBubbleLeftIcon,
      label: 'Contacter le support',
      href: '/aide/contact',
    },
    {
      icon: DocumentTextIcon,
      label: 'Documentation complète',
      href: '/aide',
    },
  ];

  if (!isVisible) return null;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {isOpen && (
          <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slideUp">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
              <h3 className="font-semibold text-lg">💬 Besoin d'aide ?</h3>
              <p className="text-sm text-white/80 mt-1">
                Trouvez rapidement les réponses à vos questions
              </p>
            </div>

            <div className="p-3">
              <div className="space-y-1">
                {helpLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <link.icon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm group-hover:text-blue-600">
                        {link.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {link.description}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="my-3 border-t border-gray-200" />

              <div className="space-y-1">
                {supportLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700 hover:text-blue-600"
                  >
                    <link.icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-3 text-center border-t border-gray-200">
              <Link
                href="/aide"
                onClick={() => setIsOpen(false)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Ouvrir le centre d'aide complet
                <span className="text-lg">→</span>
              </Link>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-16 h-16 rounded-full
            bg-gradient-to-br from-blue-600 to-purple-600
            text-white shadow-lg hover:shadow-xl
            transform hover:scale-105 active:scale-95
            transition-all duration-200
            flex items-center justify-center
            ${isOpen ? 'rotate-90' : ''}
          `}
        >
          {isOpen ? (
            <XMarkIcon className="w-7 h-7" />
          ) : (
            <div className="flex flex-col items-center">
              <QuestionMarkCircleIcon className="w-7 h-7" />
              <span className="text-xs mt-0.5 font-medium">Aide</span>
            </div>
          )}
        </button>
      </div>
    </>
  );
}