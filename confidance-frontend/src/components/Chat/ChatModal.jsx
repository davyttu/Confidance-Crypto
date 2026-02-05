// src/components/Chat/ChatModal.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sendToMarilynSafe } from '@/services/marilyn';
import { useAccount } from 'wagmi';
import { truncateAddress } from '@/lib/utils/addressFormatter';

const localeForLanguage = (lang) => {
  const map = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', ru: 'ru-RU', zh: 'zh-CN' };
  const base = (lang || 'fr').split('-')[0];
  return map[base] || map.fr;
};

export default function ChatModal({ isOpen, onClose }) {
  const { t, i18n, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const { address } = useAccount();
  const [initialMessageSet, setInitialMessageSet] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [messages, setMessages] = useState([]);

  // Message initial traduit dès que les traductions sont prêtes (une seule fois)
  useEffect(() => {
    if (!translationsReady || initialMessageSet) return;
    setMessages([{
      role: 'assistant',
      content: t('help.chat.initialMessage'),
      timestamp: Date.now()
    }]);
    setInitialMessageSet(true);
  }, [translationsReady, initialMessageSet, t]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input quand modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Ajouter message utilisateur
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }]);

    setIsLoading(true);

    try {
      // Envoyer à Marilyn
      const result = await sendToMarilynSafe(
        userMessage,
        address || 'anonymous',
        {
          page: window.location.pathname,
          context: {
            wallet_connected: !!address
          }
        }
      );

      // Afficher la réponse de Marilyn
      const defaultSuccess = t('help.chat.success', { defaultValue: "✅ Message received! I'll get back to you very soon." });
      const marilynResponse = result.marilyn_response || result.message || defaultSuccess;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: marilynResponse,
        timestamp: Date.now(),
        eventId: result.eventId || result.event_id,
        responseFrom: result.response_from || 'unknown'
      }]);

    } catch (err) {
      console.error('Erreur chat:', err);
      setError(err.message);
      
      const errorMessage = t('help.chat.error', { message: err.message, defaultValue: `❌ {{message}}. Please try again in a few moments.` });
      
      setMessages(prev => [...prev, {
        role: 'error',
        content: errorMessage,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal : ancré en haut à droite avec max-h pour ne jamais couper le haut */}
      <div className="fixed inset-4 md:inset-auto md:top-4 md:right-4 md:w-[450px] md:h-[650px] md:max-h-[calc(100vh-2rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-2xl">👑</span>
            </div>
            <div>
              <h3 className="font-bold text-white">{t('help.chat.title', { defaultValue: 'Marilyn' })}</h3>
              <p className="text-xs text-blue-100">{t('help.chat.subtitle', { defaultValue: 'Communication Assistant' })}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info wallet */}
        {address && (
          <div className="px-6 py-2 bg-blue-50 dark:bg-blue-950/30 text-sm text-blue-800 dark:text-blue-200 border-b border-blue-100 dark:border-blue-900">
            🔗 {t('help.chat.connected', { defaultValue: 'Connected:' })} {truncateAddress(address)}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.role === 'error'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('help.chat.placeholder', { defaultValue: 'Type your message...' })}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none disabled:opacity-50"
              maxLength={500}
            />
            
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {t('help.chat.footer', { defaultValue: '💬 Your messages are sent to Marilyn who will respond quickly.' })}
          </p>
        </div>
      </div>
    </>
  );
}