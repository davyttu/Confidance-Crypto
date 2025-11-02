import Link from 'next/link';
import { EnvelopeIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/aide" className="text-blue-600 hover:text-blue-700 mb-8 inline-block">
          Retour au centre d aide
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Contacter le Support
        </h1>
        <p className="text-gray-600 mb-12">
          Notre equipe est la pour vous aider
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <EnvelopeIcon className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Email</h2>
            <p className="text-gray-600 mb-4">Reponse sous 24h en moyenne</p>
            <p className="text-blue-600 font-medium">support@confidance.crypto</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <ChatBubbleLeftIcon className="w-7 h-7 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Discord</h2>
            <p className="text-gray-600 mb-4">Rejoignez la communaute</p>
            <p className="text-purple-600 font-medium">Bientot disponible</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Formulaire de contact</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Votre email</label>
              <input type="email" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none" placeholder="votre@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sujet</label>
              <input type="text" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none" placeholder="Sujet de votre demande" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea rows={6} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none" placeholder="Votre message..." />
            </div>
            <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
              Envoyer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}