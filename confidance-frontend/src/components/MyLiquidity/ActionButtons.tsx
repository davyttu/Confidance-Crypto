'use client';

interface ActionButtonsProps {
  position: {
    status: 'healthy' | 'warning' | 'critical';
  };
  onRepay: () => void;
  onAddETH: () => void;
  onClose: () => void;
}

export default function ActionButtons({ position, onRepay, onAddETH, onClose }: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Bouton 1 : Rembourser */}
      <button 
        onClick={onRepay}
        className="group p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 transition-all hover:shadow-lg"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
            <span className="text-2xl group-hover:scale-110 transition-transform">🔁</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">Rembourser</span>
        </div>
        <p className="text-sm text-gray-600 text-left">
          Remboursez tout ou partie de votre liquidité et récupérez votre ETH
        </p>
      </button>
      
      {/* Bouton 2 : Ajouter de l'ETH (si warning ou critical) */}
      {position.status !== 'healthy' && (
        <button 
          onClick={onAddETH}
          className="group p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-green-500 transition-all hover:shadow-lg"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-500 transition-colors">
              <span className="text-2xl group-hover:scale-110 transition-transform">➕</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">Ajouter de l'ETH</span>
          </div>
          <p className="text-sm text-gray-600 text-left">
            Renforcez votre position en ajoutant de l'ETH comme garantie
          </p>
        </button>
      )}
      
      {/* Bouton 3 : Clôturer */}
      <button 
        onClick={onClose}
        className="group p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-red-500 transition-all hover:shadow-lg"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-red-500 transition-colors">
            <span className="text-2xl group-hover:scale-110 transition-transform">❌</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">Clôturer</span>
        </div>
        <p className="text-sm text-gray-600 text-left">
          Remboursez tout et récupérez la totalité de votre ETH
        </p>
      </button>
    </div>
  );
}