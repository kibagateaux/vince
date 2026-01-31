/**
 * @module @bangui/agent/subagents/tx-generator
 * Transaction Generator - builds and simulates deposit transactions
 * Uses viem for all web3 interactions
 * @see {@link @bangui/types#UnsignedTransaction}
 */

import { encodeFunctionData, type PublicClient } from 'viem';
import type {
  Chain,
  Address,
  BigIntString,
  UnsignedTransaction,
  TransactionSimulation,
} from '@bangui/types';

// ============================================================================
// ABIs
// ============================================================================

/** AiETH deposit function ABI */
const aiETHDepositAbi = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'dubloons', type: 'uint256' }],
    outputs: [],
  },
] as const;

/** ERC20 approve and allowance ABI */
const erc20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ============================================================================
// Constants
// ============================================================================

/** Chain ID mapping */
const CHAIN_IDS: Record<Chain, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  base: 8453,
};

/** Default gas estimates by chain */
const DEFAULT_GAS_ESTIMATES: Record<Chain, BigIntString> = {
  ethereum: '100000' as BigIntString,
  polygon: '150000' as BigIntString,
  arbitrum: '200000' as BigIntString,
  base: '100000' as BigIntString,
};

/** Gas estimate for ERC20 approve transactions */
const APPROVE_GAS_ESTIMATE: BigIntString = '50000' as BigIntString;

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
 * Encodes deposit function call data for AiETH.deposit(uint256)
 * @param amount - Deposit amount in wei (reserveToken decimals)
 * @returns Encoded calldata
 */
export const encodeDepositData = (amount: BigIntString): `0x${string}` => {
  return encodeFunctionData({
    abi: aiETHDepositAbi,
    functionName: 'deposit',
    args: [BigInt(amount)],
  });
};

/**
 * Encodes approve function call data for ERC20.approve(address,uint256)
 * @param spender - Address to approve spending
 * @param amount - Amount to approve
 * @returns Encoded calldata
 */
export const encodeApproveData = (
  spender: Address,
  amount: BigIntString
): `0x${string}` => {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, BigInt(amount)],
  });
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
 * Input for building approve transaction
 */
export interface BuildApproveTxInput {
  /** ERC20 token address to approve */
  readonly tokenAddress: Address;
  /** Spender address (vault contract) */
  readonly spenderAddress: Address;
  /** Amount to approve */
  readonly amount: BigIntString;
  /** Target chain */
  readonly chain: Chain;
}

/**
 * Input for preparing deposit with approval check
 */
export interface PrepareDepositInput extends BuildDepositTxInput {
  /** Reserve token address (token being deposited) */
  readonly tokenAddress: Address;
}

/**
 * Result of preparing deposit transactions
 */
export interface PrepareDepositResult {
  /** Approve transaction if needed, null if already approved */
  readonly approveTx: UnsignedTransaction | null;
  /** Deposit transaction */
  readonly depositTx: UnsignedTransaction;
}

/**
 * Builds unsigned deposit transaction for AiETH
 * Note: User must have approved the AiETH contract to spend their reserveToken first
 * @param input - Transaction parameters
 * @returns Unsigned transaction ready for signing
 */
export const buildDepositTx = (input: BuildDepositTxInput): UnsignedTransaction => ({
  to: input.contractAddress,
  data: encodeDepositData(input.amount),
  value: '0' as BigIntString,
  gasEstimate: DEFAULT_GAS_ESTIMATES[input.chain],
  chainId: getChainId(input.chain),
});

/**
 * Builds unsigned ERC20 approve transaction
 * @param input - Approve transaction parameters
 * @returns Unsigned transaction ready for signing
 */
export const buildApproveTx = (input: BuildApproveTxInput): UnsignedTransaction => ({
  to: input.tokenAddress,
  data: encodeApproveData(input.spenderAddress, input.amount),
  value: '0' as BigIntString,
  gasEstimate: APPROVE_GAS_ESTIMATE,
  chainId: getChainId(input.chain),
});

/**
 * Checks ERC20 allowance using viem PublicClient
 * @param client - Viem public client
 * @param tokenAddress - ERC20 token address
 * @param owner - Token owner address
 * @param spender - Spender address to check allowance for
 * @returns Current allowance as bigint
 */
export const checkAllowance = async (
  client: PublicClient,
  tokenAddress: Address,
  owner: Address,
  spender: Address
): Promise<bigint> => {
  const allowance = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  });
  return allowance;
};

/**
 * Prepares deposit transactions, checking allowance and including approve tx if needed
 * @param input - Deposit parameters including token address
 * @param client - Viem public client for checking allowance
 * @returns Approve transaction (if needed) and deposit transaction
 */
export const prepareDepositTransactions = async (
  input: PrepareDepositInput,
  client: PublicClient
): Promise<PrepareDepositResult> => {
  // Check current allowance
  const currentAllowance = await checkAllowance(
    client,
    input.tokenAddress,
    input.userAddress,
    input.contractAddress
  );

  const depositAmount = BigInt(input.amount);

  // Build approve tx if allowance is insufficient
  const approveTx = currentAllowance < depositAmount
    ? buildApproveTx({
        tokenAddress: input.tokenAddress,
        spenderAddress: input.contractAddress,
        amount: input.amount,
        chain: input.chain,
      })
    : null;

  // Build deposit tx
  const depositTx = buildDepositTx(input);

  return { approveTx, depositTx };
};

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
