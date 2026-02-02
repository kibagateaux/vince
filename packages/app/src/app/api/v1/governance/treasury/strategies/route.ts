/**
 * GET /api/v1/governance/treasury/strategies
 * Gets strategy performance data with vault token information
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base, sepolia, baseSepolia } from 'viem/chains';
import { getSupabase } from '../../../../../../lib/db';
import { VAULTS, type VaultMetadata } from '../../../../../../lib/vaults';
import { aiETHAbi, erc20Abi, truncateAddress } from '../../../../../../lib/protocol';
import { getTokenDecimals, type Address, type Chain } from '@bangui/types';

/** Chain to viem chain mapping */
const CHAIN_MAP: Record<string, typeof base | typeof sepolia | typeof baseSepolia> = {
  base: base,
  sepolia: sepolia,
  base_sepolia: baseSepolia,
};

/** Chain to RPC URL env var mapping */
const RPC_ENV_MAP: Record<string, string> = {
  base: 'BASE_RPC_URL',
  sepolia: 'NEXT_PUBLIC_DEFAULT_RPC_URL',
  base_sepolia: 'BASE_SEPOLIA_RPC_URL',
};

interface VaultTokenInfo {
  vaultName: string;
  vaultSymbol: string;
  reserveTokenAddress: string;
  reserveTokenSymbol: string;
  debtTokenAddress?: string;
  debtTokenSymbol?: string;
  debtAssetAddress?: string;
  debtAssetSymbol?: string;
  totalAssets: string;
  totalSupply: string;
  totalDebt: string;
  totalCreditDelegated: string;
  yieldEarned: string;
  reservePrice: string;
}

async function getVaultTokenInfo(
  vault: VaultMetadata
): Promise<VaultTokenInfo | null> {
  const viemChain = CHAIN_MAP[vault.chain];
  if (!viemChain) return null;

  const rpcEnvVar = RPC_ENV_MAP[vault.chain];
  const rpcUrl = process.env[rpcEnvVar] || process.env.NEXT_PUBLIC_DEFAULT_RPC_URL;
  if (!rpcUrl) return null;

  if (!vault.address || vault.address === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  const client = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  });

  try {
    // Read vault metadata
    const [name, symbol, reserveTokenAddr, totalAssets, totalSupply] = await Promise.all([
      client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'name',
      }).catch(() => vault.name),
      client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'symbol',
      }).catch(() => 'aiETH'),
      client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'reserveToken',
      }).catch(() => null),
      client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'underlying',
      }).catch(() => 0n),
      client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'totalSupply',
      }).catch(() => 0n),
    ]);

    // Try to read yield and price
    const [yieldEarned, reservePrice] = await Promise.all([
      client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'getYieldEarned',
      }).catch(() => 0n),
      client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'reserveAssetPrice',
      }).catch(() => 0n),
    ]);

    // Get reserve token symbol
    let reserveSymbol = vault.reserveToken;
    if (reserveTokenAddr) {
      try {
        reserveSymbol = await client.readContract({
          address: reserveTokenAddr as Address,
          abi: erc20Abi,
          functionName: 'symbol',
        }) as string;
      } catch {
        // Keep default from vault config
      }
    }

    // Try to get debt token and debt asset info
    let debtTokenAddr: string | undefined;
    let debtTokenSymbol: string | undefined;
    let debtAssetAddr: string | undefined;
    let debtAssetSymbol: string | undefined;
    let totalDebt = 0n;
    let totalCreditDelegated = 0n;

    try {
      // Get debt token address (the Aave variable debt token)
      debtTokenAddr = await client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'debtToken',
      }) as string;

      if (debtTokenAddr && debtTokenAddr !== '0x0000000000000000000000000000000000000000') {
        // Get debt token symbol and balance (total debt)
        const [symbol, balance] = await Promise.all([
          client.readContract({
            address: debtTokenAddr as Address,
            abi: erc20Abi,
            functionName: 'symbol',
          }).catch(() => 'variableDebtToken'),
          client.readContract({
            address: debtTokenAddr as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [vault.address],
          }).catch(() => 0n),
        ]);
        debtTokenSymbol = symbol as string;
        totalDebt = balance as bigint;

        // Try to get the underlying debt asset from the debt token
        try {
          const debtTokenAbi = [
            { name: 'UNDERLYING_ASSET_ADDRESS', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
          ] as const;
          debtAssetAddr = await client.readContract({
            address: debtTokenAddr as Address,
            abi: debtTokenAbi,
            functionName: 'UNDERLYING_ASSET_ADDRESS',
          }) as string;

          if (debtAssetAddr && debtAssetAddr !== '0x0000000000000000000000000000000000000000') {
            debtAssetSymbol = await client.readContract({
              address: debtAssetAddr as Address,
              abi: erc20Abi,
              functionName: 'symbol',
            }) as string;
          }
        } catch {
          // Could not get debt asset info
        }
      }
    } catch {
      // Debt token not available
    }

    // Get total credit delegated
    try {
      totalCreditDelegated = await client.readContract({
        address: vault.address,
        abi: aiETHAbi,
        functionName: 'totalCreditDelegated',
      }) as bigint;
    } catch {
      // Credit delegation not available
    }

    return {
      vaultName: name as string,
      vaultSymbol: symbol as string,
      reserveTokenAddress: reserveTokenAddr as string ?? '',
      reserveTokenSymbol: reserveSymbol,
      debtTokenAddress: debtTokenAddr,
      debtTokenSymbol: debtTokenSymbol,
      debtAssetAddress: debtAssetAddr,
      debtAssetSymbol: debtAssetSymbol,
      totalAssets: (totalAssets as bigint).toString(),
      totalSupply: (totalSupply as bigint).toString(),
      totalDebt: totalDebt.toString(),
      totalCreditDelegated: totalCreditDelegated.toString(),
      yieldEarned: (yieldEarned as bigint).toString(),
      reservePrice: (reservePrice as bigint).toString(),
    };
  } catch (error) {
    console.error(`[API] Error fetching vault info for ${vault.name}:`, error);
    return null;
  }
}

export async function GET() {
  console.log('[API] GET /api/v1/governance/treasury/strategies');
  try {
    const db = getSupabase();

    // Get deposit stats from database for allocation percentages
    // First try with vault_address, fall back to just amount if column doesn't exist
    let deposits: { amount: string | null; vault_address?: string | null }[] | null = null;
    let depositsError: any = null;

    try {
      const result = await db
        .from('deposits')
        .select('amount, vault_address')
        .eq('status', 'confirmed');
      deposits = result.data;
      depositsError = result.error;
    } catch (e) {
      console.log('[API] vault_address column may not exist, trying without it');
    }

    // If vault_address query failed, try without it
    if (depositsError || deposits === null) {
      console.log('[API] Falling back to query without vault_address');
      const result = await db
        .from('deposits')
        .select('amount')
        .eq('status', 'confirmed');
      deposits = result.data?.map(d => ({ ...d, vault_address: null })) ?? null;
      depositsError = result.error;
    }

    if (depositsError) {
      console.error('[API] Error querying deposits:', depositsError);
    }

    // Calculate total deposits per vault
    // Deposits may be stored in wei-like format (10^18 scale) - we'll normalize later per token
    const vaultTotals = new Map<string, number>();
    let totalAllDepositsRaw = 0;
    let depositsWithVaultAddress = 0;
    for (const d of deposits ?? []) {
      const amount = parseFloat(d.amount ?? '0');
      const vaultAddr = d.vault_address?.toLowerCase() ?? 'default';
      vaultTotals.set(vaultAddr, (vaultTotals.get(vaultAddr) ?? 0) + amount);
      totalAllDepositsRaw += amount;
      if (d.vault_address) depositsWithVaultAddress++;
    }

    console.log('[API] Deposit stats:', {
      totalDeposits: deposits?.length ?? 0,
      depositsWithVaultAddress,
      totalAllDepositsRaw,
      vaultTotalsKeys: Array.from(vaultTotals.keys()),
    });

    // Build strategies from configured vaults
    const strategies = [];

    for (const vault of VAULTS) {
      // Skip vaults without addresses
      if (!vault.address || vault.address === '0x0000000000000000000000000000000000000000') {
        continue;
      }

      // Get on-chain vault info
      const tokenInfo = await getVaultTokenInfo(vault);

      // Get deposits for this vault - if no deposits have vault_address set,
      // attribute all deposits to the primary vault
      let vaultDepositsRaw = vaultTotals.get(vault.address.toLowerCase()) ?? 0;
      if (vaultDepositsRaw === 0 && vault.isPrimary && depositsWithVaultAddress === 0) {
        // No deposits have vault_address set, attribute all to primary vault
        vaultDepositsRaw = totalAllDepositsRaw;
      }
      const allocationPercent = totalAllDepositsRaw > 0
        ? (vaultDepositsRaw / totalAllDepositsRaw) * 100
        : (vault.isPrimary ? 100 : 0);

      // Normalize deposits from raw format (assumed 10^18 scale) to token units
      const vaultDepositsNormalized = vaultDepositsRaw / 1e18;

      // Use correct decimals and fallback price based on token
      const reserveDecimals = getTokenDecimals(vault.reserveToken);
      const fallbackPrice = vault.reserveToken === 'WBTC' ? 100000 : vault.reserveToken === 'ETH' ? 3000 : 1;

      // Calculate USD values from on-chain data
      let totalValueUsd = 0;
      let totalDebtUsd = 0;
      let yieldEarnedUsd = 0;
      let totalDeposited = 0;

      if (tokenInfo) {
        const totalAssets = BigInt(tokenInfo.totalAssets);
        const totalDebt = BigInt(tokenInfo.totalDebt);
        const yieldEarned = BigInt(tokenInfo.yieldEarned);
        const reservePrice = BigInt(tokenInfo.reservePrice);
        const divisor = BigInt(10 ** reserveDecimals);

        if (totalAssets > 0n && reservePrice > 0n) {
          totalValueUsd = Number(totalAssets * reservePrice / divisor) / 1e8;
        }
        if (totalDebt > 0n && reservePrice > 0n) {
          totalDebtUsd = Number(totalDebt * reservePrice / divisor) / 1e8;
        }
        if (yieldEarned > 0n && reservePrice > 0n) {
          yieldEarnedUsd = Number(yieldEarned * reservePrice / divisor) / 1e8;
        }
        // Total deposited in native units (for display)
        totalDeposited = Number(totalAssets) / Math.pow(10, reserveDecimals);
      }

      // If on-chain data is unavailable or zero, fall back to database deposits
      if (totalDeposited === 0 && vaultDepositsNormalized > 0) {
        totalDeposited = vaultDepositsNormalized;
        totalValueUsd = vaultDepositsNormalized * fallbackPrice;
        console.log('[API] Using database fallback for vault', vault.id, ':', {
          vaultDepositsRaw,
          vaultDepositsNormalized,
          totalValueUsd,
        });
      }

      console.log('[API] Vault', vault.id, 'final values:', {
        vaultDepositsNormalized,
        totalDeposited,
        totalValueUsd,
        tokenInfoTotalAssets: tokenInfo?.totalAssets,
      });

      // Calculate APY estimate
      const currentAPY = totalValueUsd > 0 ? (yieldEarnedUsd / totalValueUsd) * 365 * 100 : 0;

      strategies.push({
        id: vault.id,
        name: tokenInfo?.vaultName ?? vault.name,
        protocol: 'Bangui DAF',
        asset: vault.reserveToken as 'ETH' | 'USDC' | 'DAI' | 'WBTC' | 'USDT',
        allocation: {
          amount: totalValueUsd || vaultDepositsNormalized * fallbackPrice,
          percentage: Math.round(allocationPercent * 10) / 10,
        },
        yield: {
          trailing30d: Math.round((currentAPY / 12) * 100) / 100,
          trailing90d: Math.round((currentAPY / 4) * 100) / 100,
          currentAPY: Math.round(currentAPY * 10) / 10,
          trend: currentAPY > 0 ? 'up' as const : 'stable' as const,
        },
        reserveToken: {
          symbol: tokenInfo?.reserveTokenSymbol ?? vault.reserveToken,
          address: tokenInfo?.reserveTokenAddress
            ? truncateAddress(tokenInfo.reserveTokenAddress)
            : undefined,
        },
        vaultToken: {
          symbol: tokenInfo?.vaultSymbol ?? `ai${vault.reserveToken}`,
          address: truncateAddress(vault.address),
        },
        debtToken: tokenInfo?.debtTokenAddress ? {
          symbol: tokenInfo.debtTokenSymbol ?? 'variableDebtToken',
          address: truncateAddress(tokenInfo.debtTokenAddress),
        } : undefined,
        debtAsset: tokenInfo?.debtAssetSymbol ? {
          symbol: tokenInfo.debtAssetSymbol,
          address: tokenInfo.debtAssetAddress ? truncateAddress(tokenInfo.debtAssetAddress) : undefined,
        } : undefined,
        totalDeposited: totalDeposited || vaultDepositsNormalized,
        totalDepositedUsd: totalValueUsd || vaultDepositsNormalized * fallbackPrice,
        totalDebt: tokenInfo ? Number(BigInt(tokenInfo.totalDebt)) / Math.pow(10, reserveDecimals) : 0,
        totalDebtUsd: totalDebtUsd,
        vaultAddress: vault.address,
        chain: vault.chain,
      });
    }

    // If no vaults have addresses configured, return a placeholder using the primary vault config
    if (strategies.length === 0) {
      const primaryVault = VAULTS.find(v => v.isPrimary) ?? VAULTS[0];
      const tokenSymbol = primaryVault?.reserveToken ?? 'WBTC';
      const fallbackPrice = tokenSymbol === 'WBTC' ? 100000 : tokenSymbol === 'ETH' ? 3000 : 1;

      // Normalize deposits (assuming 10^18 scale)
      const totalDepositsNormalized = totalAllDepositsRaw / 1e18;

      strategies.push({
        id: 'placeholder',
        name: `ai${tokenSymbol} Vault`,
        protocol: 'Bangui DAF',
        asset: tokenSymbol as 'ETH' | 'USDC' | 'DAI' | 'WBTC' | 'USDT',
        allocation: {
          amount: totalDepositsNormalized * fallbackPrice,
          percentage: 100,
        },
        yield: {
          trailing30d: 0,
          trailing90d: 0,
          currentAPY: 0,
          trend: 'stable' as const,
        },
        reserveToken: {
          symbol: tokenSymbol,
        },
        vaultToken: {
          symbol: `ai${tokenSymbol}`,
        },
        debtAsset: {
          symbol: 'GHO',
        },
        totalDeposited: totalDepositsNormalized,
        totalDepositedUsd: totalDepositsNormalized * fallbackPrice,
        totalDebt: 0,
        totalDebtUsd: 0,
        chain: primaryVault?.chain ?? 'sepolia',
      });
    }

    console.log('[API] Strategies response:', { count: strategies.length });
    return NextResponse.json({ strategies });
  } catch (error) {
    console.error('[API] Error fetching strategies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}
