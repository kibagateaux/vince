/**
 * @module cities-registry
 * Registry of city/project addresses eligible for Kincho credit delegation.
 *
 * These addresses can receive credit delegation from the AiETH vault
 * when Kincho approves allocation requests.
 */

import type { Address } from '@bangui/types';

/**
 * A city/project registered for credit delegation
 */
export interface CityProject {
  /** On-chain address that receives credit delegation */
  address: Address;
  /** Human-readable name */
  name: string;
  /** ENS name if available */
  ensName?: string;
  /** Primary cause category for allocation matching */
  causeCategory: string;
  /** Risk rating from 0 (lowest) to 1 (highest) */
  riskRating: number;
  /** Whether this city is currently active for allocations */
  isActive: boolean;
  /** Optional description of the city/project */
  description?: string;
  /** Maximum allocation amount (in wei) - undefined means no limit */
  maxAllocation?: bigint;
}

/**
 * Registry of all known cities eligible for credit delegation
 */
export const CITIES_REGISTRY: CityProject[] = [
  {
    address: '0xF31263051C09BCC2853DaC78185E1e5C59f4Ee56' as Address,
    name: 'MDRN',
    ensName: 'mdrn.eth',
    causeCategory: 'technology',
    riskRating: 0.3,
    isActive: true,
    description: 'Modern technology and innovation project',
  },
  {
    address: '0xC958dEeAB982FDA21fC8922493d0CEDCD26287C3' as Address,
    name: 'Japan Zucity',
    ensName: 'japan.zucity.eth',
    causeCategory: 'community',
    riskRating: 0.25,
    isActive: true,
    description: 'Japan community development initiative',
  },
];

/**
 * Get all active cities
 */
export function getActiveCities(): CityProject[] {
  return CITIES_REGISTRY.filter((city) => city.isActive);
}

/**
 * Get a city by address
 */
export function getCityByAddress(address: Address): CityProject | undefined {
  const normalizedAddress = address.toLowerCase();
  return CITIES_REGISTRY.find(
    (city) => city.address.toLowerCase() === normalizedAddress
  );
}

/**
 * Get a city by ENS name
 */
export function getCityByEns(ensName: string): CityProject | undefined {
  const normalizedEns = ensName.toLowerCase();
  return CITIES_REGISTRY.find(
    (city) => city.ensName?.toLowerCase() === normalizedEns
  );
}

/**
 * Get cities by cause category
 */
export function getCitiesByCategory(causeCategory: string): CityProject[] {
  const normalizedCategory = causeCategory.toLowerCase();
  return CITIES_REGISTRY.filter(
    (city) =>
      city.isActive && city.causeCategory.toLowerCase() === normalizedCategory
  );
}

/**
 * Get cities sorted by risk rating (lowest risk first)
 */
export function getCitiesByRisk(): CityProject[] {
  return [...CITIES_REGISTRY]
    .filter((city) => city.isActive)
    .sort((a, b) => a.riskRating - b.riskRating);
}

/**
 * Check if an address is a registered city
 */
export function isRegisteredCity(address: Address): boolean {
  return getCityByAddress(address) !== undefined;
}

/**
 * Select cities for allocation based on preferences
 * Returns cities that match the cause categories, sorted by risk
 */
export function selectCitiesForAllocation(
  causeCategories: string[],
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): CityProject[] {
  // Risk thresholds based on tolerance
  const maxRisk =
    riskTolerance === 'conservative'
      ? 0.3
      : riskTolerance === 'moderate'
        ? 0.5
        : 0.8;

  // Get active cities matching categories (or all if no specific categories)
  let candidates = getActiveCities();

  if (causeCategories.length > 0) {
    const normalizedCategories = causeCategories.map((c) => c.toLowerCase());
    const matchingCities = candidates.filter((city) =>
      normalizedCategories.includes(city.causeCategory.toLowerCase())
    );
    // If we have matches, use them; otherwise fall back to all active
    if (matchingCities.length > 0) {
      candidates = matchingCities;
    }
  }

  // Filter by risk tolerance and sort
  return candidates
    .filter((city) => city.riskRating <= maxRisk)
    .sort((a, b) => a.riskRating - b.riskRating);
}
