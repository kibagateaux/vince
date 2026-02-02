/**
 * POST /api/v1/agents/kincho/lend
 * Execute a lend (allocate) transaction through Kincho agent
 *
 * This endpoint:
 * 1. Validates the lend request
 * 2. Runs Kincho consensus (financial + risk + meta-cognition)
 * 3. If approved, executes allocate() transaction via Kincho wallet
 * 4. Returns txHash and decision details
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import {
  getKinchoRuntime,
  getFundState,
} from '../../../../../../lib/kincho-helpers';
import {
  isKinchoWalletConfigured,
  createKinchoWalletClient,
  createKinchoPublicClient,
  validateTransactionTarget,
  getAllowedVaultAddress,
  getKinchoAddress,
} from '../../../../../../lib/kincho-wallet';
import { encodeFunctionData } from 'viem';
import { Chain, getChainName, getChainId } from '@bangui/types';
import type { Address, BigIntString, UnsignedTransaction } from '@bangui/types';
import {
  isRegisteredCity,
  getCityByAddress,
  selectCitiesForAllocation,
  type CityProject,
} from '../../../../../../lib/cities-registry';

// ABI for AiETH.allocate function
// NOTE: This is duplicated from @bangui/agents/vince tx-generator.ts
// TODO: Import from @bangui/agents/vince once package is rebuilt
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

/**
 * Builds unsigned allocate transaction for Kincho lend
 */
function buildAllocateTx(input: {
  contractAddress: Address;
  city: Address;
  amount: BigIntString;
  chain: Chain;
}): UnsignedTransaction {
  const data = encodeFunctionData({
    abi: aiETHAllocateAbi,
    functionName: 'allocate',
    args: [input.city, BigInt(input.amount)],
  });

  return {
    to: input.contractAddress,
    data,
    value: '0' as BigIntString,
    gasEstimate: '150000' as BigIntString,
    chainId: getChainId(input.chain),
  };
}

/** Lend request payload */
interface LendRequestPayload {
  /** City/project address to receive credit delegation */
  city: string;
  /** Amount to delegate (as string for BigInt compatibility) */
  amount: string;
  /** Reasoning for the lend decision (for audit trail) */
  reasoning: string;
  /** Optional chain ID (defaults to DEFAULT_CHAIN_ID) */
  chainId?: number;
}

/** Lend response */
interface LendResponse {
  success: boolean;
  txHash?: string;
  decision: 'approved' | 'rejected';
  city: string;
  amount: string;
  reasoning: string;
  cityInfo?: {
    name: string;
    ensName?: string;
    causeCategory: string;
    riskRating: number;
  };
  kinchoAnalysis?: {
    fitScore: number;
    riskScore: number;
    confidenceScore: number;
    concerns: string[];
  };
  error?: string;
}

/**
 * Validate that the city address is a valid Ethereum address
 */
function validateCityAddress(city: string): city is Address {
  return isAddress(city);
}

/**
 * Simple lend-specific consensus check
 * Uses Kincho's subagent consensus for risk/financial analysis
 */
async function runLendConsensus(
  city: Address,
  amount: BigIntString,
  reasoning: string
): Promise<{
  approved: boolean;
  fitScore: number;
  riskScore: number;
  confidenceScore: number;
  concerns: string[];
}> {
  const runtime = getKinchoRuntime();
  if (!runtime) {
    return {
      approved: false,
      fitScore: 0,
      riskScore: 1,
      confidenceScore: 0,
      concerns: ['Kincho runtime not available'],
    };
  }

  const fundState = await getFundState();

  // Create a minimal allocation request for consensus
  // Using 'as any' since we're creating a mock request for internal consensus only
  const amountNumber = Number(amount) / 1e18;
  const vaultAddress = process.env.DAF_CONTRACT_ADDRESS as Address | null;
  const mockRequest = {
    id: crypto.randomUUID() as string & { readonly __brand: 'UUID' },
    depositId: null,
    userId: 'kincho-lend' as string & { readonly __brand: 'UUID' },
    conversationId: null,
    amount,
    userPreferences: {
      causes: ['lending'] as readonly string[],
      riskTolerance: 'moderate' as const,
    },
    vinceRecommendation: {
      suggestedAllocations: [
        {
          causeId: city,
          causeName: `City ${city.slice(0, 8)}...`,
          amount: amountNumber,
          percentage: 100,
          reasoning,
        },
      ],
      psychProfile: null,
      reasoning,
    },
    vaultAddress,
    status: 'pending' as const,
    createdAt: Date.now() as number & { readonly __brand: 'Timestamp' },
  };

  // Gather subagent consensus
  const consensus = await runtime.gatherSubagentConsensus(mockRequest as any, fundState);

  const concerns: string[] = [];

  // Collect concerns from each subagent
  if (!consensus.financialAnalyzer.approved) {
    concerns.push(`Financial: ${consensus.financialAnalyzer.reasoning || 'Not approved'}`);
  }
  if (!consensus.riskEngine.approved) {
    concerns.push(`Risk: Aggregate risk too high (${consensus.riskEngine.riskAssessment.aggregateRisk})`);
  }
  if (consensus.metaCognition.humanOverrideRecommended) {
    concerns.push('Meta-cognition recommends human review');
  }

  return {
    approved: consensus.hasConsensus && consensus.consensusDecision !== 'rejected',
    fitScore: consensus.financialAnalyzer.fitScore,
    riskScore: consensus.riskEngine.riskAssessment.aggregateRisk,
    confidenceScore: consensus.metaCognition.confidence,
    concerns,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<LendResponse>> {
  // Check if Kincho wallet is configured
  if (!isKinchoWalletConfigured()) {
    return NextResponse.json(
      {
        success: false,
        decision: 'rejected',
        city: '',
        amount: '',
        reasoning: '',
        error: 'Kincho wallet not configured - set KINCHO_PRIVATE_KEY',
      },
      { status: 503 }
    );
  }

  // Check if Kincho runtime is available
  const runtime = getKinchoRuntime();
  if (!runtime) {
    return NextResponse.json(
      {
        success: false,
        decision: 'rejected',
        city: '',
        amount: '',
        reasoning: '',
        error: 'Kincho agent not available - check configuration',
      },
      { status: 503 }
    );
  }

  // Parse request
  let payload: LendRequestPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        decision: 'rejected',
        city: '',
        amount: '',
        reasoning: '',
        error: 'Invalid JSON payload',
      },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!payload.city || !payload.amount || !payload.reasoning) {
    return NextResponse.json(
      {
        success: false,
        decision: 'rejected',
        city: payload.city || '',
        amount: payload.amount || '',
        reasoning: payload.reasoning || '',
        error: 'Missing required fields: city, amount, reasoning',
      },
      { status: 400 }
    );
  }

  // Validate city address
  if (!validateCityAddress(payload.city)) {
    return NextResponse.json(
      {
        success: false,
        decision: 'rejected',
        city: payload.city,
        amount: payload.amount,
        reasoning: payload.reasoning,
        error: 'Invalid city address',
      },
      { status: 400 }
    );
  }

  // Check if city is in registry (warn but don't block)
  const cityInfo = getCityByAddress(payload.city as Address);
  if (!cityInfo) {
    console.warn('[Kincho Lend] City not in registry:', payload.city);
  } else {
    console.log('[Kincho Lend] City found in registry:', {
      name: cityInfo.name,
      ensName: cityInfo.ensName,
      causeCategory: cityInfo.causeCategory,
      riskRating: cityInfo.riskRating,
    });
  }

  // Validate amount is a valid positive number
  let amountBigInt: bigint;
  try {
    amountBigInt = BigInt(payload.amount);
    if (amountBigInt <= 0n) {
      throw new Error('Amount must be positive');
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        decision: 'rejected',
        city: payload.city,
        amount: payload.amount,
        reasoning: payload.reasoning,
        error: 'Invalid amount - must be a positive integer string',
      },
      { status: 400 }
    );
  }

  const city = payload.city as Address;
  const amount = payload.amount as BigIntString;

  console.log('[Kincho Lend] Processing request:', {
    city,
    amount: payload.amount,
    reasoning: payload.reasoning,
    kinchoAddress: getKinchoAddress(),
  });

  // Run Kincho consensus
  const consensus = await runLendConsensus(city, amount, payload.reasoning);

  console.log('[Kincho Lend] Consensus result:', consensus);

  // If not approved, return rejection
  if (!consensus.approved) {
    return NextResponse.json({
      success: false,
      decision: 'rejected',
      city: payload.city,
      amount: payload.amount,
      reasoning: payload.reasoning,
      kinchoAnalysis: {
        fitScore: consensus.fitScore,
        riskScore: consensus.riskScore,
        confidenceScore: consensus.confidenceScore,
        concerns: consensus.concerns,
      },
      error: `Lend rejected: ${consensus.concerns.join('; ')}`,
    });
  }

  // Get vault address and validate
  const vaultAddress = getAllowedVaultAddress();
  if (!validateTransactionTarget(vaultAddress)) {
    return NextResponse.json(
      {
        success: false,
        decision: 'rejected',
        city: payload.city,
        amount: payload.amount,
        reasoning: payload.reasoning,
        error: 'Vault address validation failed - security check',
      },
      { status: 500 }
    );
  }

  // Determine chain
  const chainId = payload.chainId ?? parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? '11155111', 10);
  const chainName = getChainName(chainId);
  if (!chainName) {
    return NextResponse.json(
      {
        success: false,
        decision: 'rejected',
        city: payload.city,
        amount: payload.amount,
        reasoning: payload.reasoning,
        error: `Unsupported chain ID: ${chainId}`,
      },
      { status: 400 }
    );
  }

  // Build the allocate transaction
  const allocateTx = buildAllocateTx({
    contractAddress: vaultAddress,
    city,
    amount,
    chain: chainName,
  });

  console.log('[Kincho Lend] Built transaction:', {
    to: allocateTx.to,
    data: allocateTx.data,
    chainId: allocateTx.chainId,
  });

  // Execute the transaction
  try {
    const walletClient = createKinchoWalletClient({ chainId });

    const txHash = await walletClient.sendTransaction({
      account: walletClient.account!,
      to: allocateTx.to as `0x${string}`,
      data: allocateTx.data as `0x${string}`,
      value: 0n,
      chain: null,
    });

    console.log('[Kincho Lend] Transaction sent:', txHash);

    return NextResponse.json({
      success: true,
      txHash,
      decision: 'approved',
      city: payload.city,
      amount: payload.amount,
      reasoning: payload.reasoning,
      cityInfo: cityInfo
        ? {
            name: cityInfo.name,
            ensName: cityInfo.ensName,
            causeCategory: cityInfo.causeCategory,
            riskRating: cityInfo.riskRating,
          }
        : undefined,
      kinchoAnalysis: {
        fitScore: consensus.fitScore,
        riskScore: consensus.riskScore,
        confidenceScore: consensus.confidenceScore,
        concerns: consensus.concerns,
      },
    });
  } catch (error) {
    console.error('[Kincho Lend] Transaction failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        decision: 'approved', // Was approved but execution failed
        city: payload.city,
        amount: payload.amount,
        reasoning: payload.reasoning,
        kinchoAnalysis: {
          fitScore: consensus.fitScore,
          riskScore: consensus.riskScore,
          confidenceScore: consensus.confidenceScore,
          concerns: consensus.concerns,
        },
        error: `Transaction execution failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
