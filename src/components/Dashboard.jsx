import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import TokenManagement from './TokenManagement';

const Dashboard = () => {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey) return;
      try {
        const balance = await connection.getBalance(publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Error fetching balance:', error);
        toast.error('Failed to fetch balance');
      }
    };

    fetchBalance();
    const intervalId = setInterval(fetchBalance, 10000);
    return () => clearInterval(intervalId);
  }, [publicKey, connection]);

  return (
    <div className="flex flex-col w-full">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-4 tracking-tight">
          Solana Token Manager
        </h1>
        <p className="text-base sm:text-lg text-gray-600 mb-6">
          Create, mint, and manage Solana Tokens
        </p>
        <div className="relative z-50">
          <WalletMultiButton className="!bg-gradient-to-r !from-indigo-600 !to-purple-600 hover:!from-indigo-700 hover:!to-purple-700 !rounded-lg !px-6 !py-3 !text-sm !font-medium !transition-all !duration-150 !shadow-lg" />
        </div>
      </div>

      {!publicKey ? (
        <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">Connect Your Wallet</h2>
            <p className="text-gray-600">Connect your Solana wallet to start managing Solana Tokens</p>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <TokenManagement />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
