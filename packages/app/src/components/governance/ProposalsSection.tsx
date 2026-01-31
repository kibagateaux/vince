/**
 * @module ProposalsSection
 * Active proposals section with cards grid
 */

'use client';

import { FC, useState } from 'react';
import { ProposalCard } from './ProposalCard';
import { ProposalModal } from './ProposalModal';
import type { Proposal, ProposalStatus } from '../../lib/governance/types';

interface ProposalsSectionProps {
  proposals: Proposal[];
}

export const ProposalsSection: FC<ProposalsSectionProps> = ({ proposals }) => {
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const filteredProposals = filter === 'all'
    ? proposals
    : proposals.filter((p) => p.status === filter);

  const statusCounts = proposals.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const filterOptions: { value: ProposalStatus | 'all'; label: string }[] = [
    { value: 'all', label: `All (${proposals.length})` },
    { value: 'pending', label: `Pending (${statusCounts.pending || 0})` },
    { value: 'discussing', label: `Discussing (${statusCounts.discussing || 0})` },
    { value: 'approved', label: `Approved (${statusCounts.approved || 0})` },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          Active Proposals ({filteredProposals.length})
        </h2>
        <div className="flex gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === option.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredProposals.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm border border-gray-200">
          <div className="text-gray-400 text-lg">No proposals found</div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onClick={() => setSelectedProposal(proposal)}
            />
          ))}
        </div>
      )}

      {selectedProposal && (
        <ProposalModal
          proposal={selectedProposal}
          isOpen={!!selectedProposal}
          onClose={() => setSelectedProposal(null)}
        />
      )}
    </section>
  );
};
