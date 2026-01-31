'use client';

/**
 * @module @bangui/app/providers
 * Client-side providers (Privy, React Query)
 */

import { FC, ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

/** Privy app ID from environment - optional at build time */
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper
 */
export const Providers: FC<ProvidersProps> = ({ children }) => {
  const queryClient = getQueryClient();

  // Show error state if Privy not configured
  if (!PRIVY_APP_ID) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Configuration Required</h1>
            <p className="text-gray-600">
              NEXT_PUBLIC_PRIVY_APP_ID environment variable is not set.
            </p>
          </div>
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
