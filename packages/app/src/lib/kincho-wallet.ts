/**
 * @module kincho-wallet
 * Kincho agent wallet for autonomous transaction execution.
 *
 * CRITICAL SECURITY: This wallet can ONLY transact with the vault contract.
 * All transactions are validated against the allowed vault address before execution.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type WalletClient,
  type PublicClient,
  type Account,
  type Chain as ViemChain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, baseSepolia } from 'viem/chains';
import type { Address } from '@bangui/types';
import { CHAIN_MAP, DEFAULT_CHAIN_ID, DEFAULT_RPC_URL } from './chains';

/**
 * Get Kincho's private key from environment
 * @throws Error if KINCHO_PRIVATE_KEY is not configured
 */
function getKinchoPrivateKey(): `0x${string}` {
  const privateKey = process.env.KINCHO_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('KINCHO_PRIVATE_KEY not configured in environment');
  }
  if (!privateKey.startsWith('0x')) {
    throw new Error('KINCHO_PRIVATE_KEY must start with 0x');
  }
  return privateKey as `0x${string}`;
}

/**
 * Get Kincho's account from private key
 */
export function getKinchoAccount(): Account {
  const privateKey = getKinchoPrivateKey();
  return privateKeyToAccount(privateKey);
}

/**
 * Get Kincho's wallet address
 */
export function getKinchoAddress(): Address {
  const account = getKinchoAccount();
  return account.address as Address;
}

/**
 * Check if Kincho wallet is configured
 */
export function isKinchoWalletConfigured(): boolean {
  return !!process.env.KINCHO_PRIVATE_KEY;
}

/**
 * Get the vault address that Kincho is allowed to transact with
 * @throws Error if vault address is not configured
 */
export function getAllowedVaultAddress(): Address {
  const vaultAddress = process.env.DAF_CONTRACT_ADDRESS;
  if (!vaultAddress) {
    throw new Error('DAF_CONTRACT_ADDRESS not configured - Kincho cannot determine allowed vault');
  }
  return vaultAddress as Address;
}

/**
 * Validate that a transaction target is the allowed vault
 * @param targetAddress - Address to validate
 * @returns true if the address matches the allowed vault
 */
export function validateTransactionTarget(targetAddress: Address): boolean {
  const allowedVault = getAllowedVaultAddress();
  return targetAddress.toLowerCase() === allowedVault.toLowerCase();
}

/** Options for creating Kincho wallet client */
export interface KinchoWalletOptions {
  /** Chain to connect to (defaults to DEFAULT_CHAIN_ID) */
  chainId?: number;
  /** RPC URL override (defaults to DEFAULT_RPC_URL) */
  rpcUrl?: string;
}

/**
 * Create a viem wallet client for Kincho
 * This wallet is used for autonomous transaction execution by the Kincho agent.
 *
 * @param options - Optional chain and RPC configuration
 * @returns Configured wallet client for Kincho
 * @throws Error if KINCHO_PRIVATE_KEY is not configured
 */
export function createKinchoWalletClient(options?: KinchoWalletOptions): WalletClient {
  const chainId = options?.chainId ?? DEFAULT_CHAIN_ID;
  const rpcUrl = options?.rpcUrl ?? DEFAULT_RPC_URL;

  const chain = CHAIN_MAP[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const account = getKinchoAccount();

  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Create a viem public client for reading chain state
 *
 * @param options - Optional chain and RPC configuration
 * @returns Configured public client
 */
export function createKinchoPublicClient(options?: KinchoWalletOptions): PublicClient {
  const chainId = options?.chainId ?? DEFAULT_CHAIN_ID;
  const rpcUrl = options?.rpcUrl ?? DEFAULT_RPC_URL;

  const chain = CHAIN_MAP[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Get chain configuration for Kincho operations
 */
export function getKinchoChain(chainId?: number): ViemChain {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  const chain = CHAIN_MAP[id];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${id}`);
  }
  return chain;
}
