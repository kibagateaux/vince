/**
 * GET /api/v1/agents/kincho/cities
 * List available cities for Kincho credit delegation
 *
 * Query params:
 * - category: Filter by cause category
 * - risk: Filter by max risk rating (0-1)
 * - active: Filter by active status (default: true)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveCities,
  getCitiesByCategory,
  getCitiesByRisk,
  selectCitiesForAllocation,
  CITIES_REGISTRY,
  type CityProject,
} from '../../../../../../lib/cities-registry';

interface CitiesResponse {
  cities: Array<{
    address: string;
    name: string;
    ensName?: string;
    causeCategory: string;
    riskRating: number;
    description?: string;
  }>;
  count: number;
  filters?: {
    category?: string;
    maxRisk?: number;
    activeOnly?: boolean;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<CitiesResponse>> {
  const { searchParams } = new URL(request.url);

  const category = searchParams.get('category');
  const maxRisk = searchParams.get('risk');
  const activeOnly = searchParams.get('active') !== 'false';

  let cities: CityProject[];

  // Apply filters
  if (category) {
    cities = getCitiesByCategory(category);
  } else if (activeOnly) {
    cities = getActiveCities();
  } else {
    cities = [...CITIES_REGISTRY];
  }

  // Filter by risk if specified
  if (maxRisk) {
    const maxRiskNum = parseFloat(maxRisk);
    if (!isNaN(maxRiskNum)) {
      cities = cities.filter((c) => c.riskRating <= maxRiskNum);
    }
  }

  // Sort by risk (lowest first)
  cities.sort((a, b) => a.riskRating - b.riskRating);

  return NextResponse.json({
    cities: cities.map((c) => ({
      address: c.address,
      name: c.name,
      ensName: c.ensName,
      causeCategory: c.causeCategory,
      riskRating: c.riskRating,
      description: c.description,
    })),
    count: cities.length,
    filters: {
      category: category || undefined,
      maxRisk: maxRisk ? parseFloat(maxRisk) : undefined,
      activeOnly,
    },
  });
}
