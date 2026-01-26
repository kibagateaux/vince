/**
 * @module @bangui/agent/subagents/tx-generator
 * Transaction Generator - builds and simulates deposit transactions
 * @see {@link @bangui/types#UnsignedTransaction}
 */

import type {
  Chain,
  Address,
  BigIntString,
  UnsignedTransaction,
  TransactionSimulation,
} from '@bangui/types';

// ============================================================================
// Constants
// ============================================================================

/** Chain ID mapping */
const CHAIN_IDS: Record<Chain, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
};

/** Default gas estimates by chain */
const DEFAULT_GAS_ESTIMATES: Record<Chain, BigIntString> = {
  ethereum: '100000' as BigIntString,
  polygon: '150000' as BigIntString,
  arbitrum: '200000' as BigIntString,
};

/** deposit(address,uint256) function selector */
const DEPOSIT_SELECTOR = '0x47e7ef24';

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Gets chain ID for a chain
 * @param chain - Chain identifier
 * @returns EVM chain ID
 */
export const getChainId = (chain: Chain): number => CHAIN_IDS[chain];

/**
 * Pads hex string to 32 bytes (64 chars)
 * @param hex - Hex string without 0x prefix
 */
const padTo32Bytes = (hex: string): string => hex.padStart(64, '0');

/**
 * Encodes address for ABI
 * @param address - Ethereum address
 */
const encodeAddress = (address: Address): string =>
  padTo32Bytes(address.slice(2).toLowerCase());

/**
 * Encodes uint256 for ABI
 * @param value - BigInt string value
 */
const encodeUint256 = (value: BigIntString): string => {
  const bn = BigInt(value);
  return padTo32Bytes(bn.toString(16));
};

/**
 * Encodes deposit function call data
 * @param userAddress - Depositor address
 * @param amount - Deposit amount in wei
 * @returns Encoded calldata
 */
export const encodeDepositData = (
  userAddress: Address,
  amount: BigIntString
): `0x${string}` => {
  const encodedAddress = encodeAddress(userAddress);
  const encodedAmount = encodeUint256(amount);
  return `${DEPOSIT_SELECTOR}${encodedAddress}${encodedAmount}` as `0x${string}`;
};

/**
 * Input for building deposit transaction
 */
export interface BuildDepositTxInput {
  /** DAF contract address */
  readonly contractAddress: Address;
  /** User's wallet address */
  readonly userAddress: Address;
  /** Amount to deposit in wei */
  readonly amount: BigIntString;
  /** Target chain */
  readonly chain: Chain;
}

/**
 * Builds unsigned deposit transaction
 * @param input - Transaction parameters
 * @returns Unsigned transaction ready for signing
 */
export const buildDepositTx = (input: BuildDepositTxInput): UnsignedTransaction => ({
  to: input.contractAddress,
  data: encodeDepositData(input.userAddress, input.amount),
  value: input.amount,
  gasEstimate: DEFAULT_GAS_ESTIMATES[input.chain],
  chainId: getChainId(input.chain),
});

/**
 * Large amount threshold for warnings (100 ETH equivalent)
 */
const LARGE_AMOUNT_THRESHOLD = BigInt('100000000000000000000');

/**
 * Simulates transaction execution
 * @param tx - Unsigned transaction
 * @returns Simulation result with success status and warnings
 */
export const simulateTx = async (
  tx: UnsignedTransaction
): Promise<TransactionSimulation> => {
  const warnings: string[] = [];

  // Check for unusually large amounts
  const amount = BigInt(tx.value);
  if (amount > LARGE_AMOUNT_THRESHOLD) {
    warnings.push('Large deposit amount detected. Please verify.');
  }

  // In production, this would call an RPC to simulate
  // For now, return optimistic result
  return {
    success: true,
    gasUsed: tx.gasEstimate,
    warnings,
  };
};

/**
 * Formats amount for display
 * @param amount - Amount in wei
 * @param decimals - Token decimals (default 18)
 * @returns Human-readable amount string
 */
export const formatAmount = (amount: BigIntString, decimals = 18): string => {
  const bn = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = bn / divisor;
  const fraction = bn % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
  return `${whole}.${fractionStr}`;
};

/**
 * Parses amount from human-readable to wei
 * @param amount - Human-readable amount (e.g., "1.5")
 * @param decimals - Token decimals (default 18)
 * @returns Amount in wei as BigIntString
 */
export const parseAmount = (amount: string, decimals = 18): BigIntString => {
  const [whole = '0', fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return `${whole}${paddedFraction}` as BigIntString;
};
