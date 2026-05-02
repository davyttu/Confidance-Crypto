import type { PublicClient, Address } from 'viem';
import { paymentFactoryAbi } from '@/lib/contracts/paymentFactoryAbi';

/**
 * Frais + totaux récurrents alignés sur la factory (`previewFeePerMonth` = même logique que `_feeBpsFor`).
 * Retourne null si la factory ne supporte pas l’appel (fallback UI / approve via bps Confidance).
 */
export async function fetchRecurringFeeTotalsFromFactory(
  publicClient: PublicClient,
  factoryAddress: Address,
  payerAddress: Address,
  monthlyAmount: bigint,
  totalMonths: number,
  firstMonthAmount?: bigint
): Promise<{ monthlyFee: bigint; totalPerMonth: bigint; totalRequired: bigint } | null> {
  try {
    const monthlyFee = (await publicClient.readContract({
      address: factoryAddress,
      abi: paymentFactoryAbi,
      functionName: 'previewFeePerMonth',
      args: [monthlyAmount, payerAddress],
    })) as bigint;

    const totalPerMonth = monthlyAmount + monthlyFee;

    let totalRequired: bigint;
    if (firstMonthAmount !== undefined && firstMonthAmount > BigInt(0)) {
      const firstFee = (await publicClient.readContract({
        address: factoryAddress,
        abi: paymentFactoryAbi,
        functionName: 'previewFeePerMonth',
        args: [firstMonthAmount, payerAddress],
      })) as bigint;
      const firstTotal = firstMonthAmount + firstFee;
      const remainingMonths = totalMonths > 1 ? totalMonths - 1 : 0;
      totalRequired = firstTotal + totalPerMonth * BigInt(remainingMonths);
    } else {
      totalRequired = totalPerMonth * BigInt(totalMonths);
    }

    return { monthlyFee, totalPerMonth, totalRequired };
  } catch (e) {
    console.warn('[recurringFeePreview] previewFeePerMonth indisponible, fallback bps app', e);
    return null;
  }
}
