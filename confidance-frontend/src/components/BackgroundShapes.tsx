'use client';

export function BackgroundShapes() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Formes géométriques flottantes */}
      <div className="absolute top-20 right-20 w-32 h-32 floating-shape animate-float" />
      <div className="absolute top-40 right-40 w-24 h-24 floating-shape animate-float-delayed" />
      <div className="absolute top-60 right-60 w-16 h-16 floating-shape animate-pulse-slow" />
      
      <div className="absolute top-32 right-32 w-20 h-20 floating-shape animate-float" style={{ animationDelay: '1s' }} />
      <div className="absolute top-52 right-52 w-28 h-28 floating-shape animate-float-delayed" style={{ animationDelay: '3s' }} />
      
      {/* Formes dans le coin inférieur gauche */}
      <div className="absolute bottom-20 left-20 w-24 h-24 floating-shape animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-40 left-40 w-32 h-32 floating-shape animate-float-delayed" style={{ animationDelay: '4s' }} />
      <div className="absolute bottom-60 left-60 w-20 h-20 floating-shape animate-pulse-slow" style={{ animationDelay: '1s' }} />
      
      {/* Formes au centre */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 floating-shape animate-float" style={{ animationDelay: '2.5s' }} />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 floating-shape animate-float-delayed" style={{ animationDelay: '4.5s' }} />
      
      {/* Gradient overlay pour un effet subtil */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
    </div>
  );
}

