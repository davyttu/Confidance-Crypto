import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Définir la racine du workspace pour éviter les warnings sur les lockfiles multiples
  outputFileTracingRoot: require('path').join(__dirname),
  
  webpack: (config, { isServer }) => {
    // Fix MetaMask SDK async-storage issue
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    
    // Configuration pour React Email dans les routes API
    if (isServer) {
      config.externals = config.externals || [];
      // Ne pas externaliser les composants React Email
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    
    return config;
  },
  
  // Optimize development warnings
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Suppress specific warnings in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Headers de sécurité pour éviter les warnings COOP
  // Les routes API n'ont pas besoin de ces headers, donc on les applique uniquement aux pages
  async headers() {
    return [
      {
        // Appliquer les headers uniquement aux pages (pas aux routes API)
        source: '/:path((?!api).)*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
};

export default nextConfig;