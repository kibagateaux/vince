/**
 * @module protocol
 * Protocol interaction library for AiETH vault contracts.
 * Supports vault operations, formatting, and contract calls.
 */

import type { PublicClient, Abi, ContractFunctionParameters } from 'viem';
import type { Address, TxHash, BigIntString, UnsignedTransaction } from '@bangui/types';

// Re-export commonly used types from @bangui/types
export type { Address, TxHash, BigIntString, UnsignedTransaction };

// ============================================================================
// Error Handling
// ============================================================================

export const ProtocolErrorCode = {
  VAULT_NOT_FOUND: 'VAULT_NOT_FOUND',
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  BELOW_MIN_DEPOSIT: 'BELOW_MIN_DEPOSIT',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE: 'INSUFFICIENT_ALLOWANCE',
  HEALTH_FACTOR_RISK: 'HEALTH_FACTOR_RISK',
  NOT_TREASURY: 'NOT_TREASURY',
  CONTRACT_CALL_FAILED: 'CONTRACT_CALL_FAILED',
  SNAPSHOT_API_ERROR: 'SNAPSHOT_API_ERROR',
} as const;

export type ProtocolErrorCode =
  (typeof ProtocolErrorCode)[keyof typeof ProtocolErrorCode];

export class ProtocolError extends Error {
  public readonly code: ProtocolErrorCode;

  constructor(message: string, code: ProtocolErrorCode) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

// ============================================================================
// Constants
// ============================================================================

export const PROTOCOL_CONSTANTS = {
  /** Default FUN_OPS address (to be overridden per deployment) */
  FUN_OPS: '0x0000000000000000000000000000000000000000' as Address,
  /** Minimum deposit amount in reserve token units (100 gwei) */
  MIN_DEPOSIT: 100_000_000n,
  /** Minimum health factor required for redemptions */
  MIN_REDEEM_FACTOR: 2,
  /** Minimum health factor to maintain in reserves */
  MIN_RESERVE_FACTOR: 8,
  /** Basis points coefficient (100% = 10000 bps) */
  BPS_COEFFICIENT: 10_000,
  /** Aave referral code for protocol */
  AAVE_REFERRAL_CODE: 200,
  /** Chainlink/Aave price oracle decimals */
  AAVE_PRICE_DECIMALS: 8,
  /** Default Snapshot Hub GraphQL URL */
  SNAPSHOT_HUB_URL: 'https://hub.snapshot.org/graphql',
  /** Maximum uint256 value for unlimited approvals */
  MAX_UINT256: 2n ** 256n - 1n,
} as const;

export const VAULT_EVENT_SIGNATURES = {
  Deposit: 'Deposit(address,address,uint256,address,address)',
  Withdrawal: 'Withdrawal(address,address,uint256)',
  Farm: 'Farm(address,address,uint256)',
  PullReserves: 'PullReserves(address,uint256)',
  Lend: 'Lend(address,address,address,uint256)',
} as const;

export const CHAIN_IDS = {
  ETHEREUM: 1,
  POLYGON: 137,
  ARBITRUM: 42161,
  BASE: 8453,
  SEPOLIA: 11155111,
} as const;

// ============================================================================
// Protocol Types
// ============================================================================

/** Configuration for a single vault instance */
export interface VaultConfig {
  name: string;
  address: Address;
  chainId: number;
  reserveToken: Address;
  reserveSymbol: string;
  reserveDecimals: number;
  snapshotSpace?: string;
}

/** Collateral health metrics from Aave */
export interface CollateralHealth {
  currentHF: number;
  minRedeemHF: number;
  minReserveHF: number;
  ltvBps: number;
  liquidationThresholdBps: number;
  totalCreditDelegated: bigint;
  totalDebtBaseUsd: bigint;
  totalCollateralBaseUsd: bigint;
  healthFactor: bigint;
  availableBorrowsBaseUsd: bigint;
}

/** Vault metadata from contract */
export interface VaultMeta {
  name: string;
  symbol: string;
  decimals: number;
  reserveToken: Address;
  aToken: Address;
  debtToken: Address;
  debtAsset: Address;
  aaveMarket: Address;
}

/** Complete vault summary */
export interface VaultSummary {
  totalDeposits: bigint;
  totalDepositsFormatted: string;
  totalDepositsUsd: string;
  yieldEarned: bigint;
  yieldEarnedFormatted: string;
  yieldEarnedUsd: string;
  totalUnderlying: bigint;
  totalUnderlyingFormatted: string;
  reservePriceUsd: bigint;
  reservePriceFormatted: string;
  collateral: CollateralHealth;
  meta: VaultMeta;
}

/** User's position in a vault */
export interface UserPosition {
  balance: bigint;
  balanceFormatted: string;
  balanceUsd: string;
  shareOfVault: number;
  yieldEarned: bigint;
  yieldEarnedFormatted: string;
  yieldEarnedUsd: string;
}

/** Deposit event from contract logs */
export interface DepositEvent {
  type: 'deposit';
  txHash: TxHash;
  blockNumber: bigint;
  timestamp: number;
  depositor: Address;
  receiver: Address;
  amount: bigint;
  amountFormatted: string;
  city: Address;
  referrer: Address;
}

/** Withdrawal event from contract logs */
export interface WithdrawalEvent {
  type: 'withdrawal';
  txHash: TxHash;
  blockNumber: bigint;
  timestamp: number;
  owner: Address;
  to: Address;
  amount: bigint;
  amountFormatted: string;
}

/** User's complete history in a vault */
export interface UserHistory {
  deposits: DepositEvent[];
  withdrawals: WithdrawalEvent[];
  totalDeposited: bigint;
  totalDepositedFormatted: string;
  totalWithdrawn: bigint;
  totalWithdrawnFormatted: string;
  netDeposited: bigint;
  netDepositedFormatted: string;
}

/** Parameters for deposit operations */
export interface DepositParams {
  amount: bigint;
  receiver?: Address;
  city?: Address;
  referrer?: Address;
  approveSpender?: Address;
}

/** Result of deposit preparation */
export interface DepositResult {
  approveTx: UnsignedTransaction | null;
  depositTx: UnsignedTransaction;
}

/** Parameters for withdraw operations */
export interface WithdrawParams {
  amount: bigint;
  to?: Address;
}

/** Credit allocation status for a city */
export interface CreditAllocation {
  city: Address;
  creditAmount: bigint;
  creditAmountFormatted: string;
  borrowAllowance: bigint;
  borrowAllowanceFormatted: string;
  amountBorrowed: bigint;
  amountBorrowedFormatted: string;
}

/** Aggregate statistics across all vaults */
export interface AggregateStats {
  totalDepositsUsd: string;
  totalYieldUsd: string;
  vaults: Record<string, VaultSummary>;
}

/** Configuration for a single contract function call */
export interface ContractCallConfig {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format raw token amount to human-readable string.
 * @example formatTokenAmount(1500000000000000000n, 18) // "1.5000"
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals: number = 4
): string {
  if (decimals < 0) throw new Error('Decimals must be non-negative');

  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  const isNegative = amount < 0n;
  const absWhole = isNegative ? -whole : whole;
  const absFraction = isNegative ? -fraction : fraction;

  const fractionStr = absFraction
    .toString()
    .padStart(decimals, '0')
    .slice(0, displayDecimals);

  const wholeFormatted = absWhole.toLocaleString('en-US');
  const sign = isNegative ? '-' : '';

  return displayDecimals > 0
    ? `${sign}${wholeFormatted}.${fractionStr}`
    : `${sign}${wholeFormatted}`;
}

/**
 * Parse human-readable amount to raw bigint.
 * @example parseTokenAmount("1.5", 18) // 1500000000000000000n
 */
export function parseTokenAmount(humanAmount: string, decimals: number): bigint {
  if (decimals < 0) throw new Error('Decimals must be non-negative');

  const cleaned = humanAmount.replace(/,/g, '').trim();
  const isNegative = cleaned.startsWith('-');
  const absAmount = isNegative ? cleaned.slice(1) : cleaned;
  const [whole = '0', fraction = ''] = absAmount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);

  if (!/^\d+$/.test(whole) || !/^\d*$/.test(paddedFraction)) {
    throw new Error(`Invalid amount format: ${humanAmount}`);
  }

  const result = BigInt(whole + paddedFraction);
  return isNegative ? -result : result;
}

/**
 * General number formatter with locale.
 * @example formatNumber(1234567) // "1,234,567"
 */
export function formatNumber(
  n: number | bigint,
  opts?: Intl.NumberFormatOptions
): string {
  return Number(n).toLocaleString('en-US', opts);
}

/**
 * Format a percentage value.
 * @example formatPercent(0.1234) // "12.34%"
 */
export function formatPercent(
  value: number,
  decimalPlaces: number = 2,
  isPercentage: boolean = false
): string {
  const percentValue = isPercentage ? value : value * 100;
  return `${percentValue.toFixed(decimalPlaces)}%`;
}

/**
 * Truncate an address for display.
 * @example truncateAddress("0x1234...") // "0x1234...5678"
 */
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// ============================================================================
// Decimal Conversion Utilities
// ============================================================================

/**
 * Convert between decimal representations.
 * @example convertToDecimal(1000000n, 6, 18) // 1000000000000000000n
 */
export function convertToDecimal(
  amount: bigint,
  currentDecimals: number,
  targetDecimals: number
): bigint {
  if (currentDecimals < 0 || targetDecimals < 0) {
    throw new Error('Decimals must be non-negative');
  }
  if (currentDecimals === targetDecimals) return amount;

  if (currentDecimals > targetDecimals) {
    const scaleFactor = 10n ** BigInt(currentDecimals - targetDecimals);
    return amount / scaleFactor;
  } else {
    const scaleFactor = 10n ** BigInt(targetDecimals - currentDecimals);
    return amount * scaleFactor;
  }
}

/** Scale amount to 18 decimals. */
export function scaleToBase(
  amount: bigint,
  decimals: number,
  baseDecimals: number = 18
): bigint {
  return convertToDecimal(amount, decimals, baseDecimals);
}

/** Scale amount from 18 decimals to native decimals. */
export function scaleFromBase(
  amount: bigint,
  decimals: number,
  baseDecimals: number = 18
): bigint {
  return convertToDecimal(amount, baseDecimals, decimals);
}

/**
 * Calculate percentage of an amount in basis points.
 * @example percentBps(1000n, 500) // 50n (5% of 1000)
 */
export function percentBps(amount: bigint, basisPoints: number): bigint {
  return (amount * BigInt(basisPoints)) / 10000n;
}

/**
 * Convert basis points to a decimal multiplier.
 * @example bpsToMultiplier(500, 18) // 50000000000000000n (0.05 with 18 decimals)
 */
export function bpsToMultiplier(
  basisPoints: number,
  precision: number = 18
): bigint {
  return (BigInt(basisPoints) * 10n ** BigInt(precision)) / 10000n;
}

// ============================================================================
// USD Price Utilities
// ============================================================================

/**
 * Compute USD value of a token amount.
 * @example computeUsdValue(1000000000000000000n, 300000000000n, 18) // 300000000000n ($3000)
 */
export function computeUsdValue(
  tokenAmount: bigint,
  priceUsd8Dec: bigint,
  tokenDecimals: number
): bigint {
  return (tokenAmount * priceUsd8Dec) / 10n ** BigInt(tokenDecimals);
}

/**
 * Format a USD amount to human readable string.
 * @example formatUsd(1500000000000000000n, 300000000000n, 18) // "$4,500.00"
 */
export function formatUsd(
  tokenAmount: bigint,
  priceUsd8Dec: bigint,
  tokenDecimals: number
): string {
  const usdRaw = computeUsdValue(tokenAmount, priceUsd8Dec, tokenDecimals);
  const usdFloat = Number(usdRaw) / 1e8;
  return (
    '$' +
    usdFloat.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Format a raw USD value (8 decimals) to human readable string.
 * @example formatUsdRaw(382741322000000n) // "$3,827,413.22"
 */
export function formatUsdRaw(usdRaw8Dec: bigint): string {
  const usdFloat = Number(usdRaw8Dec) / 1e8;
  return (
    '$' +
    usdFloat.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Format a Chainlink 8-decimal price to human readable string.
 * @example formatTokenPrice(310241000000n) // "$3,102.41"
 */
export function formatTokenPrice(priceUsd8Dec: bigint): string {
  const priceFloat = Number(priceUsd8Dec) / 1e8;
  return (
    '$' +
    priceFloat.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Parse a USD string back to 8-decimal bigint.
 * @example parseUsd("$1,234.56") // 123456000000n
 */
export function parseUsd(usdString: string): bigint {
  const cleaned = usdString.replace(/[$,]/g, '').trim();
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const paddedFraction = fraction.padEnd(8, '0').slice(0, 8);
  return BigInt(whole + paddedFraction);
}

// ============================================================================
// Multicall Utilities
// ============================================================================

/**
 * Batch multiple contract calls using multicall3.
 * Falls back to sequential calls if multicall3 is unavailable.
 */
export async function batchCalls(
  publicClient: PublicClient,
  calls: readonly ContractCallConfig[]
): Promise<readonly unknown[]> {
  try {
    const results = await publicClient.multicall({
      contracts: calls.map((call) => ({
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args ?? [],
      })) as ContractFunctionParameters[],
      allowFailure: true,
    });

    return results.map((result, i) => {
      if (result.status === 'failure') {
        throw new ProtocolError(
          `Contract call failed: ${calls[i]?.functionName} at ${calls[i]?.address}: ${result.error}`,
          ProtocolErrorCode.CONTRACT_CALL_FAILED
        );
      }
      return result.result;
    });
  } catch (err) {
    if (err instanceof ProtocolError) throw err;

    // Fallback: sequential calls
    const results: unknown[] = [];
    for (const call of calls) {
      const result = await publicClient.readContract({
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args ?? [],
      } as any);
      results.push(result);
    }
    return results;
  }
}

/**
 * Execute multiple contract calls in parallel without multicall.
 */
export async function parallelCalls(
  publicClient: PublicClient,
  calls: readonly ContractCallConfig[]
): Promise<readonly unknown[]> {
  const promises = calls.map((call) =>
    publicClient.readContract({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args ?? [],
    } as any)
  );
  return Promise.all(promises);
}

/**
 * Execute a single contract read with error wrapping.
 */
export async function singleCall(
  publicClient: PublicClient,
  call: ContractCallConfig
): Promise<unknown> {
  try {
    return await publicClient.readContract({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args ?? [],
    } as any);
  } catch (err) {
    throw new ProtocolError(
      `Contract call failed: ${call.functionName} at ${call.address}: ${err}`,
      ProtocolErrorCode.CONTRACT_CALL_FAILED
    );
  }
}

// ============================================================================
// Contract ABIs
// ============================================================================

/** AiETH contract ABI */
export const aiETHAbi = [
  // View: Token metadata
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },

  // View: ERC20 standard
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },

  // View: Protocol state
  { name: 'reserveToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'aaveMarket', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'aToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'debtToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'totalCreditDelegated', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'credited', type: 'function', stateMutability: 'view', inputs: [{ name: 'city', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'reserveVsATokenDecimalOffset', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'debtTokenDecimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },

  // View: Constants
  { name: 'FUN_OPS', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'MIN_DEPOSIT', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },
  { name: 'MIN_REDEEM_FACTOR', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'MIN_RESERVE_FACTOR', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'BPS_COEFFICIENT', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },

  // View: Computed
  { name: 'underlying', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getYieldEarned', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getExpectedHF', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'price', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'reserveAssetPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'debtAssetPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'convertToDecimal', type: 'function', stateMutability: 'pure', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'currentDecimals', type: 'uint8' }, { name: 'targetDecimals', type: 'uint8' }], outputs: [{ type: 'uint256' }] },

  // Write: User deposit
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dubloons', type: 'uint256' }], outputs: [] },
  { name: 'depositOnBehalfOf', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dubloons', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'referrer', type: 'address' }], outputs: [] },
  { name: 'depositWithPreference', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dubloons', type: 'uint256' }, { name: 'city', type: 'address' }, { name: 'referrer', type: 'address' }], outputs: [] },
  { name: 'depositAndApprove', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'dubloons', type: 'uint256' }], outputs: [] },

  // Write: User withdraw
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dubloons', type: 'uint256' }], outputs: [] },
  { name: 'withdrawTo', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dubloons', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [] },

  // Write: ERC20
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'increaseAllowance', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'addedValue', type: 'uint256' }], outputs: [{ type: 'bool' }] },

  // Write: Admin
  { name: 'allocate', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'city', type: 'address' }, { name: 'dubloons', type: 'uint256' }], outputs: [] },
  { name: 'pullReserves', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dubloons', type: 'uint256' }], outputs: [] },
  { name: 'farm', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dubloons', type: 'uint256' }], outputs: [] },
  { name: 'recoverTokens', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },

  // Events
  { name: 'Deposit', type: 'event', inputs: [{ name: 'mate', type: 'address', indexed: true }, { name: 'receiver', type: 'address', indexed: true }, { name: 'dubloons', type: 'uint256', indexed: false }, { name: 'city', type: 'address', indexed: true }, { name: 'referrer', type: 'address', indexed: false }] },
  { name: 'Withdrawal', type: 'event', inputs: [{ name: 'me', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'dubloons', type: 'uint256', indexed: false }] },
  { name: 'Farm', type: 'event', inputs: [{ name: 'market', type: 'address', indexed: true }, { name: 'reserve', type: 'address', indexed: true }, { name: 'dubloons', type: 'uint256', indexed: false }] },
  { name: 'PullReserves', type: 'event', inputs: [{ name: 'treasurer', type: 'address', indexed: true }, { name: 'dubloons', type: 'uint256', indexed: false }] },
  { name: 'Lend', type: 'event', inputs: [{ name: 'treasurer', type: 'address', indexed: true }, { name: 'debtToken', type: 'address', indexed: true }, { name: 'popup', type: 'address', indexed: true }, { name: 'dubloons', type: 'uint256', indexed: false }] },
] as const;

/** Standard ERC20 ABI */
export const erc20Abi = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'Transfer', type: 'event', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'value', type: 'uint256', indexed: false }] },
  { name: 'Approval', type: 'event', inputs: [{ name: 'owner', type: 'address', indexed: true }, { name: 'spender', type: 'address', indexed: true }, { name: 'value', type: 'uint256', indexed: false }] },
] as const;

/** Standard ERC4626 Tokenized Vault ABI */
export const erc4626Abi = [
  { name: 'asset', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'totalAssets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'convertToAssets', type: 'function', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'convertToShares', type: 'function', stateMutability: 'view', inputs: [{ name: 'assets', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'maxDeposit', type: 'function', stateMutability: 'view', inputs: [{ name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'maxWithdraw', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'previewDeposit', type: 'function', stateMutability: 'view', inputs: [{ name: 'assets', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'previewRedeem', type: 'function', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'previewMint', type: 'function', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'previewWithdraw', type: 'function', stateMutability: 'view', inputs: [{ name: 'assets', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'maxMint', type: 'function', stateMutability: 'view', inputs: [{ name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'maxRedeem', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'Deposit', type: 'event', inputs: [{ name: 'sender', type: 'address', indexed: true }, { name: 'owner', type: 'address', indexed: true }, { name: 'assets', type: 'uint256', indexed: false }, { name: 'shares', type: 'uint256', indexed: false }] },
  { name: 'Withdraw', type: 'event', inputs: [{ name: 'sender', type: 'address', indexed: true }, { name: 'receiver', type: 'address', indexed: true }, { name: 'owner', type: 'address', indexed: true }, { name: 'assets', type: 'uint256', indexed: false }, { name: 'shares', type: 'uint256', indexed: false }] },
] as const;

/** Aave V3 Pool ABI */
export const aavePoolAbi = [
  { name: 'getUserAccountData', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: 'totalCollateralBase', type: 'uint256' }, { name: 'totalDebtBase', type: 'uint256' }, { name: 'availableBorrowsBase', type: 'uint256' }, { name: 'currentLiquidationThreshold', type: 'uint256' }, { name: 'ltv', type: 'uint256' }, { name: 'healthFactor', type: 'uint256' }] },
  { name: 'getReserveData', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: 'data', type: 'tuple', components: [{ name: 'configuration', type: 'tuple', components: [{ name: 'data', type: 'uint256' }] }, { name: 'liquidityIndex', type: 'uint128' }, { name: 'currentLiquidityRate', type: 'uint128' }, { name: 'variableBorrowIndex', type: 'uint128' }, { name: 'currentVariableBorrowRate', type: 'uint128' }, { name: 'currentStableBorrowRate', type: 'uint128' }, { name: 'lastUpdateTimestamp', type: 'uint40' }, { name: 'id', type: 'uint16' }, { name: 'aTokenAddress', type: 'address' }, { name: 'stableDebtTokenAddress', type: 'address' }, { name: 'variableDebtTokenAddress', type: 'address' }, { name: 'interestRateStrategyAddress', type: 'address' }, { name: 'accruedToTreasury', type: 'uint128' }, { name: 'unbacked', type: 'uint128' }, { name: 'isolationModeTotalDebt', type: 'uint128' }] }] },
  { name: 'ADDRESSES_PROVIDER', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'supply', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }, { name: 'referralCode', type: 'uint16' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'borrow', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'interestRateMode', type: 'uint256' }, { name: 'referralCode', type: 'uint16' }, { name: 'onBehalfOf', type: 'address' }], outputs: [] },
  { name: 'repay', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'interestRateMode', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'setUserUseReserveAsCollateral', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'useAsCollateral', type: 'bool' }], outputs: [] },
] as const;

/** Aave debt token ABI */
export const aaveDebtTokenAbi = [
  { name: 'UNDERLYING_ASSET_ADDRESS', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'approveDelegation', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'delegatee', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'borrowAllowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'fromUser', type: 'address' }, { name: 'toUser', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'scaledBalanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'scaledTotalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const;
