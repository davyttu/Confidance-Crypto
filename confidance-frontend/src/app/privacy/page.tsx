'use client';

import { Lock, Eye, EyeOff, Database, Shield, CheckCircle2, XCircle } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
          </div>
          <p className="text-purple-100 text-lg">
            Confidance Protocol - Minimizing Data Collection
          </p>
          <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-lg inline-block">
            <Eye className="w-4 h-4" />
            <span className="text-sm">Last updated: January 2025</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Key Principle Banner */}
        <div className="mb-12 p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Privacy-First Protocol</h3>
              <p className="text-gray-700 text-lg leading-relaxed">
                Confidance is committed to <strong>protecting user privacy</strong> and <strong>minimizing data collection</strong>. Most interactions occur directly on public blockchains without requiring personal information.
              </p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {/* Section 1 */}
          <Section number="1" title="Introduction">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance is committed to protecting user privacy and minimizing data collection.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance is designed as a <strong>non-custodial Web3 protocol</strong>, where most interactions occur directly on public blockchains without requiring personal information.
            </p>
            <p className="text-gray-700 leading-relaxed">
              This Privacy Policy explains what data may be collected, how it is used, and what data Confidance does not collect.
            </p>
          </Section>

          {/* Section 2 */}
          <Section
            number="2"
            title="Data We Do NOT Collect"
            icon={<EyeOff className="w-5 h-5" />}
          >
            <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-r-lg">
              <p className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Confidance does NOT collect or store:
              </p>
              <ul className="space-y-3 text-green-800">
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1 text-xl">✓</span>
                  <span><strong>private keys</strong>, seed phrases, or wallet credentials,</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1 text-xl">✓</span>
                  <span><strong>passwords</strong> linked to blockchain wallets,</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1 text-xl">✓</span>
                  <span><strong>bank account or payment card</strong> information,</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1 text-xl">✓</span>
                  <span><strong>personal identity documents</strong>, except where explicitly required by law,</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1 text-xl">✓</span>
                  <span><strong>custody or balance data</strong> from user wallets.</span>
                </li>
              </ul>
              <p className="mt-6 text-green-900 font-semibold bg-green-100 p-3 rounded-lg">
                🔒 Confidance cannot access or control user wallets.
              </p>
            </div>
          </Section>

          {/* Section 3 */}
          <Section number="3" title="Blockchain Data">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
              <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Blockchain transactions are inherently public.
              </p>
            </div>

            <p className="text-gray-700 leading-relaxed mb-4">
              When users interact with Confidance, the following information may be visible on public blockchains:
            </p>

            <ul className="space-y-2 text-gray-700 mb-4 pl-6">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>wallet addresses,</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>transaction hashes,</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>smart contract interactions.</span>
              </li>
            </ul>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-900 text-sm">
                ⚠️ Confidance does not control, modify, or anonymize blockchain data and cannot remove information from public ledgers.
              </p>
            </div>
          </Section>

          {/* Section 4 */}
          <Section number="4" title="Data We May Collect">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance may collect <strong>limited off-chain data</strong> necessary to operate and improve the protocol, including:
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-4">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 mt-1">▸</span>
                  <span>wallet addresses connected to the interface,</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 mt-1">▸</span>
                  <span>technical metadata (browser type, device type, approximate location),</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 mt-1">▸</span>
                  <span>usage analytics related to protocol interactions,</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 mt-1">▸</span>
                  <span>support communications submitted voluntarily by users.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              This data is used solely for <strong>technical operation, security, analytics, and user support</strong>.
            </p>
          </Section>

          {/* Section 5 */}
          <Section number="5" title="Professional Accounts & Business Information">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance offers professional accounts intended for legitimate commercial or organizational use.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
              <p className="font-semibold text-blue-900 mb-3">To access a professional account, users may be required to provide business-related information, including:</p>
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  <span>company or organization name,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  <span>professional website or online presence,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  <span>professional email address,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  <span>business identification number,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  <span>registration with a commercial or corporate registry.</span>
                </li>
              </ul>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 mb-4">
              <p className="font-semibold text-purple-900 mb-3">This information is collected exclusively to:</p>
              <ul className="space-y-2 text-purple-800">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">✓</span>
                  <span>assess legitimate professional usage,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">✓</span>
                  <span>prevent misuse of the protocol,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">✓</span>
                  <span>comply with operational or regulatory requirements where applicable.</span>
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-amber-900 text-sm">
                ⚠️ Failure to provide the required information may result in refusal or limitation of professional account access.
              </p>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Confidance does not perform personal identity verification unless explicitly required by applicable law.
            </p>
          </Section>

          {/* Section 6 */}
          <Section number="6" title="Cookies & Analytics">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance may use cookies or similar technologies to:
            </p>

            <ul className="space-y-2 text-gray-700 mb-4 pl-6">
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-1">•</span>
                <span>ensure platform functionality,</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-1">•</span>
                <span>maintain session state,</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-1">•</span>
                <span>analyze platform usage and performance.</span>
              </li>
            </ul>

            <p className="text-gray-700 leading-relaxed">
              Users may disable cookies in their browser settings, which may affect certain features.
            </p>
          </Section>

          {/* Section 7 */}
          <Section number="7" title="Data Sharing">
            <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-r-lg mb-4">
              <p className="font-semibold text-red-900 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Confidance does NOT sell user data.
              </p>
            </div>

            <p className="text-gray-700 leading-relaxed mb-4">
              Data may be shared only:
            </p>

            <ul className="space-y-3 text-gray-700 pl-6">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>with trusted service providers necessary for platform operation (such as hosting or analytics providers),</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>when required by law, regulation, or legal process,</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>to protect the security and integrity of the protocol.</span>
              </li>
            </ul>
          </Section>

          {/* Section 8 */}
          <Section number="8" title="Data Security">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance applies <strong>reasonable technical and organizational safeguards</strong> to protect collected data.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
              <p className="font-semibold text-amber-900 mb-3">However, users acknowledge that:</p>
              <ul className="space-y-2 text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">⚠️</span>
                  <span>no system is entirely secure,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">⚠️</span>
                  <span>blockchain usage involves inherent risks,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">⚠️</span>
                  <span>users remain responsible for securing their wallets and devices.</span>
                </li>
              </ul>
            </div>
          </Section>

          {/* Section 9 */}
          <Section number="9" title="User Rights">
            <p className="text-gray-700 leading-relaxed mb-4">
              Depending on applicable laws, users may have the right to:
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  <span>access their personal data,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  <span>request correction or deletion,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  <span>object to certain data processing activities.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Requests may be submitted via official support channels listed on the website.
            </p>
          </Section>

          {/* Section 10 */}
          <Section number="10" title="Third-Party Services">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance may integrate or link to third-party services such as wallet providers or blockchain explorers.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-amber-900">
                ⚠️ Confidance is not responsible for the privacy practices of third-party services.
              </p>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Users are encouraged to review external privacy policies independently.
            </p>
          </Section>

          {/* Section 11 */}
          <Section number="11" title="Changes to This Policy">
            <p className="text-gray-700 leading-relaxed mb-4">
              This Privacy Policy may be updated periodically.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Updates will be published on this page with a revised date.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Continued use of Confidance constitutes acceptance of the updated policy.
            </p>
          </Section>

          {/* Section 12 */}
          <Section number="12" title="Contact">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
              <p className="text-gray-700 leading-relaxed mb-4">
                For privacy-related questions, concerns, or data requests, please contact us:
              </p>
              <div className="flex items-center gap-3 text-purple-900">
                <Lock className="w-5 h-5" />
                <a
                  href="mailto:contact@confidance-defi.com"
                  className="font-semibold hover:text-purple-600 transition-colors"
                >
                  contact@confidance-defi.com
                </a>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer Banner */}
        <div className="mt-16 p-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl text-white text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h3 className="text-2xl font-bold mb-2">Your Privacy Matters</h3>
          <p className="text-purple-100 mb-6">
            We are committed to transparency and protecting your data.
          </p>
          <p className="text-sm text-purple-200">
            Confidance-defi • Privacy-First Protocol • Est. 2025
          </p>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  number: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ number, title, icon, children }: SectionProps) {
  return (
    <section className="scroll-mt-8">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {number}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {title}
            {icon && <span className="text-purple-600">{icon}</span>}
          </h2>
        </div>
      </div>
      <div className="pl-16">
        {children}
      </div>
    </section>
  );
}
