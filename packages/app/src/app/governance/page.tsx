/**
 * @module governance/page
 * Governance Dashboard - Treasury, Proposals, and Community metrics
 */

'use client';

import { FC } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { TreasurySection } from '../../components/governance/TreasurySection';
import { ProposalsSection } from '../../components/governance/ProposalsSection';
import { CommunitySection } from '../../components/governance/CommunitySection';
import {
  useTreasuryMetrics,
  useTreasuryHoldings,
  useStrategies,
  useBlendedYields,
  useProposals,
  useCommunityMetrics,
  useDepositVolume,
  useCommunityComposition,
  governanceKeys,
} from '../../lib/governance/hooks';

const LoadingSpinner: FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
  </div>
);

const ErrorDisplay: FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
    <div className="text-red-600 font-medium mb-2">Error loading data</div>
    <div className="text-sm text-red-500 mb-4">{message}</div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
      >
        Retry
      </button>
    )}
  </div>
);

const GovernanceDashboard: FC = () => {
  const queryClient = useQueryClient();

  // Treasury data
  const treasuryMetrics = useTreasuryMetrics();
  const treasuryHoldings = useTreasuryHoldings(90);
  const strategies = useStrategies();
  const blendedYields = useBlendedYields();

  // Proposals data
  const proposals = useProposals();

  // Community data
  const communityMetrics = useCommunityMetrics();
  const depositVolume = useDepositVolume(90);
  const communityComposition = useCommunityComposition();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: governanceKeys.all });
  };

  // Check overall loading state
  const isLoading =
    treasuryMetrics.isLoading ||
    treasuryHoldings.isLoading ||
    strategies.isLoading ||
    blendedYields.isLoading ||
    proposals.isLoading ||
    communityMetrics.isLoading ||
    depositVolume.isLoading ||
    communityComposition.isLoading;

  // Check for errors
  const hasError =
    treasuryMetrics.isError ||
    treasuryHoldings.isError ||
    strategies.isError ||
    blendedYields.isError ||
    proposals.isError ||
    communityMetrics.isError ||
    depositVolume.isError ||
    communityComposition.isError;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Governance Dashboard</h1>
              <p className="text-sm text-gray-500">Treasury, proposals, and community metrics</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
              <Link
                href="/"
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Back to Chat
              </Link>
              <Link
                href="/admin"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-12">
        {/* Treasury Section */}
        {treasuryMetrics.isLoading || treasuryHoldings.isLoading ? (
          <LoadingSpinner />
        ) : treasuryMetrics.isError ? (
          <ErrorDisplay
            message={treasuryMetrics.error?.message || 'Failed to load treasury data'}
            onRetry={() => treasuryMetrics.refetch()}
          />
        ) : treasuryMetrics.data ? (
          <TreasurySection
            metrics={treasuryMetrics.data}
            snapshots={treasuryHoldings.data?.snapshots || []}
            strategies={strategies.data || []}
            blendedYields={blendedYields.data || []}
          />
        ) : null}

        {/* Divider */}
        <hr className="border-gray-200" />

        {/* Proposals Section */}
        {proposals.isLoading ? (
          <LoadingSpinner />
        ) : proposals.isError ? (
          <ErrorDisplay
            message={proposals.error?.message || 'Failed to load proposals'}
            onRetry={() => proposals.refetch()}
          />
        ) : (
          <ProposalsSection proposals={proposals.data?.proposals || []} />
        )}

        {/* Divider */}
        <hr className="border-gray-200" />

        {/* Community Section */}
        {communityMetrics.isLoading || depositVolume.isLoading || communityComposition.isLoading ? (
          <LoadingSpinner />
        ) : communityMetrics.isError ? (
          <ErrorDisplay
            message={communityMetrics.error?.message || 'Failed to load community data'}
            onRetry={() => communityMetrics.refetch()}
          />
        ) : communityMetrics.data ? (
          <CommunitySection
            metrics={communityMetrics.data}
            depositVolume={depositVolume.data?.data || []}
            archetypeDistribution={communityComposition.data?.archetypes || []}
            riskDistribution={communityComposition.data?.riskProfiles || []}
          />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>Bangui DAF Governance Dashboard</div>
            <div>Data updates automatically</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GovernanceDashboard;
