/**
 * @module @bangui/db/seeds
 * Database seeding script for development
 */

import { createDb } from '../src/client.js';
import * as schema from '../src/schema.js';

const STORIES = [
  {
    title: 'Global Health Initiative',
    description:
      'Supporting vaccine distribution and healthcare access in underserved regions.',
    causeCategory: 'global_health',
    impactMetrics: { beneficiaries: 50000, costPerLife: 3500 },
    minInvestment: '100',
    riskLevel: 'conservative' as const,
  },
  {
    title: 'Clean Water Access Fund',
    description: 'Building wells and water purification systems in rural communities.',
    causeCategory: 'environment',
    impactMetrics: { beneficiaries: 25000, wellsBuilt: 150 },
    minInvestment: '250',
    riskLevel: 'conservative' as const,
  },
  {
    title: 'Education Technology Initiative',
    description:
      'Providing tablets and internet access to students in low-income schools.',
    causeCategory: 'education',
    impactMetrics: { studentsReached: 10000, schoolsEquipped: 50 },
    minInvestment: '500',
    riskLevel: 'moderate' as const,
  },
  {
    title: 'Microfinance for Women Entrepreneurs',
    description: 'Small business loans for women-owned enterprises in developing nations.',
    causeCategory: 'economic_empowerment',
    impactMetrics: { loansIssued: 5000, avgLoanSize: 500, repaymentRate: 0.96 },
    minInvestment: '100',
    riskLevel: 'moderate' as const,
  },
  {
    title: 'Climate Action Regenerative Agriculture',
    description: 'Funding regenerative farming practices that sequester carbon.',
    causeCategory: 'climate',
    impactMetrics: { acresConverted: 10000, carbonSequestered: 50000 },
    minInvestment: '1000',
    riskLevel: 'aggressive' as const,
  },
  {
    title: 'Criminal Justice Reform Advocacy',
    description: 'Supporting policy research and advocacy for sentencing reform.',
    causeCategory: 'policy_advocacy',
    impactMetrics: { policiesInfluenced: 3, statesReached: 12 },
    minInvestment: '500',
    riskLevel: 'aggressive' as const,
  },
  {
    title: 'Local Food Bank Network',
    description: 'Strengthening food distribution networks in urban food deserts.',
    causeCategory: 'local_community',
    impactMetrics: { mealsServed: 100000, familiesSupported: 5000 },
    minInvestment: '50',
    riskLevel: 'conservative' as const,
  },
  {
    title: 'Arts & Culture Preservation',
    description: 'Preserving indigenous art forms and supporting emerging artists.',
    causeCategory: 'arts_culture',
    impactMetrics: { artistsSupported: 200, exhibitionsHosted: 25 },
    minInvestment: '250',
    riskLevel: 'moderate' as const,
  },
];

const seed = async () => {
  const db = createDb({ connectionString: process.env.DATABASE_URL! });

  console.log('Seeding stories...');
  await db.insert(schema.stories).values(STORIES).onConflictDoNothing();
  console.log(`Seeded ${STORIES.length} stories.`);

  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
