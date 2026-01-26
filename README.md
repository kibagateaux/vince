# Bangui

A DAF (Donor Advised Fund) platform featuring an AI-powered conversational agent (Vince) that guides users through investment questionnaires and deposit flows.

## Project Structure

```
packages/
├── types/     # Shared TypeScript type definitions
├── db/        # PostgreSQL database with Drizzle ORM
├── agent/     # ElizaOS-based AI agent (Vince)
├── api/       # Hono API server with WebSocket support
└── web/       # React frontend with Privy auth & Wagmi
```

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL 15+
- npm 9+

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
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bangui

# API Server
PORT=3001
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# DAF Contract
DAF_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Anthropic (for AI agent)
ANTHROPIC_API_KEY=sk-ant-...

# Privy (Web UI authentication)
VITE_PRIVY_APP_ID=your-privy-app-id

# Optional: Blockchain RPCs
ETH_RPC_URL=https://mainnet.infura.io/v3/...
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/...
ARB_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/...
```

### 3. Database Setup

Create the PostgreSQL database:

```bash
createdb bangui
```

Run migrations:

```bash
npm run db:migrate
```

Seed the database (optional):

```bash
npm run db:seed
```

### 4. Build Packages

Build all shared packages before running the app:

```bash
npm run build
```

This compiles TypeScript for `@bangui/types`, `@bangui/db`, and `@bangui/agent`.

### 5. Run the Application

Start the API server:

```bash
npm run dev -w @bangui/api
```

In a separate terminal, start the web frontend:

```bash
npm run dev -w @bangui/web
```

The API will be available at `http://localhost:3001` and the web app at `http://localhost:5173`.

## Development

### Running Individual Packages

```bash
# API server (with hot reload)
npm run dev -w @bangui/api

# Web frontend (Vite dev server)
npm run dev -w @bangui/web

# Run all dev servers
npm run dev
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build -w @bangui/types
npm run build -w @bangui/db
npm run build -w @bangui/agent
npm run build -w @bangui/api
npm run build -w @bangui/web
```

### Testing

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test -w @bangui/db
npm run test -w @bangui/api

# Watch mode
npm run test:watch -w @bangui/db
```

### Database Operations

```bash
# Run migrations
npm run db:migrate

# Generate new migration (after schema changes)
npm run generate -w @bangui/db

# Seed database
npm run db:seed
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /api/v1/auth/connect` | Connect/authenticate user |
| `GET /api/v1/questionnaire` | Get questionnaire questions |
| `POST /api/v1/questionnaire/submit` | Submit questionnaire responses |
| `POST /api/v1/deposits/prepare` | Prepare a deposit transaction |
| `POST /api/v1/deposits/confirm` | Confirm a deposit |
| `GET /api/v1/stories` | Get investment stories |
| `GET /api/v1/admin/conversations` | Admin: list conversations |
| `WS /ws/chat` | WebSocket for real-time chat with Vince |

## Architecture

- **Frontend**: React 18 + Vite + TailwindCSS + Privy for wallet auth
- **Backend**: Hono (Node.js) + WebSocket for real-time chat
- **Database**: PostgreSQL + Drizzle ORM
- **AI Agent**: ElizaOS + Anthropic Claude for conversational AI
- **Blockchain**: Wagmi + Viem for Ethereum/Polygon/Arbitrum support
