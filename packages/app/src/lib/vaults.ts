/**
 * @module vaults
 * Static vault configuration with chain metadata for initiatives/causes.
 * Each vault is deployed on a specific chain and supports certain cause categories.
 */

import { Chain, CHAIN_NAME_TO_ID, CHAIN_DISPLAY_NAMES, getTokenDecimals, type Address } from '@bangui/types';

export interface VaultMetadata {
  /** Unique vault identifier */
  readonly id: string;
  /** Human-readable vault name */
  readonly name: string;
  /** Chain the vault is deployed on */
  readonly chain: Chain;
  /** Chain ID for quick lookup */
  readonly chainId: number;
  /** Vault contract address */
  readonly address: Address;
  /** Reserve token symbol (e.g., WETH, USDC) */
  readonly reserveToken: string;
  /** Cause categories this vault supports */
  readonly supportedCauses: readonly string[];
  /** Whether this is the primary vault for its chain */
  readonly isPrimary: boolean;
  /** Minimum deposit amount in human-readable format */
  readonly minDeposit: string;
  /** Optional description */
  readonly description?: string;
}

/**
 * Static vault configurations.
 * Add new vaults here as they are deployed.
 */
export const VAULTS: readonly VaultMetadata[] = [
  // Sepolia Testnet - WBTC Vault (Primary for testing WBTC)
  {
    id: 'sepolia-wbtc',
    name: 'Sepolia WBTC Vault',
    chain: Chain.SEPOLIA,
    chainId: CHAIN_NAME_TO_ID[Chain.SEPOLIA],
    address: (process.env.NEXT_PUBLIC_DAF_CONTRACT_SEPOLIA_WBTC ?? '0x0000000000000000000000000000000000000000') as Address,
    reserveToken: 'WBTC',
    supportedCauses: ['global_health', 'education', 'environment', 'economic_empowerment', 'climate'],
    isPrimary: true,
    minDeposit: '0.0001',
    description: 'WBTC test vault on Sepolia',
  },
  // Sepolia Testnet - ETH Vault
  // Falls back to DAF_CONTRACT_ADDRESS for backwards compatibility
  {
    id: 'sepolia-main',
    name: 'Sepolia DAF Vault',
    chain: Chain.SEPOLIA,
    chainId: CHAIN_NAME_TO_ID[Chain.SEPOLIA],
    address: (process.env.NEXT_PUBLIC_DAF_CONTRACT_SEPOLIA ?? process.env.DAF_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
    reserveToken: 'ETH',
    supportedCauses: ['global_health', 'education', 'environment', 'economic_empowerment', 'policy_advocacy', 'local_community', 'arts_culture', 'climate'],
    isPrimary: false,
    minDeposit: '0.001',
    description: 'Test vault on Sepolia for development and testing',
  },
  // Base Sepolia Testnet
  {
    id: 'base-sepolia-main',
    name: 'Base Sepolia DAF Vault',
    chain: Chain.BASE_SEPOLIA,
    chainId: CHAIN_NAME_TO_ID[Chain.BASE_SEPOLIA],
    address: (process.env.NEXT_PUBLIC_DAF_CONTRACT_BASE_SEPOLIA ?? '0x0000000000000000000000000000000000000000') as Address,
    reserveToken: 'ETH',
    supportedCauses: ['global_health', 'education', 'environment', 'climate'],
    isPrimary: true,
    minDeposit: '0.001',
    description: 'Test vault on Base Sepolia',
  },
  // Base Mainnet
  {
    id: 'base-main',
    name: 'Base DAF Vault',
    chain: Chain.BASE,
    chainId: CHAIN_NAME_TO_ID[Chain.BASE],
    address: (process.env.NEXT_PUBLIC_DAF_CONTRACT_BASE ?? '0x0000000000000000000000000000000000000000') as Address,
    reserveToken: 'ETH',
    supportedCauses: ['global_health', 'education', 'environment', 'economic_empowerment', 'climate'],
    isPrimary: true,
    minDeposit: '0.01',
    description: 'Primary vault on Base',
  },
  // Ethereum Mainnet
  {
    id: 'ethereum-main',
    name: 'Ethereum DAF Vault',
    chain: Chain.ETHEREUM,
    chainId: CHAIN_NAME_TO_ID[Chain.ETHEREUM],
    address: (process.env.NEXT_PUBLIC_DAF_CONTRACT_ETHEREUM ?? '0x0000000000000000000000000000000000000000') as Address,
    reserveToken: 'ETH',
    supportedCauses: ['global_health', 'education', 'environment', 'economic_empowerment', 'policy_advocacy', 'local_community', 'arts_culture', 'climate'],
    isPrimary: true,
    minDeposit: '0.1',
    description: 'Primary vault on Ethereum mainnet',
  },
] as const;

/**
 * Get all vaults for a specific chain.
 */
export const getVaultsByChain = (chain: Chain): readonly VaultMetadata[] => {
  return VAULTS.filter(v => v.chain === chain);
};

/**
 * Get all vaults for a specific chain ID.
 */
export const getVaultsByChainId = (chainId: number): readonly VaultMetadata[] => {
  return VAULTS.filter(v => v.chainId === chainId);
};

/**
 * Get the primary vault for a chain.
 */
export const getPrimaryVault = (chain: Chain): VaultMetadata | undefined => {
  return VAULTS.find(v => v.chain === chain && v.isPrimary);
};

/**
 * Get the primary vault for a chain ID.
 */
export const getPrimaryVaultByChainId = (chainId: number): VaultMetadata | undefined => {
  return VAULTS.find(v => v.chainId === chainId && v.isPrimary);
};

/**
 * Get a vault by its ID.
 */
export const getVaultById = (id: string): VaultMetadata | undefined => {
  return VAULTS.find(v => v.id === id);
};

/**
 * Get a vault by its address.
 */
export const getVaultByAddress = (address: Address): VaultMetadata | undefined => {
  return VAULTS.find(v => v.address.toLowerCase() === address.toLowerCase());
};

/**
 * Get vaults that support a specific cause category.
 */
export const getVaultsByCause = (cause: string): readonly VaultMetadata[] => {
  return VAULTS.filter(v => v.supportedCauses.includes(cause));
};

/**
 * Separate vaults by current chain vs other chains.
 * Returns vaults on the current chain first, then others.
 */
export const separateVaultsByCurrentChain = (
  currentChainId: number,
  filterCauses?: readonly string[]
): { currentChain: readonly VaultMetadata[]; otherChains: readonly VaultMetadata[] } => {
  let vaults = VAULTS;

  // Filter by causes if provided
  if (filterCauses && filterCauses.length > 0) {
    vaults = vaults.filter(v =>
      filterCauses.some(cause => v.supportedCauses.includes(cause))
    );
  }

  const currentChain = vaults.filter(v => v.chainId === currentChainId);
  const otherChains = vaults.filter(v => v.chainId !== currentChainId);

  return { currentChain, otherChains };
};

/**
 * Get the display name for a vault's chain.
 */
export const getVaultChainDisplayName = (vault: VaultMetadata): string => {
  return CHAIN_DISPLAY_NAMES[vault.chain];
};

/**
 * Get vaults that support a specific reserve token.
 */
export const getVaultsByToken = (token: string): readonly VaultMetadata[] => {
  const normalizedToken = token.toUpperCase();
  return VAULTS.filter(v => v.reserveToken.toUpperCase() === normalizedToken);
};

/**
 * Find the best vault for a user based on their preferences.
 * Priority: 1) Matching token on user's chain, 2) Primary vault on user's chain, 3) Any vault with matching token
 */
export const findBestVault = (
  userChainId: number,
  preferredToken?: string,
  preferredCauses?: readonly string[]
): VaultMetadata | undefined => {
  // Get all vaults on user's chain
  const chainVaults = getVaultsByChainId(userChainId);

  // If user specified a token, try to find a vault on their chain with that token
  if (preferredToken) {
    const normalizedToken = preferredToken.toUpperCase();

    // First: vault on user's chain with matching token
    const matchOnChain = chainVaults.find(v => v.reserveToken.toUpperCase() === normalizedToken);
    if (matchOnChain) return matchOnChain;

    // Second: any vault with matching token (user might need to switch chains)
    const matchAnyChain = VAULTS.find(v => v.reserveToken.toUpperCase() === normalizedToken);
    if (matchAnyChain) return matchAnyChain;
  }

  // If user specified causes, try to find a vault that supports them
  if (preferredCauses && preferredCauses.length > 0) {
    const matchingCauseVault = chainVaults.find(v =>
      preferredCauses.some(cause => v.supportedCauses.includes(cause))
    );
    if (matchingCauseVault) return matchingCauseVault;
  }

  // Fall back to primary vault on user's chain
  return getPrimaryVaultByChainId(userChainId);
};

/**
 * Validates that a deposit amount meets the vault's minimum requirement.
 * Compares amounts using token decimals for accurate comparison.
 *
 * @param vault - The vault to deposit into
 * @param humanAmount - The deposit amount in human-readable format (e.g., "0.001")
 * @returns Object with isValid boolean and error message if invalid
 */
export const validateMinimumDeposit = (
  vault: VaultMetadata,
  humanAmount: string
): { isValid: boolean; error?: string } => {
  const decimals = getTokenDecimals(vault.reserveToken);
  const minDeposit = vault.minDeposit;

  // Convert both amounts to smallest unit for accurate comparison
  const parseToSmallestUnit = (amount: string, dec: number): bigint => {
    const [whole = '0', fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(dec, '0').slice(0, dec);
    return BigInt(whole + paddedFraction);
  };

  const depositAmountSmallest = parseToSmallestUnit(humanAmount, decimals);
  const minDepositSmallest = parseToSmallestUnit(minDeposit, decimals);

  if (depositAmountSmallest < minDepositSmallest) {
    return {
      isValid: false,
      error: `Deposit amount ${humanAmount} ${vault.reserveToken} is below the minimum deposit of ${minDeposit} ${vault.reserveToken} for ${vault.name}.`,
    };
  }

  return { isValid: true };
};

/**
 * Gets the minimum deposit amount for a vault in human-readable format.
 *
 * @param vault - The vault to get minimum deposit for
 * @returns Minimum deposit string with token symbol (e.g., "0.0001 WBTC")
 */
export const getMinimumDepositDisplay = (vault: VaultMetadata): string => {
  return `${vault.minDeposit} ${vault.reserveToken}`;
};
