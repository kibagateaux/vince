/**
 * @module @bangui/web/components/Chat
 * Main chat interface component
 */

import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, type Chain as ViemChain } from 'viem';
import { mainnet, sepolia, polygon, arbitrum } from 'viem/chains';
import { useChat } from '../hooks/useChat.js';
import { connectSession, prepareDeposit, confirmDeposit } from '../lib/api.js';
import { Message } from './Message.js';
import type { ActionPrompt, UUID, Chain, BigIntString } from '@bangui/types';
import type { Session } from '../lib/types.js';

/**
 * Chat interface with message list and input
 */
/**
 * Parses human-readable amount to wei string
 * @param amount - Human-readable amount (e.g., "10" or "0.5")
 * @param decimals - Token decimals (default 18 for ETH, 6 for USDC/USDT)
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

export const Chat: FC = () => {
  const { authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const { messages, connectionState, isWaitingForResponse, sendMessage, connect } = useChat();
  const [input, setInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [session, setSession] = useState<Session | null>(null);
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        // Update input field with selected options
        setInput(Array.from(next).join(', '));
        return next;
      });
    },
    []
  );

  const handleAction = useCallback(
    async (action: ActionPrompt) => {
      if (action.type === 'questionnaire' && action.data.options && session) {
        // For questionnaire actions, submit the selected option
        const questionId = action.data.questionId as string;
        const options = action.data.options as string[];
        // User needs to select - we'll send the message which will be processed
      } else if (action.type === 'deposit' && session && user?.wallet?.address) {
        // Handle deposit action
        const { amount, token, chain } = action.data as {
          amount?: string;
          token?: string;
          chain?: Chain;
        };

        if (!amount || !token) {
          // No amount specified, prompt user
          sendMessage('I want to make a deposit');
          return;
        }

        // Find the connected wallet
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

          // Prepare the deposit transaction via API
          const { depositId, transaction } = await prepareDeposit({
            userId: session.userId,
            walletAddress,
            amount: amountWei,
            token,
            chain: chain ?? 'ethereum',
          });

          // Get the wallet provider and create a viem wallet client
          const provider = await wallet.getEthereumProvider();

          // Get the current chain ID from the wallet
          const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
          const currentChainId = parseInt(chainIdHex, 16);

          // Map chain ID to viem chain config
          const chainMap: Record<number, ViemChain> = {
            1: mainnet,
            11155111: sepolia,
            137: polygon,
            42161: arbitrum,
          };
          const currentChain = chainMap[currentChainId] ?? mainnet;

          const walletClient = createWalletClient({
            account: walletAddress,
            chain: currentChain,
            transport: custom(provider),
          });

          // Send the transaction on the wallet's current chain
          const txHash = await walletClient.sendTransaction({
            to: transaction.to,
            data: transaction.data,
            value: BigInt(transaction.value),
          });

          // Confirm the deposit with the tx hash
          if (txHash) {
            await confirmDeposit(depositId, txHash);
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
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Meet Vince</h1>
          <p className="mb-8 text-gray-600">
            Your personal guide to impactful giving
          </p>
          <button
            onClick={login}
            className="rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white">V</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Vince</h1>
              <span
                className={`text-xs ${
                  connectionState === 'connected'
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}
              >
                {connectionState === 'connected' ? 'Online' : 'Connecting...'}
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {user?.wallet?.address?.slice(0, 6)}...
            {user?.wallet?.address?.slice(-4)}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && connectionState === 'connecting' && (
          <div className="flex h-full items-center justify-center">
            <div className="text-gray-400">Connecting to Vince...</div>
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
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">V</span>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={connectionState !== 'connected'}
          />
          <button
            type="submit"
            disabled={connectionState !== 'connected' || !input.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};
