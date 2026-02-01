/**
 * @module useVaultStore
 * React context and hook for vault state management.
 * Provides selected vault, token metadata, and stats across the app.
 */

'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type FC,
  type ReactNode,
} from 'react';
import {
  vaultStoreReducer,
  initialVaultStoreState,
  type VaultStoreState,
  type VaultStats,
  type TokenMetadata,
  getTokenMetadata,
  getVaultAddress,
  getVaultChainId,
  getVaultAllocationInfo,
} from '../lib/vault-store';
import type { VaultMetadata } from '../lib/vaults';
import type { Address } from '@bangui/types';

// ============================================================================
// Context Types
// ============================================================================

interface VaultStoreContextValue extends VaultStoreState {
  /** Select a vault by ID */
  selectVault: (vaultId: string) => void;
  /** Select the primary vault for a chain */
  selectVaultByChain: (chainId: number) => void;
  /** Select a vault by its contract address */
  selectVaultByAddress: (address: Address) => void;
  /** Clear vault selection */
  clearSelection: () => void;
  /** Fetch stats for the selected vault */
  fetchStats: () => Promise<void>;
  /** Get token symbol for the selected vault */
  getSelectedTokenSymbol: () => string;
  /** Get token metadata for the selected vault */
  getSelectedTokenMetadata: () => TokenMetadata | null;
  /** Get vault address for the selected vault */
  getSelectedVaultAddress: () => Address | null;
  /** Get chain ID for the selected vault */
  getSelectedVaultChainId: () => number | null;
  /** Get vault info for allocation requests */
  getSelectedVaultAllocationInfo: () => { vaultAddress: Address | null; chainId: number | null; reserveToken: string };
}

const VaultStoreContext = createContext<VaultStoreContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface VaultStoreProviderProps {
  readonly children: ReactNode;
  /** Initial chain ID to select vault for */
  readonly initialChainId?: number;
}

/**
 * Provider component for vault store context
 */
export const VaultStoreProvider: FC<VaultStoreProviderProps> = ({
  children,
  initialChainId,
}) => {
  const [state, dispatch] = useReducer(vaultStoreReducer, initialVaultStoreState);

  // Select vault by chain on initial load
  useEffect(() => {
    if (initialChainId && !state.selectedVault) {
      dispatch({ type: 'SELECT_VAULT_BY_CHAIN', chainId: initialChainId });
    }
  }, [initialChainId, state.selectedVault]);

  const selectVault = useCallback((vaultId: string) => {
    dispatch({ type: 'SELECT_VAULT', vaultId });
  }, []);

  const selectVaultByChain = useCallback((chainId: number) => {
    dispatch({ type: 'SELECT_VAULT_BY_CHAIN', chainId });
  }, []);

  const selectVaultByAddress = useCallback((address: Address) => {
    dispatch({ type: 'SELECT_VAULT_BY_ADDRESS', address });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const fetchStats = useCallback(async () => {
    if (!state.selectedVault) return;

    dispatch({ type: 'SET_LOADING_STATS', isLoading: true });

    try {
      // TODO: Implement actual API call to fetch vault stats
      // For now, return mock data
      const mockStats: VaultStats = {
        totalDeposits: '1000000000000000000', // 1 ETH
        totalDepositsUsd: 2500,
        depositorCount: 42,
        recentEvents: [],
        lastUpdated: Date.now(),
      };

      dispatch({ type: 'SET_STATS', stats: mockStats });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
      });
    }
  }, [state.selectedVault]);

  const getSelectedTokenSymbol = useCallback((): string => {
    return state.selectedVault?.reserveToken ?? 'ETH';
  }, [state.selectedVault]);

  const getSelectedTokenMetadata = useCallback((): TokenMetadata | null => {
    if (!state.selectedVault) return null;
    return getTokenMetadata(state.selectedVault.reserveToken);
  }, [state.selectedVault]);

  const getSelectedVaultAddress = useCallback((): Address | null => {
    return getVaultAddress(state.selectedVault);
  }, [state.selectedVault]);

  const getSelectedVaultChainId = useCallback((): number | null => {
    return getVaultChainId(state.selectedVault);
  }, [state.selectedVault]);

  const getSelectedVaultAllocationInfo = useCallback(() => {
    return getVaultAllocationInfo(state.selectedVault);
  }, [state.selectedVault]);

  const value: VaultStoreContextValue = {
    ...state,
    selectVault,
    selectVaultByChain,
    selectVaultByAddress,
    clearSelection,
    fetchStats,
    getSelectedTokenSymbol,
    getSelectedTokenMetadata,
    getSelectedVaultAddress,
    getSelectedVaultChainId,
    getSelectedVaultAllocationInfo,
  };

  return (
    <VaultStoreContext.Provider value={value}>
      {children}
    </VaultStoreContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access vault store state and actions
 * @throws Error if used outside VaultStoreProvider
 */
export const useVaultStore = (): VaultStoreContextValue => {
  const context = useContext(VaultStoreContext);
  if (!context) {
    throw new Error('useVaultStore must be used within a VaultStoreProvider');
  }
  return context;
};

/**
 * Hook to get just the selected vault (convenience wrapper)
 */
export const useSelectedVault = (): VaultMetadata | null => {
  const { selectedVault } = useVaultStore();
  return selectedVault;
};

/**
 * Hook to get the selected token symbol
 */
export const useSelectedTokenSymbol = (): string => {
  const { getSelectedTokenSymbol } = useVaultStore();
  return getSelectedTokenSymbol();
};

/**
 * Hook to get token metadata for the selected vault
 */
export const useSelectedTokenMetadata = (): TokenMetadata | null => {
  const { getSelectedTokenMetadata } = useVaultStore();
  return getSelectedTokenMetadata();
};

/**
 * Hook to get the vault address for the selected vault
 */
export const useSelectedVaultAddress = (): Address | null => {
  const { getSelectedVaultAddress } = useVaultStore();
  return getSelectedVaultAddress();
};

/**
 * Hook to get allocation info for the selected vault
 * Useful for creating allocation requests with proper vault context
 */
export const useVaultAllocationInfo = (): {
  vaultAddress: Address | null;
  chainId: number | null;
  reserveToken: string;
} => {
  const { getSelectedVaultAllocationInfo } = useVaultStore();
  return getSelectedVaultAllocationInfo();
};
