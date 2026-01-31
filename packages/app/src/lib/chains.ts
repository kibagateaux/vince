/**
 * @module chains
 * Chain configuration and utilities for wallet network management.
 */

import { mainnet, sepolia, polygon, arbitrum, base, baseSepolia, type Chain as ViemChain } from 'viem/chains';
import {
  Chain,
  CHAIN_ID_TO_NAME as SHARED_CHAIN_ID_TO_NAME,
  CHAIN_NAME_TO_ID as SHARED_CHAIN_NAME_TO_ID,
  CHAIN_DISPLAY_NAMES,
  getChainName,
} from '@bangui/types';

// Re-export from types for convenience
export { Chain, CHAIN_DISPLAY_NAMES, getChainName };
export const CHAIN_ID_TO_NAME = SHARED_CHAIN_ID_TO_NAME;
export const CHAIN_NAME_TO_ID = SHARED_CHAIN_NAME_TO_ID;

/** Viem chain configuration map */
export const CHAIN_MAP: Record<number, ViemChain> = {
  1: mainnet,
  137: polygon,
  42161: arbitrum,
  8453: base,
  11155111: sepolia,
  84532: baseSepolia,
};

/**
 * Default chain ID from environment variable.
 * Falls back to Sepolia (11155111) if not set.
 */
export const DEFAULT_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? '11155111',
  10
);

/**
 * Default RPC URL from environment variable.
 * Falls back to publicnode which has no rate limits (unlike Alchemy demo).
 */
export const DEFAULT_RPC_URL = process.env.NEXT_PUBLIC_DEFAULT_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

/**
 * Get the default chain configuration.
 */
export const getDefaultChain = (): ViemChain => {
  return CHAIN_MAP[DEFAULT_CHAIN_ID] ?? sepolia;
};

/**
 * Get the default chain name.
 */
export const getDefaultChainName = (): Chain => {
  return CHAIN_ID_TO_NAME[DEFAULT_CHAIN_ID] ?? Chain.SEPOLIA;
};

/**
 * Check if a chain ID matches the default chain.
 */
export const isDefaultChain = (chainId: number): boolean => {
  return chainId === DEFAULT_CHAIN_ID;
};

/**
 * Get chain display name for UI.
 */
export const getChainDisplayName = (chainId: number): string => {
  const chainName = getChainName(chainId);
  if (chainName) {
    return CHAIN_DISPLAY_NAMES[chainName];
  }
  const chain = CHAIN_MAP[chainId];
  return chain?.name ?? `Chain ${chainId}`;
};
