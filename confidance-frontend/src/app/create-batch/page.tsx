// src/app/create-batch/page.tsx
import AddBeneficiariesForm from '@/components/payment/AddBeneficiariesForm';

export const metadata = {
  title: 'Ajouter des bénéficiaires | Confidance Crypto',
  description: 'Ajoutez plusieurs bénéficiaires à votre paiement programmé',
};

export default function CreateBatchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="container mx-auto px-4 pt-24 pb-12">
        <AddBeneficiariesForm />
      </div>
    </div>
  );
}
