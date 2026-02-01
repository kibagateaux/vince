/**
 * @module @bangui/agent/subagents/tx-generator
 * Transaction Generator - builds and simulates deposit transactions
 * Uses viem for all web3 interactions
 * @see {@link @bangui/types#UnsignedTransaction}
 */

import { encodeFunctionData, type PublicClient } from 'viem';
import {
  Chain,
  CHAIN_NAME_TO_ID,
  getChainId as getChainIdFromName,
} from '@bangui/types';
import type {
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

/** AiETH allocate function ABI for credit delegation */
const aiETHAllocateAbi = [
  {
    name: 'allocate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'city', type: 'address' },
      { name: 'dubloons', type: 'uint256' },
    ],
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

/** Default gas estimates by chain */
const DEFAULT_GAS_ESTIMATES: Record<Chain, BigIntString> = {
  [Chain.ETHEREUM]: '100000' as BigIntString,
  [Chain.POLYGON]: '150000' as BigIntString,
  [Chain.ARBITRUM]: '200000' as BigIntString,
  [Chain.BASE]: '100000' as BigIntString,
  [Chain.SEPOLIA]: '100000' as BigIntString,
  [Chain.BASE_SEPOLIA]: '100000' as BigIntString,
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
export const getChainId = (chain: Chain): number => getChainIdFromName(chain);

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
 * Encodes allocate function call data for AiETH.allocate(address,uint256)
 * This function delegates Aave credit to a "city" (project) for lending.
 *
 * @param city - Address of the city/project to receive credit delegation
 * @param amount - Amount to delegate (Aave market denominated, usually USD to 10 decimals)
 * @returns Encoded calldata
 */
export const encodeAllocateData = (
  city: Address,
  amount: BigIntString
): `0x${string}` => {
  return encodeFunctionData({
    abi: aiETHAllocateAbi,
    functionName: 'allocate',
    args: [city, BigInt(amount)],
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
 * Input for building allocate (lend) transaction
 */
export interface BuildAllocateTxInput {
  /** AiETH vault contract address */
  readonly contractAddress: Address;
  /** City/project address to receive credit delegation */
  readonly city: Address;
  /** Amount to delegate (Aave market denominated) */
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

/** Gas estimate for allocate transactions */
const ALLOCATE_GAS_ESTIMATE: BigIntString = '150000' as BigIntString;

/**
 * Builds unsigned allocate (lend) transaction for AiETH
 * This transaction delegates Aave credit to a city/project.
 *
 * IMPORTANT: This function requires FUN_OPS admin role on the vault.
 *
 * @param input - Allocate transaction parameters
 * @returns Unsigned transaction ready for signing
 */
export const buildAllocateTx = (input: BuildAllocateTxInput): UnsignedTransaction => ({
  to: input.contractAddress,
  data: encodeAllocateData(input.city, input.amount),
  value: '0' as BigIntString,
  gasEstimate: ALLOCATE_GAS_ESTIMATE,
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
