'use client';

import { BookOpen, Layers, Calendar, Users, Tag, Activity, AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

export default function DocumentationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-bold">Documentation</h1>
          </div>
          <p className="text-indigo-100 text-lg">
            Understanding Confidance Core Concepts and Terminology
          </p>
          <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-lg inline-block">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Version 1.0 - January 2025</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Vision Banner */}
        <div className="mb-12 p-6 bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Vision Confidance</h3>
              <p className="text-gray-700 text-lg leading-relaxed">
                Confidance is a programmable payment protocol centered on <strong>clarity</strong>, <strong>traceability</strong>, and <strong>explainability</strong> of payments.
              </p>
            </div>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="mb-12 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Table of Contents</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { title: 'Core Concepts', section: '1' },
              { title: 'Payment Types', section: '2' },
              { title: 'Payment Identity', section: '3' },
              { title: 'Payment Status', section: '4' },
              { title: 'Execution', section: '5' },
              { title: 'Timeline', section: '6' },
              { title: 'Categories', section: '7' },
              { title: 'Analytics & Insights', section: '8' },
            ].map((item) => (
              <a
                key={item.section}
                href={`#section-${item.section}`}
                className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
              >
                {item.section}. {item.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {/* Section 1 */}
          <Section
            number="1"
            title="Core Concepts"
            id="section-1"
            icon={<Layers className="w-5 h-5" />}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              A <strong>Payment</strong> is a persistent payment intent, created by a user, that defines what to pay, to whom, when, and according to what rules.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
              <p className="font-semibold text-blue-900 mb-3">Key Distinctions:</p>
              <div className="space-y-3 text-blue-800">
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 mt-1">•</span>
                  <div>
                    <strong>Payment:</strong> persistent and parameterized intent
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 mt-1">•</span>
                  <div>
                    <strong>Execution:</strong> attempt to execute a Payment at a given time
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 mt-1">•</span>
                  <div>
                    <strong>Transaction:</strong> technical operation recorded on the network
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg">
              <p className="text-indigo-900">
                <strong>Persistent Intent:</strong> A Payment exists independently of its release. It can generate zero, one, or multiple Releases depending on its type.
              </p>
            </div>
          </Section>

          {/* Section 2 */}
          <Section
            number="2"
            title="Payment Types"
            id="section-2"
            icon={<Calendar className="w-5 h-5" />}
          >
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">instant</h4>
                </div>
                <p className="text-gray-700">Payment released immediately after creation.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">scheduled</h4>
                </div>
                <p className="text-gray-700">Single payment released at a planned date.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-4 h-4 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">recurring</h4>
                </div>
                <p className="text-gray-700 mb-3">Payment released monthly over a limited duration.</p>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">→</span>
                    <span><strong>Limited duration:</strong> the number of installments is defined at creation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">→</span>
                    <span><strong>Different first installment:</strong> initial amount can differ from subsequent ones</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">→</span>
                    <span><strong>Cancelable anytime:</strong> Payment can be canceled before future release</span>
                  </li>
                </ul>
              </div>
            </div>
          </Section>

          {/* Section 3 */}
          <Section
            number="3"
            title="Payment Identity"
            id="section-3"
            icon={<Tag className="w-5 h-5" />}
          >
            <p className="text-gray-700 leading-relaxed mb-4">
              Every Payment must have a <strong>label</strong> and a <strong>category</strong>. These are mandatory fields that enable AI explanation, classification, and insight generation.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h4 className="font-semibold text-gray-900 mb-2">label</h4>
                <p className="text-gray-700 text-sm">Human-readable name describing the Payment.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h4 className="font-semibold text-gray-900 mb-2">category</h4>
                <p className="text-gray-700 text-sm">Functional category associated with the Payment.</p>
              </div>
            </div>

            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-900 text-sm">
                <strong>Role for AI and Analytics:</strong> These fields allow for explanation, classification, and creation of insights.
              </p>
            </div>
          </Section>

          {/* Section 4 */}
          <Section
            number="4"
            title="Payment Status"
            id="section-4"
            icon={<Activity className="w-5 h-5" />}
          >
            <div className="space-y-4">
              {[
                { status: 'draft', color: 'gray', desc: 'Payment created but not activated, no Execution possible' },
                { status: 'active', color: 'green', desc: 'Payment is active, Executions can be generated according to rules' },
                { status: 'paused', color: 'yellow', desc: 'Payment temporarily suspended, no Execution should be triggered' },
                { status: 'cancelled', color: 'red', desc: 'Payment definitively canceled, no future Execution' },
                { status: 'completed', color: 'blue', desc: 'Payment finished (all planned Executions have occurred)' },
              ].map((item) => (
                <div key={item.status} className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-lg">
                  <div className={`w-3 h-3 rounded-full bg-${item.color}-500 mt-1.5`}></div>
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900">{item.status}</span>
                    <p className="text-gray-700 text-sm mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Section 5 */}
          <Section
            number="5"
            title="Execution"
            id="section-5"
            icon={<CheckCircle2 className="w-5 h-5" />}
          >
            <p className="text-gray-700 leading-relaxed mb-4">
              A <strong>Release</strong> is the application of a Payment at a given date (in the dashboard this is always shown as &quot;Released&quot;). A Release is always linked to a single Payment.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-3">Release Status:</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <strong className="text-gray-900">success:</strong>
                    <span className="text-gray-700 ml-2">release succeeded (shown as &quot;Released&quot; in the dashboard)</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <strong className="text-gray-900">failed:</strong>
                    <span className="text-gray-700 ml-2">release failed</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <strong className="text-gray-900">pending:</strong>
                    <span className="text-gray-700 ml-2">release awaiting finalization</span>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 6 */}
          <Section
            number="6"
            title="Timeline"
            id="section-6"
            icon={<Activity className="w-5 h-5" />}
          >
            <p className="text-gray-700 leading-relaxed mb-4">
              The <strong>Timeline</strong> is the explanatory history of a Payment's events. It ensures traceability and justification for every change.
            </p>

            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-5 rounded-r-lg mb-6">
              <p className="font-semibold text-indigo-900 mb-2">Core Rule:</p>
              <p className="text-indigo-800">Every status change or release of a Payment must create an event in the Timeline.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="font-semibold text-gray-900 mb-3">Official Event Types:</p>
              <div className="grid md:grid-cols-2 gap-2">
                {[
                  'payment_created',
                  'payment_scheduled',
                  'payment_released',
                  'payment_cancelled',
                  'payment_failed',
                  'payment_completed',
                ].map((event) => (
                  <div key={event} className="text-sm font-mono bg-gray-50 px-3 py-2 rounded">
                    {event}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-900 text-sm">
                <strong>Skip Rule:</strong> A <code className="bg-amber-100 px-1 rounded">last_execution_hash</code> starting with <code className="bg-amber-100 px-1 rounded">skipped_</code> indicates a failed release. This must generate a <code className="bg-amber-100 px-1 rounded">payment_failed</code> event (never <code className="bg-amber-100 px-1 rounded">payment_released</code>).
              </p>
            </div>
          </Section>

          {/* Section 7 */}
          <Section
            number="7"
            title="Payment Categories"
            id="section-7"
            icon={<Tag className="w-5 h-5" />}
          >
            <p className="text-gray-700 leading-relaxed mb-4">
              Official Confidance v1 categories:
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              {[
                { name: 'housing', desc: 'Housing-related payments' },
                { name: 'salary', desc: 'Salary and payroll payments' },
                { name: 'subscription', desc: 'Recurring subscriptions' },
                { name: 'utilities', desc: 'Utilities and services' },
                { name: 'services', desc: 'Professional services' },
                { name: 'transfer', desc: 'General transfers' },
                { name: 'other', desc: 'Uncategorized payments' },
              ].map((cat) => (
                <div key={cat.name} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 font-mono text-sm">{cat.name}</div>
                  <p className="text-gray-600 text-xs mt-1">{cat.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <p className="text-red-900">
                <strong>Semantic Precision:</strong> These categories carry precise business meaning and must not be used as synonyms or approximations.
              </p>
            </div>
          </Section>

          {/* Section 8 */}
          <Section
            number="8"
            title="Analytics & Insights"
            id="section-8"
            icon={<TrendingUp className="w-5 h-5" />}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Participants</h3>
            <div className="mb-6 grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">payer</h4>
                <p className="text-gray-700 text-sm">The account that initiates and funds the Payment.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">beneficiaries</h4>
                <p className="text-gray-700 text-sm">The accounts that receive the payment (supports multi-beneficiary split).</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-3">Monthly Analytics</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Monthly view of payments and releases. The <strong>Timeline is the single source of truth</strong> for analytics. All analytics must be justifiable from Timeline events.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-3">Insights</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <p className="text-blue-900 mb-3">
                An <strong>Insight</strong> is a non-blocking explanatory observation. It does not modify a Payment or its release.
              </p>
              <p className="font-semibold text-blue-900 mb-2">Examples:</p>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>"Your services payments increased this month."</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>"You have canceled several recent payments."</span>
                </li>
              </ul>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Fees</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Gas Fee</h4>
                <p className="text-gray-700 text-sm">Technical fees required for release.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Protocol Fee</h4>
                <p className="text-gray-700 text-sm">Fees applied by Confidance for the service.</p>
              </div>
            </div>
            <p className="text-gray-700 text-sm mt-4">
              Fees must be displayed and tracked separately for transparency.
            </p>
          </Section>

          {/* Fundamental Rules */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <AlertCircle className="w-7 h-7" />
              Fundamental Rules
            </h2>
            <ul className="space-y-3">
              {[
                'A payment is not a transaction',
                'AI never triggers a release alone',
                'Every release is explainable',
                'Every number is justifiable',
                'Every payment is cancelable before release',
              ].map((rule, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-white">{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AI Guidelines */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Users className="w-7 h-7 text-purple-600" />
              Advisory AI
            </h2>
            <div className="space-y-4 text-gray-700">
              <p className="leading-relaxed">
                Confidance AI is <strong>advisory only</strong> and operates in <strong>read-only mode</strong>. The AI does not create or execute payments.
              </p>
              <div className="bg-white border border-purple-200 rounded-lg p-5">
                <p className="font-semibold text-purple-900 mb-3">Principles:</p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">→</span>
                    <span>Every recommendation must be traceable to explicit data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">→</span>
                    <span>Human confirmation is mandatory for all actions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">→</span>
                    <span>Strict operational limits apply</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Versioning */}
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Versioning</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              This document defines the official Confidance vocabulary <strong>version 1.0</strong>.
            </p>
            <div className="bg-gray-50 border-l-4 border-gray-400 p-5 rounded-r-lg">
              <p className="font-semibold text-gray-900 mb-2">Core Principles:</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-1">•</span>
                  <span><strong>We add, we never rename:</strong> Once defined, a term must never be renamed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-1">•</span>
                  <span><strong>Future compatibility:</strong> Future versions must remain compatible with existing definitions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-500 mt-1">•</span>
                  <span><strong>No semantic regression:</strong> No existing definition can change meaning in later versions</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Banner */}
        <div className="mt-16 p-8 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl text-white text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h3 className="text-2xl font-bold mb-2">Need Help Understanding Confidance?</h3>
          <p className="text-indigo-100 mb-6">
            Visit our{' '}
            <a href="/aide" className="underline font-semibold hover:text-white">
              Help Center
            </a>
            {' '}or contact us at{' '}
            <a href="mailto:contact@confidance-defi.com" className="underline font-semibold hover:text-white">
              contact@confidance-defi.com
            </a>
          </p>
          <p className="text-sm text-indigo-200">
            Confidance-defi • Programmable Payment Protocol • Est. 2025
          </p>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  number: string;
  title: string;
  id: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ number, title, id, icon, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-8">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {number}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {title}
            {icon && <span className="text-indigo-600">{icon}</span>}
          </h2>
        </div>
      </div>
      <div className="pl-16">
        {children}
      </div>
    </section>
  );
}
