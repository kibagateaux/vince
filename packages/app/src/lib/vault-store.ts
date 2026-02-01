/**
 * @module vault-store
 * Vault state management for tracking selected vault, token metadata, and stats.
 * Provides a centralized store for vault-related data used across the app.
 */

import type { Address, Chain } from '@bangui/types';
import { VAULTS, type VaultMetadata, getVaultById, getPrimaryVaultByChainId } from './vaults';

// ============================================================================
// Token Metadata Types
// ============================================================================

/** Token metadata for reserve tokens */
export interface TokenMetadata {
  /** Token symbol (e.g., ETH, WBTC, USDC) */
  readonly symbol: string;
  /** Token name (e.g., Wrapped Bitcoin) */
  readonly name: string;
  /** Token decimals */
  readonly decimals: number;
  /** Token contract address (null for native tokens) */
  readonly address: Address | null;
  /** Token logo URL */
  readonly logoUrl?: string;
  /** Current USD price (updated periodically) */
  readonly usdPrice?: number;
}

/** Known token metadata registry */
export const TOKEN_METADATA: Record<string, TokenMetadata> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    address: null,
    logoUrl: '/tokens/eth.svg',
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
    logoUrl: '/tokens/weth.svg',
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Address,
    logoUrl: '/tokens/wbtc.svg',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    logoUrl: '/tokens/usdc.svg',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address,
    logoUrl: '/tokens/usdt.svg',
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    address: '0x6B175474E89094C44Da98b954EescdeCB5BB' as Address,
    logoUrl: '/tokens/dai.svg',
  },
} as const;

// ============================================================================
// Vault Stats Types
// ============================================================================

/** Vault deposit event */
export interface VaultEvent {
  readonly id: string;
  readonly type: 'deposit' | 'withdrawal' | 'allocation';
  readonly amount: string;
  readonly token: string;
  readonly userAddress: Address;
  readonly txHash: string;
  readonly timestamp: number;
  readonly usdValue?: number;
}

/** Vault summary statistics */
export interface VaultStats {
  /** Total deposits in the vault (in token units) */
  readonly totalDeposits: string;
  /** Total deposits in USD */
  readonly totalDepositsUsd: number;
  /** Total number of depositors */
  readonly depositorCount: number;
  /** Last 50 events */
  readonly recentEvents: readonly VaultEvent[];
  /** Last updated timestamp */
  readonly lastUpdated: number;
}

// ============================================================================
// Vault Store State
// ============================================================================

/** Complete vault store state */
export interface VaultStoreState {
  /** All available vaults */
  readonly vaults: readonly VaultMetadata[];
  /** Currently selected vault (null if none selected) */
  readonly selectedVault: VaultMetadata | null;
  /** Token metadata for the selected vault's reserve token */
  readonly selectedTokenMetadata: TokenMetadata | null;
  /** Stats for the selected vault */
  readonly selectedVaultStats: VaultStats | null;
  /** Loading state for stats */
  readonly isLoadingStats: boolean;
  /** Error message if any */
  readonly error: string | null;
}

/** Initial vault store state */
export const initialVaultStoreState: VaultStoreState = {
  vaults: VAULTS,
  selectedVault: null,
  selectedTokenMetadata: null,
  selectedVaultStats: null,
  isLoadingStats: false,
  error: null,
};

// ============================================================================
// Vault Store Actions
// ============================================================================

export type VaultStoreAction =
  | { type: 'SELECT_VAULT'; vaultId: string }
  | { type: 'SELECT_VAULT_BY_CHAIN'; chainId: number }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_STATS'; stats: VaultStats }
  | { type: 'SET_LOADING_STATS'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'UPDATE_TOKEN_PRICE'; symbol: string; price: number };

/**
 * Gets token metadata for a reserve token symbol
 */
export const getTokenMetadata = (symbol: string): TokenMetadata => {
  const upperSymbol = symbol.toUpperCase();
  return TOKEN_METADATA[upperSymbol] ?? {
    symbol: upperSymbol,
    name: upperSymbol,
    decimals: 18,
    address: null,
  };
};

/**
 * Vault store reducer
 */
export const vaultStoreReducer = (
  state: VaultStoreState,
  action: VaultStoreAction
): VaultStoreState => {
  switch (action.type) {
    case 'SELECT_VAULT': {
      const vault = getVaultById(action.vaultId);
      if (!vault) {
        return { ...state, error: `Vault not found: ${action.vaultId}` };
      }
      const tokenMetadata = getTokenMetadata(vault.reserveToken);
      return {
        ...state,
        selectedVault: vault,
        selectedTokenMetadata: tokenMetadata,
        selectedVaultStats: null,
        error: null,
      };
    }

    case 'SELECT_VAULT_BY_CHAIN': {
      const vault = getPrimaryVaultByChainId(action.chainId);
      if (!vault) {
        return { ...state, error: `No vault for chain ID: ${action.chainId}` };
      }
      const tokenMetadata = getTokenMetadata(vault.reserveToken);
      return {
        ...state,
        selectedVault: vault,
        selectedTokenMetadata: tokenMetadata,
        selectedVaultStats: null,
        error: null,
      };
    }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedVault: null,
        selectedTokenMetadata: null,
        selectedVaultStats: null,
        error: null,
      };

    case 'SET_STATS':
      return {
        ...state,
        selectedVaultStats: action.stats,
        isLoadingStats: false,
      };

    case 'SET_LOADING_STATS':
      return { ...state, isLoadingStats: action.isLoading };

    case 'SET_ERROR':
      return { ...state, error: action.error, isLoadingStats: false };

    case 'UPDATE_TOKEN_PRICE': {
      if (!state.selectedTokenMetadata || state.selectedTokenMetadata.symbol !== action.symbol) {
        return state;
      }
      return {
        ...state,
        selectedTokenMetadata: {
          ...state.selectedTokenMetadata,
          usdPrice: action.price,
        },
      };
    }

    default:
      return state;
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the reserve token symbol for a vault
 */
export const getVaultTokenSymbol = (vault: VaultMetadata | null): string => {
  return vault?.reserveToken ?? 'ETH';
};

/**
 * Gets token decimals for a symbol
 */
export const getTokenDecimals = (symbol: string): number => {
  const metadata = getTokenMetadata(symbol);
  return metadata.decimals;
};

/**
 * Formats a token amount for display
 */
export const formatTokenAmount = (
  amount: string | bigint,
  symbol: string,
  maxDecimals = 4
): string => {
  const decimals = getTokenDecimals(symbol);
  const bn = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = bn / divisor;
  const fraction = bn % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, maxDecimals);

  // Remove trailing zeros
  const cleanFraction = fractionStr.replace(/0+$/, '');

  if (cleanFraction) {
    return `${whole}.${cleanFraction} ${symbol}`;
  }
  return `${whole} ${symbol}`;
};

/**
 * Parses a human-readable amount to wei/smallest unit
 */
export const parseTokenAmount = (amount: string, symbol: string): bigint => {
  const decimals = getTokenDecimals(symbol);
  const [whole = '0', fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`);
};
