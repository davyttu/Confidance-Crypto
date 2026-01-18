'use client';

interface CancellableToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function CancellableToggle({
  value,
  onChange,
}: CancellableToggleProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl glass border-2 border-gray-200 dark:border-gray-700">
        <div className="flex-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-5 h-5 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Paiement annulable
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Vous pourrez annuler et récupérer vos fonds avant la date
              </div>
            </div>
          </label>
        </div>

        {/* Icône info avec tooltip */}
        <div className="group relative ml-4">
          <svg
            className="w-5 h-5 text-gray-400 cursor-help"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl z-10">
            <p className="font-semibold mb-1">Paiement annulable :</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Vous pouvez annuler AVANT la date</li>
              <li>Remboursement intégral (montant + fees)</li>
              <li>Récurrent : mensualités restantes + fees remboursés</li>
              <li>Après la date : annulation impossible</li>
            </ul>
            <p className="mt-2 text-yellow-300">
              ⚠️ Si non-annulable : aucun moyen de récupérer les fonds
            </p>
            <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
          </div>
        </div>
      </div>

      {/* Warning si non-annulable */}
      {!value && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
          <svg
            className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-yellow-900 dark:text-yellow-300">
            <p className="font-medium mb-1">Attention : Paiement non-annulable</p>
            <p>
              Une fois créé, il sera impossible d'annuler ce paiement.
              Les fonds seront automatiquement libérés à la date choisie.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}