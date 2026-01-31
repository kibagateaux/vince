/**
 * @module @bangui/app/page
 * Main chat interface page with 3D Vince background
 */

'use client';

import { FC, useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, type Chain as ViemChain } from 'viem';
import { mainnet, sepolia, polygon, arbitrum, base } from 'viem/chains';
import { useChat } from '../hooks/useChat';
import { useVinceState } from '../hooks/useVinceState';
import { connectSession, prepareDeposit, confirmDeposit } from '../lib/api';
import { Message } from '../components/Message';
import type { ActionPrompt, Chain, BigIntString } from '@bangui/types';
import type { Session } from '../lib/types';

// Dynamic import for 3D scene (SSR: false)
const VinceScene = dynamic(
  () => import('../components/three/VinceScene').then((mod) => mod.VinceScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-indigo-600/20 animate-pulse flex items-center justify-center">
            <span className="text-2xl font-bold text-indigo-400">V</span>
          </div>
          <p className="text-slate-400 text-sm">Loading Vince...</p>
        </div>
      </div>
    ),
  }
);

/**
 * Parses human-readable amount to wei string
 */
const parseAmountToWei = (amount: string, decimals: number): BigIntString => {
  const [whole = '0', fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return `${whole}${paddedFraction}` as BigIntString;
};

/**
 * Gets token decimals for common tokens
 */
const getTokenDecimals = (token: string): number => {
  const decimalsMap: Record<string, number> = {
    ETH: 18,
    WETH: 18,
    USDC: 6,
    USDT: 6,
    DAI: 18,
  };
  return decimalsMap[token.toUpperCase()] ?? 18;
};

export default function ChatPage() {
  const { authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const { messages, connectionState, isWaitingForResponse, sendMessage, connect } = useChat();
  const [input, setInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [session, setSession] = useState<Session | null>(null);
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Get last message sender
  const lastMessage = messages[messages.length - 1];
  const lastMessageSender = lastMessage?.sender;

  // Vince state machine
  const vinceState = useVinceState({
    connectionState,
    isWaitingForResponse,
    inputHasText: input.length > 0,
    messageCount: messages.length,
    lastMessageSender,
    depositConfirmed,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track scroll for parallax
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollY(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Connect when authenticated
  useEffect(() => {
    const initSession = async () => {
      if (!authenticated || session) return;

      const walletAddress = user?.wallet?.address as `0x${string}` | undefined;
      const sessionData = await connectSession('web', walletAddress);
      setSession(sessionData);
      connect(sessionData);
    };

    initSession();
  }, [authenticated, user, session, connect]);

  // Reset deposit confirmation after animation
  useEffect(() => {
    if (depositConfirmed) {
      const timeout = setTimeout(() => setDepositConfirmed(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [depositConfirmed]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      sendMessage(input.trim());
      setInput('');
      setSelectedOptions(new Set());
    },
    [input, sendMessage]
  );

  const handleToggleOption = useCallback(
    (option: string) => {
      setSelectedOptions((prev) => {
        const next = new Set(prev);
        if (next.has(option)) {
          next.delete(option);
        } else {
          next.add(option);
        }
        setInput(Array.from(next).join(', '));
        return next;
      });
    },
    []
  );

  const handleAction = useCallback(
    async (action: ActionPrompt) => {
      if (action.type === 'deposit' && session && user?.wallet?.address) {
        const { amount, token, chain } = action.data as {
          amount?: string;
          token?: string;
          chain?: Chain;
        };

        if (!amount || !token) {
          sendMessage('I want to make a deposit');
          return;
        }

        const wallet = wallets.find(w => w.address === user.wallet?.address);
        if (!wallet) {
          sendMessage('Could not find connected wallet. Please reconnect.');
          return;
        }

        setIsProcessingDeposit(true);
        try {
          const walletAddress = user.wallet.address as `0x${string}`;
          const decimals = getTokenDecimals(token);
          const amountWei = parseAmountToWei(amount, decimals);

          // Detect connected chain first
          const provider = await wallet.getEthereumProvider();
          const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
          const currentChainId = parseInt(chainIdHex, 16);

          const chainMap: Record<number, ViemChain> = {
            1: mainnet,
            11155111: sepolia,
            137: polygon,
            42161: arbitrum,
            8453: base,
          };

          // Map chain ID to chain name for API
          const chainIdToName: Record<number, Chain> = {
            1: 'ethereum',
            137: 'polygon',
            42161: 'arbitrum',
            8453: 'base',
          };

          // Determine target chain - use requested chain or connected chain
          const targetChainName = chain ?? chainIdToName[currentChainId] ?? 'ethereum';
          const targetChainId = Object.entries(chainIdToName).find(([, name]) => name === targetChainName)?.[0];
          const targetChain = targetChainId ? chainMap[Number(targetChainId)] : mainnet;

          // Switch chain if needed
          if (currentChainId !== Number(targetChainId)) {
            try {
              await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${Number(targetChainId).toString(16)}` }],
              });
            } catch (switchError: unknown) {
              const error = switchError as { code?: number };
              // Chain not added to wallet - add it
              if (error.code === 4902) {
                sendMessage(`Please add ${targetChainName} network to your wallet and try again.`);
                return;
              }
              throw switchError;
            }
          }

          const { depositId, transaction } = await prepareDeposit({
            userId: session.userId,
            walletAddress,
            amount: amountWei,
            token,
            chain: targetChainName,
          });

          const walletClient = createWalletClient({
            account: walletAddress,
            chain: targetChain,
            transport: custom(provider),
          });

          const txHash = await walletClient.sendTransaction({
            to: transaction.to,
            data: transaction.data,
            value: BigInt(transaction.value),
            chain: null, // Let wallet handle chain validation
          });

          if (txHash) {
            await confirmDeposit(depositId, txHash);
            setDepositConfirmed(true);
            sendMessage(`My deposit of ${amount} ${token} was confirmed! Transaction: ${txHash}`);
          }
        } catch (error) {
          console.error('Deposit failed:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
            sendMessage('Transaction was cancelled.');
          } else {
            sendMessage('There was an issue with the deposit. Please try again.');
          }
        } finally {
          setIsProcessingDeposit(false);
        }
      }
    },
    [session, user, wallets, sendMessage]
  );

  // Show login if not authenticated
  if (!authenticated) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden">
        {/* 3D Background */}
        <VinceScene
          behavior="idle"
          gazeTarget={[0, 0, 5]}
          intensity={0.5}
        />

        {/* Login Card */}
        <div className="relative z-10 text-center glass-panel rounded-3xl p-8 max-w-md mx-4">
          <h1 className="mb-4 text-3xl font-bold text-white glass-text">Meet Vince</h1>
          <p className="mb-8 text-white/70">
            Your personal guide to impactful giving
          </p>
          <button
            onClick={login}
            className="glass-button px-8 py-3 text-lg font-semibold text-white transition-all"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* 3D Background */}
      <VinceScene
        behavior={vinceState.behavior}
        gazeTarget={vinceState.gazeTarget}
        intensity={vinceState.intensity}
        scrollY={scrollY}
      />

      {/* Glass Overlay Container */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <header className="glass-header px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-600/80 backdrop-blur-sm flex items-center justify-center border border-indigo-400/30 shadow-lg">
                <span className="text-lg font-bold text-white">V</span>
              </div>
              <div>
                <h1 className="font-semibold text-white glass-text">Vince</h1>
                <span
                  className={`text-xs ${
                    connectionState === 'connected'
                      ? 'text-emerald-400'
                      : 'text-white/50'
                  }`}
                >
                  {connectionState === 'connected' ? 'Online' : 'Connecting...'}
                </span>
              </div>
            </div>
            <div className="text-sm text-white/60 glass-text">
              {user?.wallet?.address?.slice(0, 6)}...
              {user?.wallet?.address?.slice(-4)}
            </div>
          </div>
        </header>

        {/* Messages */}
        <main
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 glass-scrollbar"
        >
          {messages.length === 0 && connectionState === 'connecting' && (
            <div className="flex h-full items-center justify-center">
              <div className="text-white/50 glass-text">Connecting to Vince...</div>
            </div>
          )}
          {messages.map((msg) => (
            <Message
              key={msg.id}
              message={msg}
              onAction={handleAction}
              selectedOptions={selectedOptions}
              onToggleOption={handleToggleOption}
            />
          ))}
          {/* Typing indicator */}
          {isWaitingForResponse && (
            <div className="flex items-start gap-3 mb-4">
              <div className="h-8 w-8 rounded-full bg-indigo-600/80 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-indigo-400/30 shadow-lg">
                <span className="text-sm font-bold text-white">V</span>
              </div>
              <div className="glass-card-vince px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Input */}
        <form onSubmit={handleSubmit} className="glass-panel-dark border-t border-white/10 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 glass-input px-4 py-3 text-sm text-white placeholder-white/40 focus:border-indigo-400/50"
              disabled={connectionState !== 'connected'}
            />
            <button
              type="submit"
              disabled={connectionState !== 'connected' || !input.trim()}
              className="glass-button px-6 py-3 font-medium text-white transition-all"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Celebration confetti (when deposit confirmed) */}
      {depositConfirmed && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ['#818CF8', '#34D399', '#FBBF24', '#F472B6', '#60A5FA'][i % 5],
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
