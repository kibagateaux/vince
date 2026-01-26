'use client';

/**
 * @module @bangui/app/providers
 * Client-side providers (Privy, React Query)
 */

import { FC, ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

/** Privy app ID from environment - optional at build time */
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper
 */
export const Providers: FC<ProvidersProps> = ({ children }) => {
  // Show loading state if Privy not configured (shouldn't happen in production)
  if (!PRIVY_APP_ID) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex h-screen items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#2563eb',
          logo: undefined,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PrivyProvider>
  );
};
