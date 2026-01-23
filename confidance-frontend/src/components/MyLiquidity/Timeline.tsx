'use client';

interface TimelineEvent {
  icon: string;
  bgColor: string;
  title: string;
  date: string;
  description: string;
  details?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  onShowProtectionInfo: () => void;
}

export default function Timeline({ events, onShowProtectionInfo }: TimelineProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Historique de votre position
        </h2>
        
        <button 
          onClick={onShowProtectionInfo}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Comment fonctionne la protection ? →
        </button>
      </div>
      
      {/* Timeline */}
      <div className="relative">
        {/* Ligne verticale */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        {/* Events */}
        <div className="space-y-6">
          {events.map((event, index) => (
            <div key={index} className="relative flex items-start gap-6 pl-14">
              {/* Icône */}
              <div className={`absolute left-0 w-12 h-12 rounded-full ${event.bgColor} flex items-center justify-center z-10`}>
                <span className="text-2xl">{event.icon}</span>
              </div>
              
              {/* Contenu */}
              <div className="flex-1 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{event.title}</span>
                  <span className="text-sm text-gray-500">{event.date}</span>
                </div>
                <p className="text-sm text-gray-600">{event.description}</p>
                
                {/* Détails supplémentaires si présents */}
                {event.details && (
                  <div className="mt-3 p-3 bg-white rounded-lg text-sm text-gray-700">
                    {event.details}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}