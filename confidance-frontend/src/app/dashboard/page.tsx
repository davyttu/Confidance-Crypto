
'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import { useFetchTransactions, Transaction } from '@/hooks/useFetchTransactions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRightLeft,
  Copy,
  Wallet,
  CalendarDays,
  CheckCircle,
  Loader,
  AlertCircle
} from "lucide-react";
import Image from 'next/image';
import { Button } from '@/components/ui/button';

// Helper to get token image
const getTokenImage = (symbol: string) => {
  const tokenMap: { [key: string]: string } = {
    ETH: '/tokens/eth.svg',
    USDC: '/tokens/usdc.svg',
    USDT: '/tokens/usdt.svg',
    WBTC: '/tokens/wbtc.svg',
    CBBTC: '/tokens/cbbtc.svg',
  };
  return tokenMap[symbol.toUpperCase()] || '/tokens/eth.svg'; // Default icon
};

// Copy to clipboard helper
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  // Here you could add a toast notification for feedback
};

const TransactionCard = ({ tx }: { tx: Transaction }) => (
  <Card className="bg-card/80 backdrop-blur-sm border-white/10 shadow-lg transition-all hover:shadow-xl hover:border-white/20">
    <CardContent className="p-4 grid grid-cols-[auto,1fr,auto] items-center gap-4">
      <Image src={getTokenImage(tx.currency)} alt={tx.currency} width={40} height={40} />
      
      <div className="flex flex-col">
        <span className="font-bold text-lg">{tx.amount} {tx.currency}</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3" /> {tx.date}
        </span>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-sm font-medium text-green-400 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" /> Sent
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 mt-1" onClick={() => copyToClipboard(tx.tx_hash)}>
          <Copy className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    </CardContent>
    <div className="px-4 pb-3 text-xs text-muted-foreground font-mono flex items-center justify-between">
        <span>To: {`${tx.recipient.substring(0, 10)}...${tx.recipient.substring(tx.recipient.length - 4)}`}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(tx.recipient)}>
          <Copy className="w-3 h-3" />
        </Button>
    </div>
  </Card>
);

const DashboardPage = () => {
  const { address } = useAccount();
  const { transactions, loading, error } = useFetchTransactions(address);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <Loader className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your transactions...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 bg-red-900/20 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="font-medium">Error loading transactions</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      );
    }

    if (transactions.length === 0) {
      return (
        <div className="text-center py-16 border-2 border-dashed border-muted-foreground/20 rounded-lg">
          <h3 className="text-lg font-medium">No transactions yet</h3>
          <p className="text-sm text-muted-foreground">Create your first payment to see it here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {transactions.map((tx) => (
          <TransactionCard key={tx.id} tx={tx} />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-24">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">A summary of your financial activity.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">$5,231</div>
            <p className="text-xs text-muted-foreground">Based on current asset prices</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '--' : transactions.length}</div>
            <p className="text-xs text-muted-foreground">Across all supported networks</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Address</CardTitle>
            <Copy className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-mono font-bold">{address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Not Connected'}</div>
            <p className="text-xs text-muted-foreground">Click icon to copy</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
        {renderContent()}
      </div>
    </div>
  );
};

export default DashboardPage;
