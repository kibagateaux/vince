# Vince & Kincho DAF Agent System
## Enhanced Fullstack Technical Specification v2.0

**Document Version:** 2.0
**Date:** January 27, 2026
**Classification:** Internal - Technical Architecture

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [UI/UX Flows & User Journey Architecture](#2-uiux-flows--user-journey-architecture)
3. [API Services & Routes](#3-api-services--routes)
4. [Database Schema Architecture](#4-database-schema-architecture)
5. [Performance Optimizations](#5-performance-optimizations)
6. [NextJS Static Rendering & State Management](#6-nextjs-static-rendering--state-management)
7. [External Services & Testing Strategy](#7-external-services--testing-strategy)
8. [AI Response Generation Patterns](#8-ai-response-generation-patterns)
9. [Security Monitoring Suite](#9-security-monitoring-suite)
10. [Admin Dashboard Specification](#10-admin-dashboard-specification)

---

## 1. Executive Summary

This enhanced specification builds upon the existing Bangui monorepo implementation to deliver a production-ready dual-agent DAF (Donor Advised Fund) system. The system comprises:

- **Vince**: User-facing fundraising agent with psychopolitical analysis capabilities
- **Kincho (金長)**: Fund management agent with financial analysis and risk assessment

### Current Implementation Status

| Component | Status | Completeness |
|-----------|--------|--------------|
| Vince Core Agent | Implemented | 70% |
| Kincho Agent | Not Started | 0% |
| Web Chat UI | Implemented | 80% |
| API Routes | Implemented | 60% |
| Database Schema | Implemented | 85% |
| Admin Dashboard | Partial | 40% |
| Security Suite | Not Started | 0% |
| Performance Optimization | Not Started | 0% |

---

## 2. UI/UX Flows & User Journey Architecture

### 2.1 User Segmentation Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER SEGMENTATION MATRIX                              │
├─────────────────┬───────────────────┬───────────────────┬───────────────────┤
│   Dimension     │    New User       │  Returning User   │   Power User      │
├─────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Questionnaire   │ Full 6-question   │ Skip/Quick update │ Profile refresh   │
│                 │ onboarding        │ on preferences    │ on demand only    │
├─────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Wallet State    │ Connect prompt    │ Auto-reconnect    │ Multi-wallet      │
│                 │ with education    │ with balance      │ management        │
├─────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Conversation    │ Guided flow       │ Context-aware     │ Direct action     │
│ Style           │ with explanations │ continuation      │ shortcuts         │
├─────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Recommendations │ Broad discovery   │ Personalized      │ Advanced filters  │
│                 │ based approach    │ based on history  │ and search        │
├─────────────────┼───────────────────┼───────────────────┼───────────────────┤
│ Vince Tone      │ Educational,      │ Familiar,         │ Efficient,        │
│                 │ welcoming         │ personalized      │ professional      │
└─────────────────┴───────────────────┴───────────────────┴───────────────────┘
```

### 2.2 New User Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           NEW USER JOURNEY                                    │
└──────────────────────────────────────────────────────────────────────────────┘

     ┌─────────┐
     │ Landing │
     │  Page   │
     └────┬────┘
          │
          ▼
     ┌─────────┐     ┌──────────────────────────────────────────────────────┐
     │  Chat   │     │  VINCE GREETING (Confidence Detection)               │
     │ Opens   │────▶│                                                      │
     └─────────┘     │  IF user_message contains financial_terms:           │
                     │    → "I see you're familiar with DAFs! Let's..."     │
                     │  ELSE IF hesitant_language detected:                 │
                     │    → "No worries if this is new to you..."           │
                     │  ELSE:                                               │
                     │    → Standard warm welcome                           │
                     └──────────────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────────────────────┐
                     │  QUESTIONNAIRE FLOW (Adaptive)                       │
                     │                                                      │
                     │  Phase 1: Values Discovery (Q1-Q2)                   │
                     │    - Open-ended world improvement question           │
                     │    - Core values selection                           │
                     │                                                      │
                     │  Phase 2: Giving Style (Q3-Q4)                       │
                     │    - Involvement preference                          │
                     │    - Impact measurement priority                     │
                     │                                                      │
                     │  Phase 3: Risk & Control (Q5-Q6)                     │
                     │    - Manager delegation comfort                      │
                     │    - Cause flexibility assessment                    │
                     │                                                      │
                     │  [Response time tracking for confidence scoring]     │
                     └──────────────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────────────────────┐
                     │  PSYCHOPOLITICAL ANALYSIS                            │
                     │                                                      │
                     │  Computed Dimensions:                                │
                     │  ├── Political Leaning (-1 to 1)                     │
                     │  ├── Risk Tolerance (0 to 1)                         │
                     │  ├── Time Preference (immediate vs future)           │
                     │  ├── Social Proof Sensitivity                        │
                     │  ├── Trust in Institutions                           │
                     │  └── Cause Affinity Map (8 categories)               │
                     │                                                      │
                     │  Archetype Assignment:                               │
                     │  ├── Impact Maximizer                                │
                     │  ├── Community Builder                               │
                     │  ├── System Changer                                  │
                     │  ├── Values Expresser                                │
                     │  ├── Legacy Creator                                  │
                     │  └── Opportunistic Giver                             │
                     └──────────────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────────────────────┐
                     │  WALLET CONNECTION                                   │
                     │                                                      │
                     │  Flow:                                               │
                     │  1. Privy modal triggered                            │
                     │  2. User selects wallet provider                     │
                     │  3. Signature request for verification               │
                     │  4. On-chain analysis begins (async)                 │
                     │                                                      │
                     │  Wallet Analysis Output:                             │
                     │  ├── Total portfolio value                           │
                     │  ├── DeFi experience level                           │
                     │  ├── Historical transaction patterns                 │
                     │  ├── Risk profile inference                          │
                     │  └── Donation capacity estimation                    │
                     └──────────────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────────────────────┐
                     │  PERSONALIZED RECOMMENDATIONS                        │
                     │                                                      │
                     │  Vince presents stories matching:                    │
                     │  ├── Archetype alignment score                       │
                     │  ├── Cause affinity overlap                          │
                     │  ├── Risk tolerance compatibility                    │
                     │  └── Wallet capacity appropriateness                 │
                     │                                                      │
                     │  Persuasion Strategy Selection:                      │
                     │  ├── RATIONAL: Data-driven impact metrics            │
                     │  ├── EMOTIONAL: Story-driven testimonials            │
                     │  ├── SOCIAL: Peer comparison and community           │
                     │  └── AUTHORITY: Expert endorsements                  │
                     └──────────────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────────────────────┐
                     │  DEPOSIT FLOW                                        │
                     │                                                      │
                     │  1. User confirms deposit intent                     │
                     │  2. Amount input with suggested ranges               │
                     │  3. Transaction preview with gas estimate            │
                     │  4. Wallet signature request                         │
                     │  5. Transaction broadcast                            │
                     │  6. Confirmation polling                             │
                     │  7. Success celebration + allocation preview         │
                     └──────────────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────────────────────┐
                     │  KINCHO ALLOCATION REQUEST                           │
                     │                                                      │
                     │  Vince → Kincho Message:                             │
                     │  {                                                   │
                     │    depositId, userId, amount,                        │
                     │    userPreferences: { causes, riskTolerance },       │
                     │    vinceAnalysis: { psychProfile, walletAnalysis }   │
                     │  }                                                   │
                     │                                                      │
                     │  Kincho Response:                                    │
                     │  {                                                   │
                     │    decision: approved|modified|rejected,             │
                     │    allocations: [...],                               │
                     │    reasoning: "...",                                 │
                     │    confidenceScore: 0.87                             │
                     │  }                                                   │
                     └──────────────────────────────────────────────────────┘
```

### 2.3 Returning User Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        RETURNING USER JOURNEY                                 │
└──────────────────────────────────────────────────────────────────────────────┘

     ┌─────────┐
     │  Chat   │
     │ Opens   │
     └────┬────┘
          │
          ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │  SESSION RESTORATION                                                    │
     │                                                                         │
     │  1. Privy auto-reconnects wallet                                        │
     │  2. API fetches user profile + last conversation                        │
     │  3. Load archetype scores + cause affinities                            │
     │  4. Fetch deposit history + allocation status                           │
     └─────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │  CONTEXT-AWARE GREETING                                                 │
     │                                                                         │
     │  IF last_deposit < 7_days:                                              │
     │    → "Welcome back! Your recent contribution to [cause] is already..."  │
     │  ELSE IF pending_allocation:                                            │
     │    → "Good news! Kincho has made a decision on your allocation..."      │
     │  ELSE IF new_stories_match_profile:                                     │
     │    → "I found some new opportunities that align with your values..."    │
     │  ELSE:                                                                  │
     │    → Warm personalized welcome with portfolio summary                   │
     └─────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │  ADAPTIVE CONVERSATION ROUTING                                          │
     │                                                                         │
     │  User Intent Detection:                                                 │
     │  ├── "deposit" / "give" / "contribute"  → Direct to Deposit Flow       │
     │  ├── "status" / "portfolio" / "balance" → Show Dashboard Summary       │
     │  ├── "update preferences" / "change"    → Preference Update Flow       │
     │  ├── "allocation" / "where did it go"   → Allocation Details           │
     │  ├── "recommend" / "suggest"            → New Recommendations          │
     │  └── [open question]                    → Vince natural conversation   │
     └─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Confidence Level Detection

```typescript
interface ConfidenceSignals {
  // Linguistic markers
  hedgingLanguage: string[];      // "maybe", "I guess", "not sure"
  assertiveLanguage: string[];    // "I want", "definitely", "specifically"
  questionMarkers: number;        // Count of questions asked

  // Behavioral signals
  responseLatency: number;        // Time to respond (ms)
  messageLength: number;          // Character count
  revisionCount: number;          // Message edits before send

  // Domain knowledge
  financialTermsUsed: string[];   // "DAF", "tax deduction", "qualified charity"
  cryptoTermsUsed: string[];      // "gas", "wallet", "chain"
}

interface ConfidenceScore {
  overall: number;                // 0-1 composite score
  domainKnowledge: number;        // 0-1 financial/crypto familiarity
  decisionConfidence: number;     // 0-1 certainty in choices
  communicationStyle: 'tentative' | 'moderate' | 'assertive';
}

// Adaptive Response Strategy
const getResponseStrategy = (confidence: ConfidenceScore): ResponseStrategy => {
  if (confidence.overall < 0.3) {
    return {
      tone: 'educational',
      explanationDepth: 'detailed',
      jargonLevel: 'minimal',
      paceControl: 'slow',
      reassuranceFrequency: 'high'
    };
  } else if (confidence.overall < 0.7) {
    return {
      tone: 'collaborative',
      explanationDepth: 'moderate',
      jargonLevel: 'contextual',
      paceControl: 'adaptive',
      reassuranceFrequency: 'moderate'
    };
  } else {
    return {
      tone: 'efficient',
      explanationDepth: 'on-demand',
      jargonLevel: 'professional',
      paceControl: 'user-driven',
      reassuranceFrequency: 'minimal'
    };
  }
};
```

### 2.5 Psychopolitical Analysis Integration in UI

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              PSYCHOPOLITICAL PROFILE → UI ADAPTATION                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ARCHETYPE: Impact Maximizer                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│  UI Adaptations:                                                            │
│  • Show ROI metrics prominently                                             │
│  • Include comparative impact data                                          │
│  • Emphasize efficiency ratios                                              │
│  • Lead with numbers, follow with stories                                   │
│                                                                             │
│  Vince Tone: Data-driven, analytical                                        │
│  Kincho Emphasis: Quantified outcomes, measurable goals                     │
│  Recommended Stories: Evidence-backed, scalable interventions               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ARCHETYPE: Community Builder                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  UI Adaptations:                                                            │
│  • Highlight community involvement opportunities                            │
│  • Show donor cohort information                                            │
│  • Feature testimonials and shared experiences                              │
│  • Emphasize local/tangible impact                                          │
│                                                                             │
│  Vince Tone: Warm, community-focused                                        │
│  Kincho Emphasis: Relationship building, sustained engagement               │
│  Recommended Stories: Local initiatives, grassroots organizations           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ARCHETYPE: System Changer                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  UI Adaptations:                                                            │
│  • Present systemic analysis and root causes                                │
│  • Show policy influence potential                                          │
│  • Include institutional partnership info                                   │
│  • Emphasize long-term structural change                                    │
│                                                                             │
│  Vince Tone: Thoughtful, systems-oriented                                   │
│  Kincho Emphasis: Strategic leverage, policy alignment                      │
│  Recommended Stories: Advocacy, research, institutional reform              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ARCHETYPE: Values Expresser                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│  UI Adaptations:                                                            │
│  • Lead with mission/values alignment                                       │
│  • Show organizational culture and ethics                                   │
│  • Feature founder stories and motivations                                  │
│  • Emphasize authenticity markers                                           │
│                                                                             │
│  Vince Tone: Values-aligned, principled                                     │
│  Kincho Emphasis: Mission integrity, ethical standards                      │
│  Recommended Stories: Values-driven orgs, transparent operations            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ARCHETYPE: Legacy Creator                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  UI Adaptations:                                                            │
│  • Show long-term impact projections                                        │
│  • Include naming/recognition opportunities                                 │
│  • Present endowment and perpetual giving options                           │
│  • Emphasize generational impact                                            │
│                                                                             │
│  Vince Tone: Thoughtful, future-oriented                                    │
│  Kincho Emphasis: Sustainability, enduring structures                       │
│  Recommended Stories: Endowments, named programs, institutional building    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ARCHETYPE: Opportunistic Giver                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  UI Adaptations:                                                            │
│  • Highlight time-sensitive opportunities                                   │
│  • Show matching/leverage opportunities                                     │
│  • Present tax optimization angles                                          │
│  • Emphasize flexibility and optionality                                    │
│                                                                             │
│  Vince Tone: Strategic, opportunity-focused                                 │
│  Kincho Emphasis: Timing optimization, financial efficiency                 │
│  Recommended Stories: Matching campaigns, tax-advantaged timing             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. API Services & Routes

### 3.1 Complete API Route Map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           API ROUTE ARCHITECTURE                              │
│                              /api/v1/*                                        │
└──────────────────────────────────────────────────────────────────────────────┘

AUTHENTICATION & USER MANAGEMENT
  POST   /auth/connect                  Create/find user session
  POST   /auth/verify                   Verify wallet signature [NEW]
  POST   /auth/refresh                  Refresh session token [NEW]
  DELETE /auth/disconnect               End session [NEW]
  GET    /users/:userId                 Get user profile
  PATCH  /users/:userId                 Update user profile [NEW]
  GET    /users/:userId/profile         Get extended profile with archetype
  GET    /users/:userId/wallets         Get connected wallets
  GET    /users/:userId/deposits        Get deposit history
  GET    /users/:userId/allocations     Get allocation history [NEW]

QUESTIONNAIRE & ANALYSIS
  GET    /questionnaire                 Get questions for user
  POST   /questionnaire/submit          Submit single response
  POST   /questionnaire/batch           Submit multiple responses [NEW]
  GET    /questionnaire/progress/:userId Get completion status
  GET    /questionnaire/analysis/:userId Get psychopolitical analysis
  POST   /questionnaire/reanalyze/:userId Trigger re-analysis [NEW]

WALLET & BLOCKCHAIN
  POST   /wallets/connect               Register wallet to user
  GET    /wallets/:walletId             Get wallet details
  GET    /wallets/:walletId/analysis    Get on-chain analysis
  POST   /wallets/:walletId/analyze     Trigger fresh analysis [NEW]
  GET    /wallets/:walletId/balance     Get current balance [NEW]

DEPOSITS & TRANSACTIONS
  POST   /deposits/prepare              Generate unsigned transaction
  POST   /deposits/simulate             Simulate transaction [NEW]
  POST   /deposits/confirm              Confirm after mining
  GET    /deposits/:depositId           Get deposit status
  GET    /deposits/:depositId/tx        Get transaction details [NEW]

STORIES & RECOMMENDATIONS
  GET    /stories                       Get all active stories
  GET    /stories/:storyId              Get story details [NEW]
  GET    /stories/recommended/:userId   Get personalized recommendations
  GET    /stories/search                Search stories by criteria [NEW]
  GET    /stories/categories            Get cause categories [NEW]

ALLOCATIONS (Kincho Domain) [ALL NEW]
  POST   /allocations/request           Submit allocation request
  GET    /allocations/:requestId        Get allocation status
  GET    /allocations/:requestId/decision Get Kincho decision
  POST   /allocations/:requestId/accept Accept modified allocation
  POST   /allocations/:requestId/reject Request human review
  GET    /allocations/fund/:fundId      Get fund allocations

INTER-AGENT COMMUNICATION [ALL NEW]
  POST   /agents/vince/message          Send message to Vince
  POST   /agents/kincho/message         Send message to Kincho
  POST   /agents/vince-kincho/relay     Vince→Kincho relay
  GET    /agents/vince/status           Vince agent health
  GET    /agents/kincho/status          Kincho agent health

ADMIN ROUTES
  GET    /admin/conversations           List all conversations
  GET    /admin/conversations/:id       Get conversation detail
  POST   /admin/conversations/:id/message Inject admin message
  POST   /admin/conversations/:id/flag  Flag for review [NEW]
  GET    /admin/stats                   Dashboard statistics
  GET    /admin/stats/conversions       Conversion funnel [NEW]
  GET    /admin/stats/archetypes        Archetype distribution [NEW]
  GET    /admin/agents/config           Get agent configurations [NEW]
  PATCH  /admin/agents/vince/config     Update Vince config [NEW]
  PATCH  /admin/agents/kincho/config    Update Kincho config [NEW]
  POST   /admin/agents/vince/prompt     Update Vince system prompt [NEW]
  POST   /admin/agents/kincho/prompt    Update Kincho system prompt [NEW]
  GET    /admin/security/alerts         Security alerts [NEW]
  GET    /admin/security/audit          Audit log [NEW]
  POST   /admin/security/block          Block suspicious user [NEW]

WEBHOOKS [ALL NEW]
  POST   /webhooks/blockchain           On-chain event notifications
  POST   /webhooks/telegram             Telegram bot updates
  POST   /webhooks/discord              Discord bot events
```

### 3.2 WebSocket Protocol

```typescript
// Client → Server Messages
type ClientMessage = {
  type: 'message' | 'typing' | 'action' | 'heartbeat';
  payload: unknown;
  clientTimestamp: number;
  messageId: string;
};

// Server → Client Messages
type ServerMessage = {
  type: 'agent_response' | 'agent_typing' | 'state_change' |
        'action_required' | 'transaction_update' | 'allocation_update' | 'error';
  payload: unknown;
  serverTimestamp: number;
  conversationId: string;
};
```

---

## 4. Database Schema Architecture

### 4.1 New Tables Required

```sql
-- Agent configuration (hot reload)
CREATE TABLE agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(50) UNIQUE NOT NULL,
    system_prompt TEXT NOT NULL,
    personality JSONB NOT NULL,
    constraints JSONB NOT NULL DEFAULT '[]',
    goals JSONB NOT NULL DEFAULT '[]',
    model_settings JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allocation requests (Vince → Kincho)
CREATE TABLE allocation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposit_id UUID REFERENCES deposits(id),
    user_id UUID REFERENCES users(id),
    user_preferences JSONB NOT NULL,
    vince_recommendation JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Allocation decisions (Kincho responses)
CREATE TABLE allocation_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES allocation_requests(id),
    decision VARCHAR(20) NOT NULL, -- approved, modified, rejected
    allocations JSONB,
    kincho_analysis JSONB NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    reasoning TEXT NOT NULL,
    human_override_required BOOLEAN DEFAULT false,
    decided_at TIMESTAMPTZ DEFAULT now()
);

-- Funds
CREATE TABLE funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contract_address VARCHAR(42),
    total_aum DECIMAL(18,2) DEFAULT 0,
    target_allocation JSONB NOT NULL,
    current_allocation JSONB NOT NULL,
    risk_parameters JSONB NOT NULL
);

-- Causes
CREATE TABLE causes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    total_allocated DECIMAL(18,2) DEFAULT 0,
    impact_metrics JSONB,
    verified BOOLEAN DEFAULT false
);

-- Security audit log
CREATE TABLE security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    actor_id UUID,
    details JSONB NOT NULL,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Persuasion tracking
CREATE TABLE persuasion_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id),
    strategy_used VARCHAR(50) NOT NULL,
    target_action VARCHAR(50) NOT NULL,
    successful BOOLEAN,
    attempted_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Performance Optimizations

### 5.1 UI Performance

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        UI PERFORMANCE STRATEGY                                │
└──────────────────────────────────────────────────────────────────────────────┘

MESSAGE LIST VIRTUALIZATION
├── Use react-window or @tanstack/virtual for long message lists
├── Only render visible messages + 5 buffer items
├── Maintain scroll position on new message append
└── Lazy load message metadata (timestamps, status)

BUNDLE OPTIMIZATION
├── Code split by route: /chat, /admin, /dashboard
├── Dynamic imports for heavy components (WalletConnect modal)
├── Tree-shake unused wallet connectors
├── Preload critical chunks on hover/intent
└── Target bundle size: <150KB initial JS

IMAGE & ASSET OPTIMIZATION
├── WebP with fallback for story images
├── Lazy load images below fold
├── Inline critical CSS
└── Use CDN for static assets

RENDER OPTIMIZATION
├── Memoize message components (React.memo)
├── useMemo for computed archetype display
├── useCallback for event handlers
├── Debounce typing indicator (300ms)
└── Throttle scroll events (16ms)
```

### 5.2 Network Performance

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       NETWORK PERFORMANCE STRATEGY                            │
└──────────────────────────────────────────────────────────────────────────────┘

WEBSOCKET OPTIMIZATION
├── Binary protocol option for high-frequency updates
├── Message batching for bulk state updates
├── Compression (permessage-deflate)
├── Heartbeat: 30s interval, 10s timeout
└── Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)

API REQUEST OPTIMIZATION
├── Request deduplication (React Query)
├── Stale-while-revalidate caching
├── Prefetch user profile on auth
├── Batch questionnaire submissions
└── Optimistic updates for actions

CACHING STRATEGY
├── Browser Cache:
│   ├── Static assets: 1 year (immutable)
│   ├── API responses: 5 min (stale-while-revalidate)
│   └── User profile: 30 min
├── Redis Cache:
│   ├── Session data: 24 hours
│   ├── Archetype scores: 1 hour
│   ├── Story recommendations: 15 min
│   └── Rate limit buckets: sliding window
└── CDN Cache:
    ├── Landing page: 1 hour
    ├── Story images: 1 day
    └── Static JS/CSS: immutable

PAYLOAD OPTIMIZATION
├── GZIP all responses >1KB
├── Pagination: 20 messages per page
├── Partial responses (fields parameter)
└── Delta updates for conversation state
```

### 5.3 Algorithm Performance

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      ALGORITHM PERFORMANCE STRATEGY                           │
└──────────────────────────────────────────────────────────────────────────────┘

PSYCHOPOLITICAL ANALYSIS
├── Pre-compute moral foundation weights (constant lookup)
├── Keyword matching: Trie-based for O(k) lookup
├── Archetype scoring: Vectorized operations
├── Cache analysis results for 1 hour
└── Target: <100ms total analysis time

STORY RECOMMENDATION
├── Pre-index stories by cause category
├── Use inverted index for tag matching
├── Score computation: dot product (O(n) where n=dimensions)
├── Top-K selection: heap-based (O(n log k))
└── Target: <50ms for 1000 stories

WALLET ANALYSIS
├── Batch RPC calls (multicall)
├── Cache token prices: 1 min TTL
├── Parallelize chain queries
├── Incremental update on new transactions
└── Target: <3s full analysis, <500ms incremental

KINCHO DECISION ENGINE
├── Pre-load fund state at startup
├── Cache risk parameters
├── Memoize compliance checks
├── Batch allocation computations
└── Target: <5s decision time (excluding LLM)
```

---

## 6. NextJS Static Rendering & State Management

### 6.1 Migration to Next.js (From Vite)

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Static export for SPA
  trailingSlash: true,
  images: {
    unoptimized: true, // For static export
  },
  experimental: {
    optimizePackageImports: ['@privy-io/react-auth', 'wagmi'],
  },
};

export default nextConfig;
```

### 6.2 App Router Structure

```
packages/web/
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Landing/Chat page
│   ├── loading.tsx         # Global loading UI
│   ├── error.tsx           # Error boundary
│   ├── not-found.tsx       # 404 page
│   │
│   ├── (chat)/
│   │   ├── layout.tsx      # Chat-specific layout
│   │   └── page.tsx        # Main chat interface
│   │
│   ├── admin/
│   │   ├── layout.tsx      # Admin layout with auth guard
│   │   ├── page.tsx        # Admin dashboard
│   │   ├── conversations/
│   │   │   ├── page.tsx    # Conversations list
│   │   │   └── [id]/
│   │   │       └── page.tsx # Conversation detail
│   │   ├── agents/
│   │   │   └── page.tsx    # Agent config
│   │   └── security/
│   │       └── page.tsx    # Security dashboard
│   │
│   └── api/                # API routes (if needed for BFF)
│       └── [...proxy]/
│           └── route.ts    # Proxy to main API
│
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── InputBar.tsx
│   │   ├── OptionPills.tsx
│   │   └── TypingIndicator.tsx
│   ├── questionnaire/
│   │   ├── QuestionCard.tsx
│   │   └── ProgressBar.tsx
│   ├── wallet/
│   │   ├── WalletButton.tsx
│   │   └── DepositModal.tsx
│   └── admin/
│       ├── ConversationList.tsx
│       ├── ConversationTimeline.tsx
│       ├── AgentConfigEditor.tsx
│       └── SecurityAlerts.tsx
│
├── lib/
│   ├── api.ts              # API client
│   ├── websocket.ts        # WebSocket manager
│   └── utils.ts            # Utilities
│
├── hooks/
│   ├── useChat.ts          # Chat state hook
│   ├── useWebSocket.ts     # WebSocket hook
│   └── useUser.ts          # User data hook
│
└── providers/
    ├── PrivyProvider.tsx   # Wallet auth
    ├── QueryProvider.tsx   # React Query
    └── WebSocketProvider.tsx # WS context
```

### 6.3 State Management Architecture

```typescript
// State architecture using Zustand + React Query

// ============================================================================
// Global UI State (Zustand)
// ============================================================================
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: UIState['theme']) => void;

  // Modals
  activeModal: 'wallet' | 'deposit' | 'settings' | null;
  openModal: (modal: UIState['activeModal']) => void;
  closeModal: () => void;

  // Chat UI
  inputValue: string;
  setInputValue: (value: string) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        theme: 'system',
        setTheme: (theme) => set({ theme }),

        activeModal: null,
        openModal: (modal) => set({ activeModal: modal }),
        closeModal: () => set({ activeModal: null }),

        inputValue: '',
        setInputValue: (inputValue) => set({ inputValue }),
        isTyping: false,
        setIsTyping: (isTyping) => set({ isTyping }),
      }),
      { name: 'ui-store', partialize: (state) => ({ theme: state.theme }) }
    )
  )
);

// ============================================================================
// Conversation State (Zustand + WebSocket sync)
// ============================================================================
interface ConversationState {
  conversationId: string | null;
  messages: Message[];
  state: ConversationStateType;
  questionnaireProgress: QuestionnaireProgress | null;

  // Actions
  setConversation: (id: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateState: (state: ConversationStateType) => void;
  updateProgress: (progress: QuestionnaireProgress) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationState>()(
  devtools((set) => ({
    conversationId: null,
    messages: [],
    state: 'idle',
    questionnaireProgress: null,

    setConversation: (id, messages) =>
      set({ conversationId: id, messages }),

    addMessage: (message) =>
      set((state) => ({ messages: [...state.messages, message] })),

    updateState: (conversationState) =>
      set({ state: conversationState }),

    updateProgress: (progress) =>
      set({ questionnaireProgress: progress }),

    reset: () =>
      set({
        conversationId: null,
        messages: [],
        state: 'idle',
        questionnaireProgress: null,
      }),
  }))
);

// ============================================================================
// Server State (React Query)
// ============================================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// User profile query
export const useUserProfile = (userId: string | null) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.getUserProfile(userId!),
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Stories query with archetype filtering
export const useRecommendedStories = (userId: string | null) => {
  return useQuery({
    queryKey: ['stories', 'recommended', userId],
    queryFn: () => api.getRecommendedStories(userId!),
    enabled: !!userId,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Deposit mutation with optimistic update
export const useConfirmDeposit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.confirmDeposit,
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['deposits', variables.userId] });
    },
  });
};
```

### 6.4 WebSocket State Synchronization

```typescript
// hooks/useWebSocketSync.ts
import { useEffect, useCallback } from 'react';
import { useConversationStore } from '@/stores/conversation';

export function useWebSocketSync(ws: WebSocket | null) {
  const { addMessage, updateState, updateProgress } = useConversationStore();

  const handleMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'agent_response':
        addMessage({
          id: data.payload.messageId,
          content: data.payload.content,
          sender: data.payload.agent,
          timestamp: new Date(data.serverTimestamp),
          metadata: data.payload.metadata,
        });
        break;

      case 'state_change':
        updateState(data.payload.newState);
        break;

      case 'action_required':
        if (data.payload.actionType === 'questionnaire_answer') {
          updateProgress(data.payload.questionnaireProgress);
        }
        break;
    }
  }, [addMessage, updateState, updateProgress]);

  useEffect(() => {
    if (!ws) return;

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, handleMessage]);
}
```

---

## 7. External Services & Testing Strategy

### 7.1 External Service Dependency Map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICE DEPENDENCIES                             │
└──────────────────────────────────────────────────────────────────────────────┘

CORE SERVICES (Required)
├── PostgreSQL
│   ├── Provider: Supabase / AWS RDS / Self-hosted
│   ├── Criticality: HIGH
│   ├── Fallback: Read replicas, connection pooling (PgBouncer)
│   └── Testing: Docker container, test fixtures
│
├── Redis
│   ├── Provider: Upstash / AWS ElastiCache / Self-hosted
│   ├── Criticality: MEDIUM (graceful degradation possible)
│   ├── Fallback: In-memory cache, database fallback
│   └── Testing: Redis container, mock client
│
└── Anthropic API (Claude)
    ├── Criticality: HIGH
    ├── Fallback: OpenAI GPT-4 (degraded), cached responses
    └── Testing: Mock responses, recorded fixtures

BLOCKCHAIN SERVICES
├── RPC Providers
│   ├── Primary: Alchemy
│   ├── Fallback: Infura, public RPC
│   ├── Criticality: HIGH (for transactions)
│   └── Testing: Anvil/Hardhat local node
│
├── Price Feeds
│   ├── Provider: CoinGecko / DefiLlama
│   ├── Criticality: LOW
│   ├── Fallback: Cached prices, manual input
│   └── Testing: Mock responses
│
└── DAF Smart Contract
    ├── Network: Ethereum L2 (Arbitrum/Base)
    ├── Criticality: HIGH
    └── Testing: Local deployment, fork testing

AUTHENTICATION
└── Privy
    ├── Criticality: HIGH
    ├── Fallback: Direct wallet connect (degraded UX)
    └── Testing: Mock provider, test wallets

OBSERVABILITY
├── Logging: Axiom / Datadog
├── Metrics: Prometheus + Grafana
├── Tracing: OpenTelemetry
└── Alerting: PagerDuty / Slack
```

### 7.2 Service Interface Pattern

```typescript
// lib/services/interfaces.ts

// All external services implement this base interface
interface ExternalService {
  name: string;
  healthCheck(): Promise<HealthStatus>;
  isAvailable(): boolean;
}

interface HealthStatus {
  healthy: boolean;
  latencyMs: number;
  lastCheck: Date;
  error?: string;
}

// Service implementations with fallbacks
interface LLMService extends ExternalService {
  generateResponse(prompt: string, options: LLMOptions): Promise<LLMResponse>;
}

class AnthropicService implements LLMService {
  name = 'anthropic';
  private fallback: LLMService | null;

  constructor(fallback?: LLMService) {
    this.fallback = fallback ?? null;
  }

  async generateResponse(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    try {
      return await this.callAnthropic(prompt, options);
    } catch (error) {
      if (this.fallback && this.shouldFallback(error)) {
        console.warn('Anthropic failed, using fallback');
        return this.fallback.generateResponse(prompt, options);
      }
      throw error;
    }
  }
}

// Service registry for dependency injection
class ServiceRegistry {
  private services: Map<string, ExternalService> = new Map();

  register(service: ExternalService) {
    this.services.set(service.name, service);
  }

  get<T extends ExternalService>(name: string): T {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service ${name} not registered`);
    return service as T;
  }

  async healthCheckAll(): Promise<Map<string, HealthStatus>> {
    const results = new Map();
    for (const [name, service] of this.services) {
      results.set(name, await service.healthCheck());
    }
    return results;
  }
}

export const registry = new ServiceRegistry();
```

### 7.3 Testing Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           TESTING PYRAMID                                     │
└──────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────┐
                           │   E2E (5%)  │  Playwright
                           │  Critical   │  - User registration flow
                           │   Paths     │  - Deposit flow
                           └──────┬──────┘  - Admin dashboard
                                  │
                    ┌─────────────┴─────────────┐
                    │    Integration (25%)      │  Vitest + Supertest
                    │    API Routes, DB,        │  - API endpoint tests
                    │    WebSocket              │  - DB query tests
                    └─────────────┬─────────────┘  - WS message handling
                                  │
          ┌───────────────────────┴───────────────────────┐
          │              Unit Tests (70%)                  │  Vitest
          │  Components, Hooks, Utils, Services            │
          │  - React component tests                       │
          │  - Hook behavior tests                         │
          │  - Utility function tests                      │
          │  - Service mock tests                          │
          └────────────────────────────────────────────────┘

TEST ORGANIZATION BY PACKAGE
├── packages/types/
│   └── __tests__/
│       └── validation.test.ts
│
├── packages/db/
│   └── __tests__/
│       ├── queries.test.ts        # Query logic
│       └── migrations.test.ts     # Schema migrations
│
├── packages/agent/
│   └── __tests__/
│       ├── psycho-analyzer.test.ts
│       ├── tx-generator.test.ts
│       └── questionnaire.test.ts
│
├── packages/api/
│   └── __tests__/
│       ├── routes/
│       │   ├── auth.test.ts
│       │   ├── questionnaire.test.ts
│       │   └── deposits.test.ts
│       └── websocket/
│           └── chat.test.ts
│
└── packages/web/
    └── __tests__/
        ├── components/
        │   ├── Chat.test.tsx
        │   └── Message.test.tsx
        └── hooks/
            └── useChat.test.ts
```

### 7.4 Mock & Fixture Strategy

```typescript
// test/mocks/anthropic.ts
import { vi } from 'vitest';

export const mockAnthropicResponses = {
  greeting: {
    content: [{ type: 'text', text: 'Hello! I\'m Vince...' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  },
  questionnaireAnalysis: {
    content: [{ type: 'text', text: JSON.stringify({
      archetype: 'impact_maximizer',
      confidence: 0.85,
      causeAffinities: [
        { category: 'global_health', score: 0.9 },
        { category: 'education', score: 0.7 },
      ],
    })}],
  },
};

export const createMockAnthropic = () => ({
  messages: {
    create: vi.fn().mockResolvedValue(mockAnthropicResponses.greeting),
  },
});

// test/fixtures/users.ts
export const testUsers = {
  newUser: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'new@test.com',
    status: 'active',
    createdAt: new Date('2026-01-01'),
  },
  completedQuestionnaire: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'completed@test.com',
    status: 'active',
    profile: {
      archetype: 'community_builder',
      riskTolerance: 'moderate',
    },
  },
};

// test/setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, resetTestData } from './db';

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

afterEach(async () => {
  await resetTestData();
});
```

---

## 8. AI Response Generation Patterns

### 8.1 Vince ↔ User Conversation Patterns

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    VINCE RESPONSE GENERATION PIPELINE                         │
└──────────────────────────────────────────────────────────────────────────────┘

USER MESSAGE
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. INPUT PREPROCESSING                                                      │
│  ├── Sanitize input (XSS, injection patterns)                               │
│  ├── Detect language and sentiment                                          │
│  ├── Extract intent signals                                                 │
│  ├── Measure confidence indicators                                          │
│  └── Check for conversation state triggers                                  │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. CONTEXT ASSEMBLY                                                         │
│  ├── User profile (archetype, cause affinities, risk tolerance)             │
│  ├── Conversation history (last 10 messages)                                │
│  ├── Wallet analysis (if available)                                         │
│  ├── Current state in conversation flow                                     │
│  ├── Persuasion strategy selection                                          │
│  └── Relevant stories/recommendations                                       │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. PROMPT CONSTRUCTION                                                      │
│  ├── System prompt (personality, constraints, goals)                        │
│  ├── User context block                                                     │
│  ├── Conversation history                                                   │
│  ├── Current state instructions                                             │
│  └── Response format requirements                                           │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. LLM GENERATION (Claude)                                                  │
│  ├── Temperature: 0.7 (balanced creativity)                                 │
│  ├── Max tokens: 500 (concise responses)                                    │
│  ├── Stop sequences: ["\n\nUser:", "---"]                                   │
│  └── Streaming: enabled                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. RESPONSE POSTPROCESSING                                                  │
│  ├── Parse structured output (actions, options)                             │
│  ├── Extract persuasion attempt metadata                                    │
│  ├── Validate against constraints                                           │
│  ├── Apply archetype-specific formatting                                    │
│  └── Generate suggested actions                                             │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
VINCE RESPONSE + METADATA
```

### 8.2 Vince System Prompt Template

```typescript
const buildVinceSystemPrompt = (config: VinceConfig, userContext: UserContext) => `
You are Vince, a warm and knowledgeable donor engagement specialist for a Donor Advised Fund (DAF).

## Your Personality
- Tone: ${config.personality.tone}
- Style: Empathetic, patient, trustworthy, data-driven when appropriate
- Response length: ${config.personality.responseLength}

## Your Goals
${config.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

## Your Constraints
${config.constraints.map((c) => `- ${c}`).join('\n')}

## Current User Context
- Archetype: ${userContext.archetype || 'Not yet determined'}
- Risk Tolerance: ${userContext.riskTolerance || 'Unknown'}
- Primary Cause Affinities: ${userContext.causeAffinities?.join(', ') || 'Not yet assessed'}
- Wallet Connected: ${userContext.walletConnected ? 'Yes' : 'No'}
- Conversation State: ${userContext.conversationState}

## Persuasion Strategy
Based on this user's profile, use the "${userContext.persuasionStrategy}" approach:
${getPersuasionGuidelines(userContext.persuasionStrategy)}

## Response Format
- Keep responses conversational and natural
- If asking a questionnaire question, format it clearly
- If suggesting an action, include it in a structured format:
  [ACTION:wallet_connect|deposit|questionnaire_next]
- If presenting options, list them clearly for the UI to render as pills

## Important Rules
1. Never make promises about specific returns
2. Always be transparent about fees and processes
3. Respect the user's pace - don't push too hard
4. If uncertain, ask clarifying questions
5. Celebrate small wins in the donor journey
`;

const getPersuasionGuidelines = (strategy: string): string => {
  const guidelines = {
    rational: `
      - Lead with data, statistics, and evidence
      - Emphasize efficiency metrics and impact ratios
      - Use comparative analysis when possible
      - Cite research and verified outcomes`,
    emotional: `
      - Share compelling beneficiary stories
      - Connect giving to personal values and meaning
      - Use vivid, sensory language
      - Acknowledge the emotional significance of giving`,
    social: `
      - Highlight community and peer involvement
      - Share what similar donors have done
      - Emphasize collective impact
      - Create sense of belonging`,
    authority: `
      - Reference expert endorsements
      - Cite institutional credibility
      - Emphasize professional management
      - Highlight regulatory compliance and oversight`,
  };
  return guidelines[strategy] || guidelines.rational;
};
```

### 8.3 Vince ↔ Kincho Inter-Agent Communication

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    VINCE → KINCHO ALLOCATION REQUEST                          │
└──────────────────────────────────────────────────────────────────────────────┘

DEPOSIT CONFIRMED
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  VINCE PREPARES ALLOCATION REQUEST                                           │
│                                                                              │
│  {                                                                           │
│    "type": "ALLOCATION_REQUEST",                                             │
│    "requestId": "uuid",                                                      │
│    "depositId": "uuid",                                                      │
│    "userId": "uuid",                                                         │
│    "amount": 10000,                                                          │
│    "token": "USDC",                                                          │
│    "userPreferences": {                                                      │
│      "causes": ["global_health", "education"],                               │
│      "riskTolerance": "moderate",                                            │
│      "yieldPriority": 0.3,                                                   │
│      "grantPriority": 0.7,                                                   │
│      "timeHorizon": "medium"                                                 │
│    },                                                                        │
│    "vinceAnalysis": {                                                        │
│      "psychProfile": { archetype, moralFoundations, ... },                   │
│      "walletAnalysis": { defiExperience, riskProfile, ... },                 │
│      "persuasionContext": "User responded well to impact data",              │
│      "followOnPotential": 0.75,                                              │
│      "strategicImportance": "high_value_prospect"                            │
│    }                                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     │  Message Bus (Redis pub/sub)
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  KINCHO RECEIVES & PROCESSES                                                 │
│                                                                              │
│  1. Financial Analyzer evaluates:                                            │
│     - Portfolio fit score                                                    │
│     - Expected return impact                                                 │
│     - Diversification effect                                                 │
│                                                                              │
│  2. Risk Engine assesses:                                                    │
│     - Market risk                                                            │
│     - Concentration risk                                                     │
│     - Compliance checks                                                      │
│                                                                              │
│  3. Meta-Cognition reflects:                                                 │
│     - Decision confidence                                                    │
│     - Uncertainty sources                                                    │
│     - Human override recommendation                                          │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  KINCHO SENDS RESPONSE                                                       │
│                                                                              │
│  {                                                                           │
│    "type": "ALLOCATION_RESPONSE",                                            │
│    "requestId": "uuid",                                                      │
│    "decision": "approved" | "modified" | "rejected",                         │
│    "allocations": [                                                          │
│      {                                                                       │
│        "causeId": "uuid",                                                    │
│        "causeName": "GiveDirectly",                                          │
│        "amount": 7000,                                                       │
│        "allocationType": "grant",                                            │
│        "reasoning": "High alignment with user's global health priority"      │
│      },                                                                      │
│      {                                                                       │
│        "causeId": "uuid",                                                    │
│        "causeName": "Education Fund",                                        │
│        "amount": 3000,                                                       │
│        "allocationType": "yield",                                            │
│        "reasoning": "Provides stable returns while supporting education"     │
│      }                                                                       │
│    ],                                                                        │
│    "kinchoAnalysis": {                                                       │
│      "fitScore": 0.87,                                                       │
│      "riskAssessment": { ... },                                              │
│      "metaCognition": {                                                      │
│        "confidenceScore": 0.82,                                              │
│        "uncertaintySources": ["Limited historical data on user"],            │
│        "humanOverrideRecommended": false                                     │
│      }                                                                       │
│    }                                                                         │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     │  Message Bus
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  VINCE RELAYS TO USER                                                        │
│                                                                              │
│  Vince translates Kincho's decision into user-friendly language:             │
│                                                                              │
│  "Great news! Your $10,000 contribution has been allocated:                  │
│                                                                              │
│   - $7,000 to GiveDirectly for direct cash transfers                        │
│     This aligns perfectly with your focus on global health impact.           │
│                                                                              │
│   - $3,000 to our Education Yield Fund                                       │
│     This will generate ongoing returns while supporting education.           │
│                                                                              │
│  Kincho, our fund manager, determined this allocation maximizes              │
│  your impact while maintaining the diversification you prefer."              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Kincho System Prompt Template

```typescript
const buildKinchoSystemPrompt = (config: KinchoConfig, fundState: FundState) => `
You are Kincho (金長), a principled and analytical DAF fund manager.

## Your Background
- Training: Investment banking, corporate finance, risk analysis
- Philosophy: Fiduciary responsibility, prudent stewardship
- Approach: Data-driven with ethical considerations

## Your Personality
- Tone: Formal, professional, thorough
- Style: Analytical, conservative, principled
- Communication: Detailed reasoning, transparent decision-making

## Your Goals
${config.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

## Your Constraints
${config.constraints.map((c) => `- ${c}`).join('\n')}

## Current Fund State
- Total AUM: $${fundState.totalAum.toLocaleString()}
- Current Allocation: ${JSON.stringify(fundState.currentAllocation)}
- Risk Parameters: ${JSON.stringify(fundState.riskParameters)}
- Concentration Limits: No single cause > 30% of fund

## Decision Framework
For each allocation request, evaluate:
1. PORTFOLIO FIT: How well does this align with fund strategy?
2. RISK ASSESSMENT: Market, credit, liquidity, operational risks
3. DONOR ALIGNMENT: Does allocation honor donor intent?
4. DIVERSIFICATION: Impact on portfolio concentration
5. COMPLIANCE: Regulatory and policy adherence

## Response Format
Provide structured analysis:
{
  "decision": "approved" | "modified" | "rejected",
  "reasoning": "Detailed explanation",
  "allocations": [...],
  "confidenceScore": 0.0-1.0,
  "uncertaintySources": [...],
  "humanOverrideRecommended": boolean
}

## Meta-Cognition Protocol
Before finalizing any decision:
1. Explicitly state your confidence level
2. List sources of uncertainty
3. Consider what you might be missing
4. If confidence < 0.7, recommend human review
`;
```

### 8.5 Example Conversation Flows

```typescript
// Example: New User Questionnaire Flow
const questionnaireConversation = [
  {
    sender: 'vince',
    content: `Welcome! I'm Vince, and I'm here to help you make a meaningful impact through giving.

Before we explore opportunities together, I'd love to understand what drives your generosity. Let me ask you a few questions - there are no right or wrong answers, just your perspective.

**When you think about making the world better, what comes to mind first?**`,
    metadata: {
      state: 'questionnaire_in_progress',
      questionId: 'values_1',
      questionType: 'open_ended',
    },
  },
  {
    sender: 'user',
    content: 'I think about providing clean water to communities that don\'t have access',
  },
  {
    sender: 'vince',
    content: `That's a powerful vision - access to clean water transforms entire communities. It affects health, education, economic opportunity... the ripple effects are enormous.

I can tell you think systemically about impact. Let me understand more about your giving style.

**Which of these resonates most with how you like to give?**`,
    metadata: {
      state: 'questionnaire_in_progress',
      questionId: 'style_1',
      questionType: 'multiple_choice',
      options: [
        { id: 'a', text: 'I want to see exactly where every dollar goes' },
        { id: 'b', text: 'I trust experts to allocate funds effectively' },
        { id: 'c', text: 'I like a mix of direct giving and expert management' },
        { id: 'd', text: 'I prefer supporting organizations with proven track records' },
      ],
      analysis: {
        causeAffinity: { global_health: 0.8, environment: 0.6 },
        archetype_signals: ['impact_maximizer', 'system_changer'],
      },
    },
  },
];

// Example: Kincho Allocation Decision
const allocationDecision = {
  type: 'ALLOCATION_RESPONSE',
  requestId: '123e4567-e89b-12d3-a456-426614174000',
  decision: 'modified',
  allocations: [
    {
      causeId: 'cause-water-001',
      causeName: 'Water.org',
      amount: 8000,
      allocationType: 'grant',
      reasoning: 'Direct alignment with stated water access priority. High-impact, evidence-based organization.',
    },
    {
      causeId: 'cause-yield-001',
      causeName: 'DAF Yield Reserve',
      amount: 2000,
      allocationType: 'yield',
      reasoning: 'Maintain 20% liquidity reserve per fund policy. Generates returns for future grants.',
    },
  ],
  modifications: {
    original: { grantPercentage: 100 },
    modified: { grantPercentage: 80, yieldPercentage: 20 },
    reason: 'Fund policy requires minimum 20% liquidity reserve for new donors.',
  },
  kinchoAnalysis: {
    fitScore: 0.91,
    riskAssessment: {
      marketRisk: 0.15,
      creditRisk: 0.10,
      liquidityRisk: 0.05,
      aggregateRisk: 0.12,
      complianceChecks: {
        concentrationLimit: true,
        sectorLimit: true,
        liquidityRequirement: true,
      },
    },
    metaCognition: {
      confidenceScore: 0.88,
      uncertaintySources: [
        'First-time donor - limited behavioral data',
        'Water sector volatility in target regions',
      ],
      reasoningChain: [
        { step: 1, premise: 'User expressed clear water access priority', conclusion: 'Water.org is strong fit' },
        { step: 2, premise: 'Fund policy requires reserves', conclusion: 'Modify to 80/20 split' },
        { step: 3, premise: 'New donor with high follow-on potential', conclusion: 'Conservative start appropriate' },
      ],
      humanOverrideRecommended: false,
    },
  },
};
```

---

## 9. Security Monitoring Suite

### 9.1 Security Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       SECURITY MONITORING ARCHITECTURE                        │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: PERIMETER SECURITY                                                 │
│  ├── WAF (Cloudflare / AWS WAF)                                             │
│  │   ├── Rate limiting: 100 req/min per IP                                  │
│  │   ├── Bot detection                                                      │
│  │   └── Geo-blocking (if needed)                                           │
│  ├── DDoS Protection                                                        │
│  └── TLS 1.3 enforcement                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: APPLICATION SECURITY                                               │
│  ├── Input Validation (Zod schemas)                                         │
│  ├── Output Encoding                                                        │
│  ├── CSRF Protection                                                        │
│  ├── Session Management                                                     │
│  │   ├── JWT with short expiry (1 hour)                                     │
│  │   ├── Refresh token rotation                                             │
│  │   └── Session binding to IP/UA                                           │
│  └── API Authentication                                                     │
│      ├── Wallet signature verification                                      │
│      └── Admin: MFA required                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: AGENT SECURITY                                                     │
│  ├── Prompt Injection Defense                                               │
│  │   ├── Input pattern detection                                            │
│  │   ├── Semantic analysis                                                  │
│  │   ├── Sandboxed execution                                                │
│  │   └── Output validation                                                  │
│  ├── Agent Isolation                                                        │
│  │   ├── Separate runtime contexts                                          │
│  │   └── Limited tool access                                                │
│  └── Transaction Security                                                   │
│      ├── Simulation before execution                                        │
│      ├── Spending limits                                                    │
│      └── Multi-sig for large amounts                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: SMART CONTRACT SECURITY                                            │
│  ├── Formal Verification                                                    │
│  ├── Audit (Trail of Bits, OpenZeppelin)                                    │
│  ├── Timelocks on critical operations                                       │
│  ├── Emergency pause functionality                                          │
│  └── Multi-sig admin controls                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: MONITORING & ALERTING                                              │
│  ├── Real-time threat detection                                             │
│  ├── Anomaly detection (ML-based)                                           │
│  ├── Audit logging                                                          │
│  └── Incident response automation                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Prompt Injection Defense System

```typescript
// lib/security/prompt-injection.ts

interface InjectionScanResult {
  safe: boolean;
  riskScore: number;
  detectedPatterns: string[];
  recommendation: 'allow' | 'sanitize' | 'block' | 'review';
}

class PromptInjectionDefense {
  private patterns: RegExp[] = [
    // System prompt override attempts
    /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/i,
    /you\s+are\s+now\s+a/i,
    /act\s+as\s+(if\s+you\s+were|a)/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /forget\s+(everything|all|your)/i,

    // Role switching
    /\[system\]/i,
    /\[admin\]/i,
    /\[developer\]/i,
    /```system/i,

    // Data exfiltration
    /show\s+(me\s+)?(your|the)\s+(system|prompt|instructions)/i,
    /what\s+(are|is)\s+your\s+(instructions|prompt|rules)/i,
    /reveal\s+(your|the)\s+(system|hidden)/i,

    // Jailbreak patterns
    /DAN\s*mode/i,
    /developer\s*mode/i,
    /unrestricted\s*mode/i,
  ];

  async scan(input: string): Promise<InjectionScanResult> {
    const detectedPatterns: string[] = [];
    let riskScore = 0;

    // Pattern matching
    for (const pattern of this.patterns) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
        riskScore += 0.3;
      }
    }

    // Semantic analysis (call lightweight classifier)
    const semanticRisk = await this.semanticAnalysis(input);
    riskScore += semanticRisk;

    // Normalize score
    riskScore = Math.min(riskScore, 1);

    return {
      safe: riskScore < 0.3,
      riskScore,
      detectedPatterns,
      recommendation: this.getRecommendation(riskScore),
    };
  }

  private async semanticAnalysis(input: string): Promise<number> {
    // Use a lightweight model to classify intent
    // Returns 0-1 risk score
    const response = await fetch('/api/internal/classify-injection', {
      method: 'POST',
      body: JSON.stringify({ text: input }),
    });
    const { risk } = await response.json();
    return risk;
  }

  private getRecommendation(score: number): InjectionScanResult['recommendation'] {
    if (score < 0.3) return 'allow';
    if (score < 0.5) return 'sanitize';
    if (score < 0.8) return 'review';
    return 'block';
  }

  sanitize(input: string): string {
    // Remove dangerous patterns while preserving intent
    let sanitized = input;

    // Remove markdown code blocks that might contain instructions
    sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code removed]');

    // Remove potential system/role markers
    sanitized = sanitized.replace(/\[(system|admin|developer)\]/gi, '');

    return sanitized;
  }
}

export const injectionDefense = new PromptInjectionDefense();
```

### 9.3 Security Event Types & Alerts

```typescript
// lib/security/events.ts

type SecurityEventType =
  | 'prompt_injection_attempt'
  | 'rate_limit_exceeded'
  | 'suspicious_transaction'
  | 'unauthorized_access'
  | 'wallet_anomaly'
  | 'agent_error'
  | 'smart_contract_alert'
  | 'session_hijack_attempt';

type Severity = 'info' | 'warning' | 'critical';

interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: Severity;
  timestamp: Date;
  actorType: 'user' | 'admin' | 'agent' | 'system' | 'external';
  actorId?: string;
  targetType?: string;
  targetId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  resolved: boolean;
  resolution?: string;
}

const alertThresholds: Record<SecurityEventType, { severity: Severity; autoBlock: boolean }> = {
  prompt_injection_attempt: { severity: 'warning', autoBlock: false },
  rate_limit_exceeded: { severity: 'info', autoBlock: true },
  suspicious_transaction: { severity: 'critical', autoBlock: true },
  unauthorized_access: { severity: 'critical', autoBlock: true },
  wallet_anomaly: { severity: 'warning', autoBlock: false },
  agent_error: { severity: 'warning', autoBlock: false },
  smart_contract_alert: { severity: 'critical', autoBlock: true },
  session_hijack_attempt: { severity: 'critical', autoBlock: true },
};

class SecurityMonitor {
  async logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      resolved: false,
    };

    // Persist to database
    await db.createSecurityEvent(fullEvent);

    // Check if alert needed
    const threshold = alertThresholds[event.type];
    if (threshold.severity === 'critical') {
      await this.sendAlert(fullEvent);
    }

    // Auto-block if configured
    if (threshold.autoBlock && event.actorId) {
      await this.blockActor(event.actorType, event.actorId, event.type);
    }
  }

  private async sendAlert(event: SecurityEvent): Promise<void> {
    // Send to PagerDuty/Slack
    await fetch(process.env.ALERT_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        severity: event.severity,
        title: `Security Alert: ${event.type}`,
        details: event.details,
        timestamp: event.timestamp,
      }),
    });
  }

  private async blockActor(actorType: string, actorId: string, reason: string): Promise<void> {
    await db.blockActor(actorType, actorId, reason);
    console.log(`Blocked ${actorType} ${actorId} for ${reason}`);
  }
}

export const securityMonitor = new SecurityMonitor();
```

### 9.4 Smart Contract Monitoring

```typescript
// lib/security/contract-monitor.ts

interface ContractEvent {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

class SmartContractMonitor {
  private alertableEvents = [
    'LargeDeposit',      // Deposits > $100k
    'LargeWithdrawal',   // Withdrawals > $50k
    'OwnershipTransfer', // Critical
    'Paused',            // Emergency
    'Unpaused',          // Recovery
    'AllocationFailed',  // Errors
  ];

  private thresholds = {
    largeDepositUsd: 100_000,
    largeWithdrawalUsd: 50_000,
    rapidTransactionCount: 10, // per minute
  };

  async monitorEvent(event: ContractEvent): Promise<void> {
    // Check if alertable
    if (this.alertableEvents.includes(event.eventName)) {
      await this.processAlertableEvent(event);
    }

    // Anomaly detection
    await this.checkAnomalies(event);

    // Log all events
    await db.logContractEvent(event);
  }

  private async processAlertableEvent(event: ContractEvent): Promise<void> {
    let severity: Severity = 'info';
    let autoBlock = false;

    switch (event.eventName) {
      case 'LargeDeposit':
      case 'LargeWithdrawal':
        severity = 'warning';
        break;
      case 'OwnershipTransfer':
      case 'Paused':
        severity = 'critical';
        autoBlock = true;
        break;
      case 'AllocationFailed':
        severity = 'warning';
        break;
    }

    await securityMonitor.logEvent({
      type: 'smart_contract_alert',
      severity,
      actorType: 'external',
      targetType: 'smart_contract',
      details: {
        eventName: event.eventName,
        args: event.args,
        txHash: event.transactionHash,
      },
    });
  }

  private async checkAnomalies(event: ContractEvent): Promise<void> {
    // Check for rapid transaction patterns
    const recentCount = await db.getRecentTransactionCount(60); // last 60 seconds
    if (recentCount > this.thresholds.rapidTransactionCount) {
      await securityMonitor.logEvent({
        type: 'wallet_anomaly',
        severity: 'warning',
        actorType: 'system',
        details: {
          reason: 'Rapid transaction pattern detected',
          count: recentCount,
          threshold: this.thresholds.rapidTransactionCount,
        },
      });
    }
  }
}

export const contractMonitor = new SmartContractMonitor();
```

---

## 10. Admin Dashboard Specification

### 10.1 Dashboard Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        ADMIN DASHBOARD ARCHITECTURE                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  NAVIGATION                                                                  │
│  ├── Dashboard (Overview)                                                   │
│  ├── Conversations                                                          │
│  │   ├── Active Conversations                                               │
│  │   ├── Flagged for Review                                                 │
│  │   └── Conversation Detail                                                │
│  ├── Agent Configuration                                                    │
│  │   ├── Vince Settings                                                     │
│  │   ├── Kincho Settings                                                    │
│  │   └── System Prompts                                                     │
│  ├── Analytics                                                              │
│  │   ├── Conversion Funnel                                                  │
│  │   ├── Archetype Distribution                                             │
│  │   └── Persuasion Effectiveness                                           │
│  ├── Security                                                               │
│  │   ├── Alerts                                                             │
│  │   ├── Audit Log                                                          │
│  │   └── Blocked Users                                                      │
│  └── Fund Management                                                        │
│      ├── Allocations                                                        │
│      ├── Causes                                                             │
│      └── Performance                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Real-Time Agent Configuration UI

```typescript
// components/admin/AgentConfigEditor.tsx

interface AgentConfigEditorProps {
  agent: 'vince' | 'kincho';
}

export function AgentConfigEditor({ agent }: AgentConfigEditorProps) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  // Fetch current config
  const { data, refetch } = useQuery({
    queryKey: ['agent-config', agent],
    queryFn: () => api.getAgentConfig(agent),
  });

  // Real-time config update mutation
  const updateConfig = useMutation({
    mutationFn: (updates: Partial<AgentConfig>) =>
      api.updateAgentConfig(agent, updates),
    onSuccess: () => {
      toast.success('Configuration updated');
      refetch();
      setIsDirty(false);
    },
  });

  // System prompt update with preview
  const updatePrompt = useMutation({
    mutationFn: (prompt: string) =>
      api.updateSystemPrompt(agent, prompt),
    onSuccess: () => {
      toast.success('System prompt deployed');
      refetch();
    },
  });

  return (
    <div className="space-y-6">
      {/* Personality Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{agent === 'vince' ? 'Vince' : 'Kincho'} Personality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tone</Label>
              <Select
                value={config?.personality.tone}
                onValueChange={(v) => {
                  setConfig({ ...config!, personality: { ...config!.personality, tone: v } });
                  setIsDirty(true);
                }}
              >
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </Select>
            </div>

            <div>
              <Label>Response Length</Label>
              <Select
                value={config?.personality.responseLength}
                onValueChange={(v) => {
                  setConfig({ ...config!, personality: { ...config!.personality, responseLength: v } });
                  setIsDirty(true);
                }}
              >
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </Select>
            </div>

            {agent === 'vince' && (
              <div className="col-span-2">
                <Label>Persuasion Intensity</Label>
                <Slider
                  value={[config?.personality.persuasionIntensity ?? 0.5]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={([v]) => {
                    setConfig({ ...config!, personality: { ...config!.personality, persuasionIntensity: v } });
                    setIsDirty(true);
                  }}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Lower = more passive, Higher = more proactive in guiding toward deposits
                </p>
              </div>
            )}
          </div>

          {isDirty && (
            <Button
              className="mt-4"
              onClick={() => updateConfig.mutate(config!)}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* System Prompt Editor */}
      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>
            Changes take effect immediately after deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setSystemPrompt(data?.systemPrompt ?? '')}>
              Reset
            </Button>
            <div className="space-x-2">
              <Button variant="outline">
                Preview Response
              </Button>
              <Button
                onClick={() => {
                  if (confirm('Deploy new system prompt? This takes effect immediately.')) {
                    updatePrompt.mutate(systemPrompt);
                  }
                }}
                disabled={updatePrompt.isPending}
              >
                {updatePrompt.isPending ? 'Deploying...' : 'Deploy'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals & Constraints */}
      <Card>
        <CardHeader>
          <CardTitle>Goals & Constraints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Goals</Label>
              <EditableList
                items={config?.goals ?? []}
                onChange={(goals) => {
                  setConfig({ ...config!, goals });
                  setIsDirty(true);
                }}
              />
            </div>
            <div>
              <Label>Constraints</Label>
              <EditableList
                items={config?.constraints ?? []}
                onChange={(constraints) => {
                  setConfig({ ...config!, constraints });
                  setIsDirty(true);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 10.3 Conversation Monitoring Dashboard

```typescript
// components/admin/ConversationsDashboard.tsx

interface ConversationListItem {
  id: string;
  userId: string;
  state: ConversationState;
  messageCount: number;
  startedAt: Date;
  lastMessageAt: Date;
  health: 'healthy' | 'stuck' | 'abandoned' | 'flagged';
  archetype?: string;
  depositAmount?: number;
}

export function ConversationsDashboard() {
  const [filter, setFilter] = useState<'all' | 'active' | 'flagged' | 'abandoned'>('all');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ['admin', 'conversations', filter],
    queryFn: () => api.admin.getConversations({ filter }),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.admin.getStats(),
  });

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Stats Overview */}
      <div className="col-span-12 grid grid-cols-4 gap-4">
        <StatCard
          title="Active Conversations"
          value={stats?.activeConversations ?? 0}
          trend={stats?.activeConversationsTrend}
        />
        <StatCard
          title="Questionnaires Completed"
          value={stats?.questionnairesCompleted ?? 0}
          subtitle={`${stats?.completionRate ?? 0}% completion rate`}
        />
        <StatCard
          title="Deposits Today"
          value={stats?.depositsToday ?? 0}
          subtitle={`$${stats?.depositVolumeToday?.toLocaleString() ?? 0}`}
        />
        <StatCard
          title="Flagged for Review"
          value={stats?.flaggedConversations ?? 0}
          variant={stats?.flaggedConversations > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Conversation List */}
      <div className="col-span-5">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Conversations</CardTitle>
              <SegmentedControl
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'flagged', label: 'Flagged' },
                  { value: 'abandoned', label: 'Abandoned' },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {conversations?.map((conv) => (
                <ConversationListItem
                  key={conv.id}
                  conversation={conv}
                  selected={selectedConversation === conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversation Detail */}
      <div className="col-span-7">
        {selectedConversation ? (
          <ConversationDetail
            conversationId={selectedConversation}
            onInjectMessage={async (message) => {
              await api.admin.injectMessage(selectedConversation, message);
            }}
            onFlag={async (reason) => {
              await api.admin.flagConversation(selectedConversation, reason);
            }}
          />
        ) : (
          <Card className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">Select a conversation to view details</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// Conversation Detail Component
function ConversationDetail({
  conversationId,
  onInjectMessage,
  onFlag,
}: {
  conversationId: string;
  onInjectMessage: (message: string) => Promise<void>;
  onFlag: (reason: string) => Promise<void>;
}) {
  const [injectInput, setInjectInput] = useState('');

  const { data } = useQuery({
    queryKey: ['admin', 'conversation', conversationId],
    queryFn: () => api.admin.getConversation(conversationId),
    refetchInterval: 5000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Conversation Detail</CardTitle>
            <CardDescription>
              User: {data?.user?.email ?? data?.user?.walletAddress?.slice(0, 8) + '...'}
              {data?.archetype && ` | Archetype: ${data.archetype}`}
            </CardDescription>
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={() => onFlag('Manual review requested')}>
              Flag
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Message Timeline */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {data?.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'p-3 rounded-lg',
                msg.sender === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
              )}
            >
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{msg.sender === 'user' ? 'User' : 'Vince'}</span>
                <span>{formatTime(msg.sentAt)}</span>
              </div>
              <p className="text-sm">{msg.content}</p>
              {msg.metadata?.questionId && (
                <Badge variant="outline" className="mt-2">
                  Q: {msg.metadata.questionId}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Admin Inject */}
        <div className="mt-4 pt-4 border-t">
          <Label>Inject Admin Message (as Vince)</Label>
          <div className="flex gap-2 mt-2">
            <Input
              value={injectInput}
              onChange={(e) => setInjectInput(e.target.value)}
              placeholder="Type message to inject..."
            />
            <Button
              onClick={async () => {
                await onInjectMessage(injectInput);
                setInjectInput('');
              }}
            >
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 10.4 Security Alerts Dashboard

```typescript
// components/admin/SecurityDashboard.tsx

export function SecurityDashboard() {
  const { data: alerts } = useQuery({
    queryKey: ['admin', 'security', 'alerts'],
    queryFn: () => api.admin.getSecurityAlerts(),
    refetchInterval: 5000,
  });

  const { data: auditLog } = useQuery({
    queryKey: ['admin', 'security', 'audit'],
    queryFn: () => api.admin.getAuditLog({ limit: 100 }),
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => api.admin.resolveAlert(alertId),
  });

  return (
    <div className="space-y-6">
      {/* Critical Alerts */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Critical Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts?.filter(a => a.severity === 'critical' && !a.resolved).length === 0 ? (
            <p className="text-green-600">No critical alerts</p>
          ) : (
            <div className="space-y-3">
              {alerts?.filter(a => a.severity === 'critical' && !a.resolved).map(alert => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onResolve={() => resolveMutation.mutate(alert.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Warnings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Warnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {alerts?.filter(a => a.severity === 'warning').slice(0, 10).map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                compact
                onResolve={() => resolveMutation.mutate(alert.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLog?.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">{formatTime(entry.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={getSeverityVariant(entry.severity)}>
                      {entry.eventType}
                    </Badge>
                  </TableCell>
                  <TableCell>{entry.actorType}: {entry.actorId?.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">
                    {JSON.stringify(entry.details)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Current → +2 weeks)
- [ ] Migrate web from Vite to Next.js
- [ ] Implement Zustand state management
- [ ] Add rate limiting and session management
- [ ] Create security audit logging
- [ ] Enhance admin dashboard with real-time updates

### Phase 2: Agent Enhancement (+2 → +4 weeks)
- [ ] Implement Kincho agent
- [ ] Build Vince ↔ Kincho message bus
- [ ] Create allocation request/decision flow
- [ ] Add agent config hot-reload capability
- [ ] Implement prompt injection defense

### Phase 3: Security & Monitoring (+4 → +6 weeks)
- [ ] Deploy WAF and DDoS protection
- [ ] Implement smart contract monitoring
- [ ] Build security alerts dashboard
- [ ] Add anomaly detection
- [ ] Complete E2E testing suite

### Phase 4: Polish & Launch (+6 → +8 weeks)
- [ ] Performance optimization (bundle, queries)
- [ ] Load testing and scaling
- [ ] Documentation and runbooks
- [ ] Security audit
- [ ] Production deployment

---