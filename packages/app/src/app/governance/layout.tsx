/**
 * @module governance/layout
 * Governance dashboard layout
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governance Dashboard - Bangui DAF',
  description: 'Treasury overview, allocation proposals, and community metrics',
};

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
