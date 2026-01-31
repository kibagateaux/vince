# Bangui

A DAF (Donor Advised Fund) platform featuring an AI-powered conversational agent (Vince) that guides users through investment questionnaires and deposit flows.

## Project Structure

```
packages/
├── types/     # Shared TypeScript type definitions
├── agent/     # ElizaOS-based AI agent (Vince & Kincho)
└── app/       # Next.js app with API routes, Privy auth & Wagmi
```

## Prerequisites

- Node.js >= 20.0.0
- npm 9+
- Supabase account (for database)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter (for AI agent - supports multiple providers)
OPENROUTER_API_KEY=sk-or-...
# Optional: specify model (defaults to auto-routing)
# OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Privy (Web UI authentication)
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id

# DAF Contract
DAF_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Optional: Blockchain RPCs
ETH_RPC_URL=https://mainnet.infura.io/v3/...
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/...
ARB_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/...
```

### 3. Build Packages

Build all shared packages before running the app:

```bash
npm run build
```

This compiles TypeScript for `@bangui/types` and `@bangui/agent`.

### 4. Run the Application

Start all services in development mode:

```bash
npm run dev
```

Or run individually:

```bash
# Next.js app (with hot reload)
npm run dev -w @bangui/app

# Agent service
npm run dev -w @bangui/agent
```

The app will be available at `http://localhost:3000`.

## Development

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build -w @bangui/types
npm run build -w @bangui/agent
npm run build -w @bangui/app
```

### Testing

```bash
# Run all tests
npm run test
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `POST /api/v1/auth/connect` | Connect/authenticate user |
| `POST /api/v1/chat/connect` | Initialize chat session |
| `POST /api/v1/chat/send` | Send message to Vince |
| `POST /api/v1/questionnaire/submit` | Submit questionnaire responses |
| `POST /api/v1/deposits/prepare` | Prepare a deposit transaction |
| `POST /api/v1/deposits/confirm` | Confirm a deposit |
| `GET /api/v1/stories/recommended/[userId]` | Get recommended stories |
| `GET /api/v1/admin/conversations` | Admin: list conversations |
| `POST /api/v1/agents/kincho/message` | Kincho agent endpoint |
| `POST /api/v1/agents/vince-kincho/relay` | Vince-Kincho relay endpoint |

## Architecture

- **Frontend**: Next.js 14 + React 18 + TailwindCSS + Privy for wallet auth
- **Backend**: Next.js API routes (serverless on Vercel)
- **Database**: Supabase (PostgreSQL)
- **AI Agent**: ElizaOS + OpenRouter for conversational AI (supports multiple providers)
- **Blockchain**: Wagmi + Viem for Ethereum/Polygon/Arbitrum support
