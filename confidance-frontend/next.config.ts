import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Fix MetaMask SDK async-storage issue
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    
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
};

export default nextConfig;
