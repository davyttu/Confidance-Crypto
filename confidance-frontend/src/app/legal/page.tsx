'use client';

import { Shield, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-bold">Legal Notice & Terms of Use</h1>
          </div>
          <p className="text-blue-100 text-lg">
            Confidance Protocol - Non-Custodial Web3 Payment Infrastructure
          </p>
          <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-lg inline-block">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Last updated: January 2025</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Key Principle Banner */}
        <div className="mb-12 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Core Principle</h3>
              <p className="text-gray-700 text-lg italic leading-relaxed">
                "Because payments shouldn't depend on trust. They should depend on code."
              </p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {/* Section 1 */}
          <Section
            number="1"
            title="Nature of the Protocol"
            icon={<CheckCircle2 className="w-5 h-5" />}
          >
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Confidance</strong> is a non-custodial Web3 software protocol providing a programmable payment interface operating on public blockchains.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance is designed as a <strong>payment execution infrastructure</strong>, not as a financial institution.
            </p>

            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-4">
              <p className="font-semibold text-red-900 mb-2">Confidance does NOT:</p>
              <ul className="space-y-2 text-red-800">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <span>act as a bank, payment institution, or payroll provider,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <span>custody or hold user funds,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <span>manage private keys or wallets,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <span>initiate transactions without prior user authorization.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              All payment logic is enforced on-chain through smart contracts deployed on supported blockchain networks.
            </p>
          </Section>

          {/* Section 2 */}
          <Section number="2" title="Non-Custodial Architecture">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance operates under a <strong>non-custodial model</strong>.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              At no time does Confidance take ownership, possession, or discretionary control over user assets.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-blue-900 mb-2">User funds:</p>
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">✓</span>
                  <span>remain in user-controlled wallets or smart contracts,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">✓</span>
                  <span>are governed exclusively by on-chain logic,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">✓</span>
                  <span>can only be moved according to parameters defined and authorized by the user.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Confidance cannot access private keys, modify wallet balances, or redirect funds for its own benefit.
            </p>
          </Section>

          {/* Section 3 */}
          <Section number="3" title="Programmable & Scheduled Payments">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance allows users to create programmable and scheduled payments using smart contracts.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              By configuring a payment, users <strong>explicitly authorize</strong> future blockchain transactions under predefined conditions.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-amber-900 mb-2">These payments:</p>
              <ul className="space-y-2 text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="mt-1">⚠️</span>
                  <span>are executed automatically on-chain,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">⚠️</span>
                  <span>require sufficient wallet balance at execution time,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">⚠️</span>
                  <span>may be irreversible once triggered.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              If a payment is configured as <strong>non-cancelable</strong>, the user acknowledges that it cannot be stopped once execution conditions are met.
            </p>
          </Section>

          {/* Section 4 */}
          <Section number="4" title="Wallet Approvals & Authorizations">
            <p className="text-gray-700 leading-relaxed mb-4">
              Certain operations require wallet approvals (e.g. "Approve" transactions).
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              An approval authorizes a smart contract to perform predefined actions strictly within the scope of the authorized parameters.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-gray-900 mb-2">Users acknowledge that:</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-1">→</span>
                  <span>approvals are granted via their wallet interface (such as MetaMask),</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-1">→</span>
                  <span>approvals may enable automated future transactions,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-1">→</span>
                  <span>approvals can generally be revoked directly through the wallet or blockchain tools.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Confidance does not manage or control wallet approvals on behalf of users.
            </p>
          </Section>

          {/* Section 5 */}
          <Section number="5" title="Emergency Execution & Protocol Safeguards">
            <p className="text-gray-700 leading-relaxed mb-4">
              To ensure protocol reliability and protect users against internal execution failures (including keeper downtime), certain Confidance smart contracts include a <strong>restricted emergency execution mechanism</strong>.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              This mechanism allows a Confidance administrator to manually trigger the execution of a payment already created and authorized by the user, strictly in accordance with the original on-chain configuration.
            </p>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-green-900 mb-2">This emergency execution function:</p>
              <ul className="space-y-2 text-green-800">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>does not grant access to user wallets or private keys,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>does not allow modification of payment amounts, recipients, or execution conditions,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>does not permit cancellation, redirection, or appropriation of funds,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>exists solely to ensure execution continuity when automated infrastructure is temporarily unavailable.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Funds remain governed entirely by the immutable logic of the smart contract defined at payment creation.
            </p>
          </Section>

          {/* Section 6 */}
          <Section number="6" title="Fees">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-gray-900 mb-2">Users are responsible for:</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>blockchain transaction fees ("gas"),</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>protocol fees applied only to programmable payments.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed mb-4">
              Protocol fees are used solely to operate, maintain, and secure the multi-chain execution infrastructure.
            </p>

            <p className="text-gray-700 leading-relaxed">
              Confidance does not charge custody, deposit, or holding fees.
            </p>
          </Section>

          {/* Section 7 */}
          <Section number="7" title="No Financial, Custodial, or Payroll Services">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-4">
              <p className="font-semibold text-red-900 mb-2">Confidance is NOT:</p>
              <ul className="space-y-2 text-red-800">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>a financial service provider,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>a payroll company,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>a fiduciary or trustee,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>a guarantor of payment execution.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Confidance is a <strong>programmable payment engine</strong> that may be used by individuals or third-party platforms, including payroll or financial service providers.
            </p>
          </Section>

          {/* Section 8 */}
          <Section number="8" title="User Responsibility & Regulatory Compliance">
            <p className="text-gray-700 leading-relaxed mb-4">
              Users are <strong>solely responsible</strong> for:
            </p>

            <ul className="space-y-3 text-gray-700 mb-4">
              <li className="flex items-start gap-3 pl-4">
                <span className="text-blue-500 mt-1">▸</span>
                <span>determining whether their usage constitutes professional, commercial, or regulated activity,</span>
              </li>
              <li className="flex items-start gap-3 pl-4">
                <span className="text-blue-500 mt-1">▸</span>
                <span>complying with applicable laws and regulations in their jurisdiction,</span>
              </li>
              <li className="flex items-start gap-3 pl-4">
                <span className="text-blue-500 mt-1">▸</span>
                <span>fulfilling tax, accounting, and reporting obligations.</span>
              </li>
            </ul>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-900 text-sm">
                Professional or business accounts may be subject to business information verification to ensure legitimate commercial usage.
                Requirements may vary depending on jurisdiction.
              </p>
            </div>
          </Section>

          {/* Section 9 */}
          <Section number="9" title="No Guarantee of Execution">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance <strong>does not guarantee</strong> the successful execution of any payment.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-amber-900 mb-2">Execution depends on:</p>
              <ul className="space-y-2 text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="mt-1">⚠️</span>
                  <span>sufficient wallet balance,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">⚠️</span>
                  <span>blockchain network conditions,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">⚠️</span>
                  <span>smart contract execution without error,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">⚠️</span>
                  <span>availability of blockchain infrastructure.</span>
                </li>
              </ul>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Confidance shall not be held responsible for delayed, failed, or incomplete transactions resulting from blockchain conditions or insufficient funds.
            </p>
          </Section>

          {/* Section 10 */}
          <Section number="10" title="Support & Technical Assistance">
            <p className="text-gray-700 leading-relaxed mb-4">
              Confidance provides <strong>technical assistance only</strong>.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-semibold text-green-900 mb-2">Support CAN:</p>
                <ul className="space-y-2 text-green-800 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>help diagnose issues,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>explain transaction states or wallet interactions,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>assist users in understanding blockchain confirmations.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-semibold text-red-900 mb-2">Support CANNOT:</p>
                <ul className="space-y-2 text-red-800 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>reverse transactions,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>modify on-chain payment parameters,</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>intervene in blockchain execution beyond the emergency execution mechanism described above.</span>
                  </li>
                </ul>
              </div>
            </div>
          </Section>

          {/* Section 11 */}
          <Section number="11" title="Limitation of Liability">
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
              <p className="text-gray-700 leading-relaxed">
                To the maximum extent permitted by applicable law, Confidance shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from:
              </p>
              <ul className="mt-4 space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <span>your access to or use of or inability to access or use the protocol,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <span>any conduct or content of any third party on the protocol,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <span>any content obtained from the protocol,</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">•</span>
                  <span>unauthorized access, use, or alteration of your transmissions or content.</span>
                </li>
              </ul>
            </div>
          </Section>
        </div>

        {/* Footer Banner */}
        <div className="mt-16 p-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h3 className="text-2xl font-bold mb-2">Questions about these terms?</h3>
          <p className="text-blue-100 mb-6">
            Contact us at{' '}
            <a href="mailto:contact@confidance-defi.com" className="underline font-semibold hover:text-white">
              contact@confidance-defi.com
            </a>
          </p>
          <p className="text-sm text-blue-200">
            Confidance-defi • Non-Custodial Payment Infrastructure • Est. 2025
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
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {number}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {title}
            {icon && <span className="text-blue-600">{icon}</span>}
          </h2>
        </div>
      </div>
      <div className="pl-16">
        {children}
      </div>
    </section>
  );
}
