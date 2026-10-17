'use client';

import type { ReactNode } from 'react';

const STEP_GRADIENT = 'from-[#0052FF] to-[#00D4FF]';

interface PaymentStepCardProps {
  step: number;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  titleExtra?: ReactNode;
  rightSlot?: ReactNode;
}

/** Shared payment-form step shell: blue accent bar + numbered bold title. */
export default function PaymentStepCard({
  step,
  title,
  children,
  className = '',
  titleExtra,
  rightSlot,
}: PaymentStepCardProps) {
  return (
    <div className={`glass rounded-2xl p-6 relative overflow-hidden ${className}`}>
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${STEP_GRADIENT} opacity-80`}
      />
      <div className="pl-1 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold text-sm bg-gradient-to-br ${STEP_GRADIENT} shadow-md flex-shrink-0`}
            >
              {step}
            </span>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight flex items-center gap-2 min-w-0">
              {title}
              {titleExtra}
            </h3>
          </div>
          {rightSlot}
        </div>
        {children}
      </div>
    </div>
  );
}
