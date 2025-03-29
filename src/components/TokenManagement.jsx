import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  getMint,
  getAccount
} from '@solana/spl-token';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const TokenManagement = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [tokenName, setTokenName] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [tokenMint, setTokenMint] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [solBalance, setSolBalance] = useState(0);
  const [testRecipient, setTestRecipient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [createdTokens, setCreatedTokens] = useState(() => {
    // Load saved tokens from localStorage on component mount
    const savedTokens = localStorage.getItem('createdTokens');
    return savedTokens ? JSON.parse(savedTokens) : [];
  });
  const [mintAuthority, setMintAuthority] = useState(null);

  // Save tokens to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('createdTokens', JSON.stringify(createdTokens));
  }, [createdTokens]);

  // Function to fetch SOL balance
  const fetchSolBalance = async () => {
    if (!publicKey) return;
    try {
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
    }
  };

  // Fetch balance when wallet is connected
  useEffect(() => {
    fetchSolBalance();
    // Set up an interval to refresh the balance every 30 seconds
    const intervalId = setInterval(fetchSolBalance, 30000);
    return () => clearInterval(intervalId);
  }, [publicKey, connection]);

  // Function to fetch token info
  const fetchTokenInfo = async (mint, savedName = '') => {
    try {
      const mintInfo = await getMint(connection, mint);
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        publicKey,
        mint,
        publicKey
      );
      const accountInfo = await getAccount(connection, tokenAccount.address);
      return {
        mint: mint.toString(),
        name: savedName || tokenName || `Token ${createdTokens.length + 1}`,
        supply: Number(mintInfo.supply) / (10 ** mintInfo.decimals),
        balance: Number(accountInfo.amount) / (10 ** mintInfo.decimals),
        decimals: mintInfo.decimals,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching token info:', error);
      return null;
    }
  };

  // Function to add existing token
  const addExistingToken = async (mintAddress, tokenName) => {
    try {
      const mint = new PublicKey(mintAddress);
      const tokenInfo = await fetchTokenInfo(mint, tokenName);
      
      if (tokenInfo) {
        // Check if token already exists in the list
        const exists = createdTokens.some(token => token.mint === mintAddress);
        if (!exists) {
          setCreatedTokens(prev => [...prev, tokenInfo]);
          toast.success('Token added to dashboard successfully!');
        } else {
          toast.info('Token already in your dashboard');
        }
      }
    } catch (error) {
      console.error('Error adding existing token:', error);
      toast.error('Invalid token address');
    }
  };

  // Function to refresh token balances
  const refreshTokenBalances = async () => {
    if (!publicKey || createdTokens.length === 0) return;
    
    try {
      const updatedTokens = await Promise.all(
        createdTokens.map(async (token) => {
          try {
            const tokenAccount = await getOrCreateAssociatedTokenAccount(
              connection,
              publicKey,
              new PublicKey(token.mint),
              publicKey
            );
            const mintInfo = await getMint(connection, new PublicKey(token.mint));
            const accountInfo = await getAccount(connection, tokenAccount.address);
            const balance = Number(accountInfo.amount) / (10 ** mintInfo.decimals);
            
            return {
              ...token,
              balance,
              decimals: mintInfo.decimals
            };
          } catch (error) {
            console.error(`Error fetching token ${token.mint}:`, error);
            return token;
          }
        })
      );
      setCreatedTokens(updatedTokens);
    } catch (error) {
      console.error('Error refreshing token balances:', error);
    }
  };

  // Refresh token balances periodically
  useEffect(() => {
    if (!publicKey) return;
    
    refreshTokenBalances();
    const intervalId = setInterval(refreshTokenBalances, 30000);
    return () => clearInterval(intervalId);
  }, [publicKey, createdTokens.length]);

  // Function to set mint authority for a token
  const setTokenMintAuthority = (tokenMint) => {
    const mintAuthority = Keypair.generate();
    const mintAuthorityData = {
      publicKey: mintAuthority.publicKey.toString(),
      secretKey: Array.from(mintAuthority.secretKey)
    };
    localStorage.setItem(`mintAuthority_${tokenMint}`, JSON.stringify(mintAuthorityData));
    setMintAuthority(mintAuthority);
    return mintAuthority;
  };

  // Function to recover mint authority
  const recoverMintAuthority = async (tokenMint) => {
    setLoading(true);
    try {
      const mintAuthority = setTokenMintAuthority(tokenMint);
      
      // Create a new token account with the new mint authority
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        publicKey,
        new PublicKey(tokenMint),
        publicKey
      );

      toast.success('Mint authority recovered successfully!');
      return mintAuthority;
    } catch (error) {
      console.error('Error recovering mint authority:', error);
      toast.error('Failed to recover mint authority');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!tokenName) {
      toast.error('Please enter a token name');
      return;
    }

    setLoading(true);
    try {
      const mintAuthority = Keypair.generate();
      
      // First check if the wallet has enough SOL
      const balance = await connection.getBalance(publicKey);
      if (balance < LAMPORTS_PER_SOL * 0.01) {
        toast.error('Insufficient SOL balance. You need at least 0.01 SOL to create a token.');
        toast.info(
          <div>
            <p>Get test SOL from:</p>
            <p>1. <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Solana Faucet</a></p>
            <p>2. CLI: <code>solana airdrop 1 {publicKey.toString()}</code></p>
          </div>,
          {
            autoClose: false,
          }
        );
        return;
      }

      const mint = await createMint(
        connection,
        await requestAirdrop(mintAuthority),
        mintAuthority.publicKey, // mint authority should be the same keypair we're using for setup
        mintAuthority.publicKey, // freeze authority
        9
      );

      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintAuthority,
        mint,
        publicKey
      );

      // Store the mint authority keypair in localStorage
      const mintAuthorityData = {
        publicKey: mintAuthority.publicKey.toString(),
        secretKey: Array.from(mintAuthority.secretKey)
      };
      localStorage.setItem(`mintAuthority_${mint.toString()}`, JSON.stringify(mintAuthorityData));

      setTokenMint(mint);
      
      // Add the new token to the list
      const tokenInfo = await fetchTokenInfo(mint);
      if (tokenInfo) {
        setCreatedTokens(prev => [...prev, { ...tokenInfo, name: tokenName }]);
      }
      
      toast.success('Token created successfully!');
      updateTokenBalance(mint, tokenAccount.address);
    } catch (error) {
      console.error('Error creating token:', error);
      if (!error.toString().includes('429')) {
        toast.error('Failed to create token. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const mintTokens = async () => {
    if (!publicKey || !tokenMint) {
      toast.error('Please create a token first');
      return;
    }

    if (!mintAmount || mintAmount <= 0) {
      toast.error('Please enter a valid amount to mint');
      return;
    }

    setLoading(true);
    try {
      let currentMintAuthority;
      
      // First try to get mint authority from localStorage
      const mintAuthorityData = localStorage.getItem(`mintAuthority_${tokenMint.toString()}`);
      if (!mintAuthorityData) {
        // If not found, try to recover it
        currentMintAuthority = await recoverMintAuthority(tokenMint.toString());
        if (!currentMintAuthority) {
          toast.error('Could not recover mint authority. You may need to create a new token.');
          return;
        }
      } else {
        const mintAuthorityInfo = JSON.parse(mintAuthorityData);
        currentMintAuthority = Keypair.fromSecretKey(new Uint8Array(mintAuthorityInfo.secretKey));
      }

      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        currentMintAuthority,
        tokenMint,
        publicKey
      );

      await mintTo(
        connection,
        currentMintAuthority,
        tokenMint,
        tokenAccount.address,
        currentMintAuthority.publicKey,
        BigInt(Number(mintAmount) * (10 ** 9))
      );

      toast.success('Tokens minted successfully!');
      await updateTokenBalance(tokenMint, tokenAccount.address);
      await refreshTokenBalances();
    } catch (error) {
      console.error('Error minting tokens:', error);
      if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient SOL for transaction fees. You need a small amount of SOL to mint tokens.');
      } else {
        toast.error('Failed to mint tokens. You may need to create a new token.');
      }
    } finally {
      setLoading(false);
    }
  };

  const transferTokens = async () => {
    if (!publicKey || !tokenMint) {
      toast.error('Please create a token first');
      return;
    }

    if (!recipientAddress) {
      toast.error('Please enter a recipient address');
      return;
    }

    if (!transferAmount || transferAmount <= 0) {
      toast.error('Please enter a valid amount to transfer');
      return;
    }

    setLoading(true);
    try {
      // First get the mint authority to pay for account creation
      const mintAuthorityData = localStorage.getItem(`mintAuthority_${tokenMint.toString()}`);
      let payer = publicKey;
      let payerKeypair = null;

      if (mintAuthorityData) {
        const mintAuthorityInfo = JSON.parse(mintAuthorityData);
        payerKeypair = Keypair.fromSecretKey(new Uint8Array(mintAuthorityInfo.secretKey));
        payer = payerKeypair;
      }

      // Get or create the source token account
      const sourceAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        tokenMint,
        publicKey
      );

      // Get or create the destination token account
      const destinationPubKey = new PublicKey(recipientAddress);
      const destinationAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        tokenMint,
        destinationPubKey
      );

      // Perform the transfer
      const signature = await transfer(
        connection,
        payer,
        sourceAccount.address,
        destinationAccount.address,
        publicKey,
        BigInt(Number(transferAmount) * (10 ** 9))
      );

      await connection.confirmTransaction(signature);
      toast.success('Tokens transferred successfully!');
      
      // Update balances
      await updateTokenBalance(tokenMint, sourceAccount.address);
      await refreshTokenBalances();
    } catch (error) {
      console.error('Error transferring tokens:', error);
      if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient funds for transaction. Make sure you have enough tokens and SOL for fees.');
      } else if (error.message?.includes('0 tokens')) {
        toast.error('Insufficient token balance for transfer.');
      } else if (error.message?.includes('TokenAccountNotFoundError')) {
        toast.error('Error creating recipient token account. Make sure you have enough SOL for fees.');
      } else {
        toast.error('Failed to transfer tokens. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const requestAirdrop = async (keypair) => {
    try {
      const airdropTx = await connection.requestAirdrop(
        keypair.publicKey,
        LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropTx);
      return keypair;
    } catch (error) {
      console.error('Error requesting airdrop:', error);
      if (error.toString().includes('429')) {
        toast.error(
          'Devnet faucet limit reached. Please get SOL from alternate sources:',
          {
            autoClose: false,
          }
        );
        toast.info(
          <div>
            <p>1. Visit <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Solana Faucet</a></p>
            <p>2. Use CLI: <code>solana airdrop 1 {keypair.publicKey.toString()}</code></p>
          </div>,
          {
            autoClose: false,
          }
        );
      }
      throw error;
    }
  };

  const updateTokenBalance = async (mint, account) => {
    try {
      const tokenAccount = await getAccount(connection, account);
      const mintInfo = await getMint(connection, mint);
      const balance = Number(tokenAccount.amount) / (10 ** mintInfo.decimals);
      setTokenBalance(balance);
      
      // Update the balance in the createdTokens list as well
      setCreatedTokens(prev => prev.map(token => {
        if (token.mint === mint.toString()) {
          return { ...token, balance };
        }
        return token;
      }));
    } catch (error) {
      console.error('Error updating token balance:', error);
      setTokenBalance(0);
    }
  };

  const generateTestRecipient = () => {
    const testWallet = Keypair.generate();
    setTestRecipient(testWallet);
    setRecipientAddress(testWallet.publicKey.toString());
    toast.success('Test recipient address generated and filled!');
  };

  const fetchTransactionHistory = async (tokenMint) => {
    if (!publicKey || !tokenMint) return;

    try {
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey(tokenMint),
        { limit: 10 }
      );

      const transactionDetails = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          let type = 'Unknown';
          let amount = 0;
          let fromAddress = '';
          let toAddress = '';

          if (tx) {
            // Determine if it's a mint or transfer
            if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
              const preBalances = tx.meta.preTokenBalances;
              const postBalances = tx.meta.postTokenBalances;

              if (preBalances.length === 0 && postBalances.length === 1) {
                type = 'Mint';
                amount = Number(postBalances[0].uiTokenAmount.amount) / Math.pow(10, postBalances[0].uiTokenAmount.decimals);
                toAddress = postBalances[0].owner;
              } else if (preBalances.length === 1 && postBalances.length === 2) {
                type = 'Transfer';
                fromAddress = preBalances[0].owner;
                toAddress = postBalances[1].owner;
                amount = Number(postBalances[1].uiTokenAmount.amount) / Math.pow(10, postBalances[1].uiTokenAmount.decimals);
              }
            }

            return {
              signature: sig.signature,
              type,
              amount,
              fromAddress,
              toAddress,
              timestamp: new Date(tx.blockTime * 1000).toLocaleString(),
            };
          }
          return null;
        })
      );

      const validTransactions = transactionDetails.filter(tx => tx !== null);
      setTransactions(validTransactions);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      toast.error('Failed to fetch transaction history');
    }
  };

  useEffect(() => {
    if (tokenMint) {
      fetchTransactionHistory(tokenMint);
    }
  }, [tokenMint, publicKey]);

  return (
    <div className="space-y-6">
      {/* Wallet Information */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 transition-transform duration-150">
        <h2 className="text-lg font-medium text-gray-900 flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Wallet Information</span>
        </h2>
        {publicKey ? (
          <div>
            <p className="mb-2">
              <span className="font-semibold">Address:</span>{' '}
              <span className="font-mono">{publicKey.toString()}</span>
            </p>
            <p className="mb-2">
              <span className="font-semibold">SOL Balance:</span>{' '}
              {solBalance.toFixed(4)} SOL
            </p>
          </div>
        ) : (
          <p className="text-gray-600">Please connect your wallet to view balance</p>
        )}
      </div>

      {/* Created Tokens Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 transition-transform duration-150">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>My Tokens</span>
          </h2>
          <button
            onClick={() => {
              const mintAddress = prompt('Enter token mint address:');
              const tokenName = prompt('Enter token name:');
              if (mintAddress && tokenName) {
                addExistingToken(mintAddress, tokenName);
              }
            }}
            className="text-sm px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Existing Token</span>
          </button>
        </div>
        
        {createdTokens.length > 0 ? (
          <div className="space-y-4">
            {createdTokens
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              .map((token) => (
              <div key={token.mint} className="bg-white/50 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{token.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{token.mint}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(token.mint);
                        toast.success('Token address copied to clipboard');
                      }}
                      className="text-sm px-2 py-1 text-gray-600 hover:text-gray-900 transition-colors"
                      title="Copy Address"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setTokenMint(new PublicKey(token.mint));
                        toast.success('Token selected for minting/transfer');
                      }}
                      className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                    >
                      Select
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Total Supply</p>
                    <p className="font-medium">{token.supply.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Your Balance</p>
                    <p className="font-medium">{token.balance.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No tokens yet. Create a new token or add an existing one using the button above!
          </p>
        )}
      </div>

      {/* Create Token */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 transition-transform duration-150">
        <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create Token</span>
        </h3>
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Token Name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 pl-10"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <button
            onClick={createToken}
            disabled={loading}
            className={`w-full px-4 py-3 text-white rounded-lg transition-all duration-150 ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-600 shadow-lg'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating...</span>
              </div>
            ) : (
              'Create Token'
            )}
          </button>
        </div>
      </div>

      {/* Mint Tokens */}
      {tokenMint && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 transition-transform duration-150">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Mint Tokens</span>
            </h3>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="number"
                  placeholder="Amount to Mint"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-150 pl-10"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <button
                onClick={mintTokens}
                disabled={loading}
                className={`w-full px-4 py-3 text-white rounded-lg transition-all duration-150 ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Minting...</span>
                  </div>
                ) : (
                  'Mint Tokens'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Tokens */}
      {tokenMint && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 transition-transform duration-150">
          <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2 mb-4">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4" />
            </svg>
            <span>Transfer Tokens</span>
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Address</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Enter recipient's wallet address"
                  className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={generateTestRecipient}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center space-x-1"
                  title="Generate a test recipient address"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Test</span>
                </button>
              </div>
              {testRecipient && (
                <p className="mt-1 text-sm text-gray-500">
                  Test wallet generated! You can use this address for testing transfers.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Transfer</label>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Enter amount to transfer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={transferTokens}
              disabled={loading || !publicKey || !tokenMint}
              className={`w-full px-4 py-3 text-white rounded-lg transition-all duration-150 ${
                loading || !publicKey || !tokenMint
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-600 shadow-lg'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                  Processing...
                </div>
              ) : (
                'Transfer Tokens'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Token Info */}
      {tokenMint && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 transition-transform duration-150">
          <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2 mb-4">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Token Info</span>
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Token Address</label>
              <div className="mt-1 relative">
                <p className="text-sm text-gray-900 break-all font-mono bg-gray-50/80 p-3 rounded-lg transition-colors duration-150">
                  {tokenMint.toString()}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tokenMint.toString());
                    toast.success('Token address copied to clipboard!');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors duration-150"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Token Balance</label>
              <p className="mt-1 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                {tokenBalance}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      {tokenMint && transactions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">From</th>
                  <th className="px-4 py-2">To</th>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Signature</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2">{tx.type}</td>
                    <td className="px-4 py-2">{tx.amount}</td>
                    <td className="px-4 py-2">
                      {tx.fromAddress ? 
                        `${tx.fromAddress.slice(0, 4)}...${tx.fromAddress.slice(-4)}` : 
                        '-'
                      }
                    </td>
                    <td className="px-4 py-2">
                      {tx.toAddress ? 
                        `${tx.toAddress.slice(0, 4)}...${tx.toAddress.slice(-4)}` : 
                        '-'
                      }
                    </td>
                    <td className="px-4 py-2">{tx.timestamp}</td>
                    <td className="px-4 py-2">
                      <a 
                        href={`https://explorer.solana.com/tx/${tx.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                      >
                        {`${tx.signature.slice(0, 4)}...${tx.signature.slice(-4)}`}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenManagement;
