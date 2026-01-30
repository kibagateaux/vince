/**
 * GET /api/v1/agents/kincho/status
 * Kincho agent health check
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getKinchoRuntime, getFundState } from '../../../../../../lib/kincho-helpers';

export async function GET() {
  const runtime = getKinchoRuntime();
  const isConfigured = runtime !== null;

  if (!isConfigured) {
    return NextResponse.json(
      {
        status: 'unavailable',
        agent: 'kincho',
        configured: false,
        message: 'Kincho agent not configured - check OPENROUTER_API_KEY and DAF_CONTRACT_ADDRESS',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    // Get current fund state
    const fundState = await getFundState();

    return NextResponse.json({
      status: 'healthy',
      agent: 'kincho',
      configured: true,
      vaultAddress: runtime.config.vaultAddress,
      fundState: {
        totalAum: fundState.totalAum,
        liquidityAvailable: fundState.liquidityAvailable,
        healthFactor: fundState.riskParameters.currentHF,
      },
      riskParameters: runtime.config.riskParameters,
      goals: runtime.config.goals,
      constraints: runtime.config.constraints,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Kincho] Status check error:', error);
    return NextResponse.json(
      {
        status: 'degraded',
        agent: 'kincho',
        configured: true,
        error: 'Failed to retrieve fund state',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
