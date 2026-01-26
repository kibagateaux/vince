/**
 * @module @bangui/web/App
 * Root application component with Privy provider and routing
 */

import { FC } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Chat } from './components/Chat.js';
import { ConversationsDashboard } from './components/admin/ConversationsDashboard.js';
import { ConversationDetailView } from './components/admin/ConversationDetailView.js';

const queryClient = new QueryClient();

/** Privy app ID from environment */
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

if (!PRIVY_APP_ID) {
  throw new Error('VITE_PRIVY_APP_ID environment variable is required');
}

/**
 * Root application component
 */
export const App: FC = () => {
  return (
    <BrowserRouter>
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
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/admin" element={<ConversationsDashboard />} />
            <Route path="/admin/conversations/:id" element={<ConversationDetailView />} />
          </Routes>
        </QueryClientProvider>
      </PrivyProvider>
    </BrowserRouter>
  );
};
