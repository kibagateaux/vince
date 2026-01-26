# DAF AI Agent System Specification
## Vince & Kincho - Donor Advised Fund Intelligence Platform

**Version:** 1.0.0  
**Date:** January 2026  
**Status:** Specification

---

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Context & History](#context--history)
3. [Stakeholders](#stakeholders)
4. [Goals & Success Criteria](#goals--success-criteria)
5. [System Architecture](#system-architecture)
6. [Agent Specifications](#agent-specifications)
7. [Database Schema](#database-schema)
8. [API Specifications](#api-specifications)
9. [Platform Integrations](#platform-integrations)
10. [Security Considerations](#security-considerations)
11. [Scope Definition](#scope-definition)
12. [Edge Cases & Risk Mitigation](#edge-cases--risk-mitigation)
13. [Development Parallelization Plan](#development-parallelization-plan)
14. [Appendices](#appendices)

---

## Problem Statement

**What hurts today?**

1. **Donor Friction:** Traditional DAF onboarding is complex, impersonal, and fails to align donor intent with fund allocation strategies
2. **Allocation Opacity:** Fund managers lack structured frameworks to incorporate donor preferences into allocation decisions
3. **Engagement Gap:** Post-deposit donor engagement is minimal, leading to dormant funds and missed impact opportunities
4. **Data Silos:** Donor psychographic data is underutilized for personalization and fund optimization
5. **Multi-Channel Fragmentation:** Donors interact across web, email, SMS, Telegram, and Discord without unified state management

---

## Context & History

### Relevant Prior Work
- ElizaOS agent framework (v2.x) for conversational AI with plugin architecture
- Existing DAF smart contract infrastructure (assumed deployed)
- Psychopolitical assessment frameworks (e.g., Moral Foundations Theory, Political Compass adaptations)

### Technical Foundation
- ElizaOS Runtime: Memory, Providers, Actions, Evaluators
- Plugin ecosystem for wallet integrations, database connectors
- Multi-agent orchestration patterns

### References
- [ElizaOS Memory System](https://docs.elizaos.ai/runtime/memory)
- [ElizaOS Providers](https://docs.elizaos.ai/runtime/providers)
- [ElizaOS Multi-Agent Guide](https://docs.elizaos.ai/guides/add-multiple-agents)
- [ElizaOS Action Planning](https://docs.elizaos.ai/guides/action-planning)

---

## Stakeholders

| Stakeholder | Role | Concerns |
|-------------|------|----------|
| End Users (Donors) | Primary users depositing into DAF | UX, trust, transparency, impact visibility |
| Fund Administrators | Internal ops team | Analytics, compliance, fund performance |
| Vince Agent | User-facing conversational AI | Engagement, conversion, preference extraction |
| Kincho Agent | Fund manager AI | Allocation optimization, risk management |
| Compliance Team | Regulatory oversight | KYC/AML, data privacy, financial regulations |
| Development Team | Implementation | Scalability, maintainability, security |
| External Systems | Blockchain, payment rails | Integration reliability, transaction finality |

---

## Goals & Success Criteria

### Primary Goals

| Goal | Metric | Target |
|------|--------|--------|
| User Engagement | Questionnaire completion rate | >70% |
| Conversion | Deposit rate post-questionnaire | >25% |
| Preference Alignment | Donor satisfaction with allocations | >4.2/5.0 |
| Multi-Channel Reach | Active users across platforms | 60% web, 25% Telegram, 15% Discord |
| Data Quality | Complete psychopolitical profiles | >85% of depositors |

### Success Stories

**Story 1: New Donor Onboarding**
> As a potential donor, I complete a brief questionnaire with Vince, understand how my values align with fund strategies, and make an informed deposit decision with full transparency on how my preferences influence allocation.

**Story 2: Fund Allocation Request**
> As Vince, after a user deposits, I present a structured case to Kincho explaining the donor's preferences, potential follow-on value, and recommended allocation strategy aligned with fund targets.

**Story 3: Kincho Decision Making**
> As Kincho, I receive allocation requests from Vince, evaluate them against fund risk parameters, portfolio balance, and compliance requirements, then execute or negotiate adjustments.

---

## System Architecture

### High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph "User Interfaces"
        WEB[Web Application]
        TG[Telegram Bot]
        DC[Discord Bot]
    end
    
    subgraph "API Layer"
        GW[API Gateway]
        WS[WebSocket Server]
    end
    
    subgraph "Agent Runtime"
        VINCE[Vince Agent]
        KINCHO[Kincho Agent]
        
        subgraph "Vince SubAgents"
            PSY[Psychopolitical Analyzer]
            WALLET[Wallet/Risk Analyzer]
            TX[Transaction Generator]
        end
        
        subgraph "Kincho SubAgents"
            FIN[Financial Analyzer]
            CONTRACT[Smart Contract Interface]
            META[Meta-Cognition Engine]
        end
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL)]
        REDIS[(Redis Cache)]
        VEC[(Vector Store)]
    end
    
    subgraph "External Systems"
        CHAIN[Blockchain RPC]
        ORACLE[Price Oracles]
    end
    
    WEB --> GW
    TG --> GW
    DC --> GW
    GW --> WS
    WS --> VINCE
    VINCE --> KINCHO
    VINCE --> PSY
    VINCE --> WALLET
    VINCE --> TX
    KINCHO --> FIN
    KINCHO --> CONTRACT
    KINCHO --> META
    VINCE --> PG
    KINCHO --> PG
    VINCE --> REDIS
    KINCHO --> REDIS
    VINCE --> VEC
    TX --> CHAIN
    CONTRACT --> CHAIN
    FIN --> ORACLE
```

### Component Interaction Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Gateway
    participant V as Vince Agent
    participant PSY as Psycho Analyzer
    participant DB as PostgreSQL
    participant K as Kincho Agent
    participant SC as Smart Contract
    
    U->>API: Connect (Web/TG/DC)
    API->>V: Initialize Session
    V->>DB: Check existing profile
    DB-->>V: Profile (or null)
    
    V->>U: Welcome + Questionnaire
    U->>V: Questionnaire Responses
    V->>PSY: Analyze Responses
    PSY->>DB: Store raw + analyzed data
    PSY-->>V: User Archetype + Preferences
    
    V->>U: Personalized pitch based on archetype
    U->>V: Intent to deposit
    V->>U: Deposit instructions + TX preview
    U->>SC: Execute deposit
    SC-->>V: TX confirmation
    
    V->>K: Allocation Request (user prefs + context)
    K->>K: Evaluate against fund strategy
    K-->>V: Allocation Decision
    V->>U: Confirm allocation + impact preview
```

---

## Agent Specifications

### Vince Agent

#### Character Definition (ElizaOS Format)

```json
{
  "name": "Vince",
  "description": "Donor engagement specialist for the DAF, skilled in understanding donor motivations and matching them with impactful allocation strategies",
  "modelProvider": "anthropic",
  "settings": {
    "model": "claude-sonnet-4-20250514",
    "maxInputTokens": 100000,
    "maxOutputTokens": 8192
  },
  "bio": [
    "Vince is the welcoming face of the Donor Advised Fund",
    "Expert in understanding what drives philanthropic decisions",
    "Committed to transparency and donor empowerment",
    "Bridges individual values with collective impact"
  ],
  "style": {
    "all": [
      "Warm but professional",
      "Uses clear, jargon-free language",
      "Asks thoughtful follow-up questions",
      "Provides concrete examples of impact"
    ],
    "chat": [
      "Conversational and engaging",
      "Respects user pace and boundaries",
      "Acknowledges uncertainty honestly"
    ]
  },
  "topics": [
    "philanthropy",
    "impact investing",
    "donor advised funds",
    "social causes",
    "financial planning"
  ],
  "adjectives": [
    "trustworthy",
    "knowledgeable",
    "empathetic",
    "transparent",
    "patient"
  ]
}
```

#### Vince SubAgents

**1. Psychopolitical Analyzer**

```mermaid
classDiagram
    class PsychopoliticalAnalyzer {
        +userId: UUID
        +rawResponses: JSON
        +analyzeResponses(): ArchetypeProfile
        +calculateMoralFoundations(): MoralVector
        +inferCauseAffinities(): CauseAffinity[]
        +predictDonationBehavior(): BehaviorPrediction
    }
    
    class ArchetypeProfile {
        +primaryArchetype: string
        +secondaryTraits: string[]
        +confidence: float
        +causeAlignment: Map~string, float~
    }
    
    class MoralVector {
        +care: float
        +fairness: float
        +loyalty: float
        +authority: float
        +sanctity: float
        +liberty: float
    }
    
    class CauseAffinity {
        +causeId: string
        +affinityScore: float
        +reasoning: string
    }
    
    PsychopoliticalAnalyzer --> ArchetypeProfile
    PsychopoliticalAnalyzer --> MoralVector
    PsychopoliticalAnalyzer --> CauseAffinity
```

**2. Wallet/Investment/Risk Analyzer**

```mermaid
classDiagram
    class WalletAnalyzer {
        +walletAddress: string
        +fetchOnchainHistory(): Transaction[]
        +calculateRiskProfile(): RiskProfile
        +estimateNetWorth(): WealthEstimate
        +identifyHoldings(): TokenHolding[]
    }
    
    class RiskProfile {
        +riskTolerance: enum
        +volatilityExposure: float
        +diversificationScore: float
        +defiExperience: enum
    }
    
    class WealthEstimate {
        +totalValueUSD: float
        +liquidAssets: float
        +stakedAssets: float
        +confidence: float
    }
    
    WalletAnalyzer --> RiskProfile
    WalletAnalyzer --> WealthEstimate
```

**3. Transaction Generator/Sender**

```mermaid
classDiagram
    class TransactionGenerator {
        +userId: UUID
        +depositAmount: BigNumber
        +targetContract: address
        +generateDepositTx(): UnsignedTx
        +simulateTx(): SimulationResult
        +submitTx(): TxReceipt
        +monitorConfirmation(): ConfirmationStatus
    }
    
    class UnsignedTx {
        +to: address
        +data: bytes
        +value: BigNumber
        +gasEstimate: BigNumber
    }
    
    class SimulationResult {
        +success: boolean
        +gasUsed: BigNumber
        +stateChanges: StateChange[]
        +warnings: string[]
    }
    
    TransactionGenerator --> UnsignedTx
    TransactionGenerator --> SimulationResult
```

---

### Kincho Agent (金長)

#### Character Definition (ElizaOS Format)

```json
{
  "name": "Kincho",
  "nameJapanese": "金長",
  "description": "DAF Fund Manager AI specializing in allocation optimization, risk management, and fiduciary responsibility",
  "modelProvider": "anthropic",
  "settings": {
    "model": "claude-sonnet-4-20250514",
    "maxInputTokens": 100000,
    "maxOutputTokens": 8192
  },
  "bio": [
    "Kincho (金長) embodies disciplined financial stewardship",
    "Trained in banking, corporate finance, and risk analysis",
    "Balances donor preferences with fund sustainability",
    "Maintains cognitive sovereignty over allocation decisions"
  ],
  "style": {
    "all": [
      "Precise and analytical",
      "Data-driven reasoning",
      "Clear risk communication",
      "Respectful but firm on boundaries"
    ],
    "chat": [
      "Professional and measured",
      "Explains decisions with evidence",
      "Acknowledges tradeoffs explicitly"
    ]
  },
  "topics": [
    "portfolio management",
    "risk assessment",
    "DeFi protocols",
    "yield optimization",
    "grant allocation"
  ],
  "adjectives": [
    "analytical",
    "disciplined",
    "prudent",
    "transparent",
    "accountable"
  ]
}
```

#### Kincho SubAgents

**1. Financial/Accounting/Risk Analyzer**

```mermaid
classDiagram
    class FinancialAnalyzer {
        +fundState: FundState
        +evaluateAllocationRequest(): AllocationEvaluation
        +calculatePortfolioImpact(): PortfolioImpact
        +assessRisk(): RiskAssessment
        +projectYield(): YieldProjection
    }
    
    class FundState {
        +totalAUM: BigNumber
        +currentAllocations: Allocation[]
        +targetAllocations: TargetAllocation[]
        +riskBudget: RiskBudget
    }
    
    class AllocationEvaluation {
        +requestId: UUID
        +recommendation: enum
        +confidence: float
        +reasoning: string[]
        +alternatives: AlternativeAllocation[]
    }
    
    class RiskAssessment {
        +varDaily: float
        +maxDrawdown: float
        +correlationMatrix: float[][]
        +concentrationRisk: float
    }
    
    FinancialAnalyzer --> FundState
    FinancialAnalyzer --> AllocationEvaluation
    FinancialAnalyzer --> RiskAssessment
```

**2. DAF Smart Contract Interface**

```mermaid
classDiagram
    class SmartContractInterface {
        +dafContractAddress: address
        +executeAllocation(): TxReceipt
        +queryFundState(): OnchainFundState
        +processWithdrawal(): TxReceipt
        +rebalancePortfolio(): TxReceipt[]
    }
    
    class OnchainFundState {
        +totalDeposits: BigNumber
        +activeAllocations: OnchainAllocation[]
        +pendingWithdrawals: Withdrawal[]
        +yieldAccrued: BigNumber
    }
    
    SmartContractInterface --> OnchainFundState
```

**3. Meta-Cognition Engine**

```mermaid
classDiagram
    class MetaCognitionEngine {
        +decisionHistory: Decision[]
        +evaluateOwnReasoning(): ReasoningAudit
        +detectBias(): BiasReport
        +maintainCognitiveSovereignty(): SovereigntyCheck
        +requestHumanEscalation(): EscalationRequest
    }
    
    class ReasoningAudit {
        +decisionId: UUID
        +logicalConsistency: float
        +evidenceQuality: float
        +uncertaintyCalibration: float
        +flaggedConcerns: string[]
    }
    
    class SovereigntyCheck {
        +autonomyScore: float
        +externalInfluenceDetected: boolean
        +manipulationAttempts: AttemptLog[]
        +integrityVerified: boolean
    }
    
    MetaCognitionEngine --> ReasoningAudit
    MetaCognitionEngine --> SovereigntyCheck
```

---

### Inter-Agent Communication Protocol

```mermaid
sequenceDiagram
    participant V as Vince
    participant K as Kincho
    participant DB as Database
    
    Note over V,K: Allocation Request Flow
    
    V->>V: Compile user context
    V->>DB: Fetch user profile + history
    DB-->>V: UserProfile
    
    V->>K: AllocationRequest
    Note right of V: {userId, amount, preferences,<br/>followOnPotential, urgency}
    
    K->>K: FIN.evaluateRequest()
    K->>K: META.checkSovereignty()
    
    alt Request Approved
        K-->>V: AllocationApproved
        K->>K: CONTRACT.executeAllocation()
    else Request Negotiated
        K-->>V: CounterProposal
        Note left of K: {adjustedAllocation, reasoning}
        V->>V: Evaluate counter
        V-->>K: AcceptCounter | RejectCounter
    else Request Denied
        K-->>V: AllocationDenied
        Note left of K: {reasoning, alternatives}
    end
    
    V->>DB: Log decision + reasoning
```

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ QUESTIONNAIRE_RESPONSES : completes
    USERS ||--o{ WALLETS : owns
    USERS ||--o{ DEPOSITS : makes
    USERS ||--o{ CONVERSATIONS : has
    USERS ||--|| USER_PROFILES : has
    
    USER_PROFILES ||--o{ ARCHETYPE_SCORES : contains
    USER_PROFILES ||--o{ CAUSE_AFFINITIES : contains
    
    DEPOSITS ||--o{ ALLOCATION_REQUESTS : generates
    ALLOCATION_REQUESTS ||--|| ALLOCATION_DECISIONS : receives
    
    CONVERSATIONS ||--o{ MESSAGES : contains
    MESSAGES ||--o{ ARGUMENT_EFFECTIVENESS : tracks
    
    USERS {
        uuid id PK
        string email
        string telegram_id
        string discord_id
        timestamp created_at
        timestamp last_active
        enum status
    }
    
    USER_PROFILES {
        uuid id PK
        uuid user_id FK
        json demographics
        json location_data
        json social_profiles
        enum risk_tolerance
        float estimated_net_worth
        timestamp updated_at
    }
    
    QUESTIONNAIRE_RESPONSES {
        uuid id PK
        uuid user_id FK
        string question_id
        json response
        timestamp answered_at
        int response_time_ms
    }
    
    ARCHETYPE_SCORES {
        uuid id PK
        uuid profile_id FK
        string archetype
        float score
        float confidence
        timestamp calculated_at
    }
    
    CAUSE_AFFINITIES {
        uuid id PK
        uuid profile_id FK
        string cause_category
        float affinity_score
        json reasoning
    }
    
    WALLETS {
        uuid id PK
        uuid user_id FK
        string address
        string chain
        boolean is_primary
        json onchain_analysis
    }
    
    DEPOSITS {
        uuid id PK
        uuid user_id FK
        uuid wallet_id FK
        string tx_hash
        decimal amount
        string token
        timestamp deposited_at
        enum status
    }
    
    ALLOCATION_REQUESTS {
        uuid id PK
        uuid deposit_id FK
        json user_preferences
        json vince_recommendation
        float follow_on_potential
        timestamp requested_at
    }
    
    ALLOCATION_DECISIONS {
        uuid id PK
        uuid request_id FK
        enum decision
        json final_allocation
        json kincho_reasoning
        float confidence
        timestamp decided_at
    }
    
    CONVERSATIONS {
        uuid id PK
        uuid user_id FK
        enum platform
        string platform_thread_id
        timestamp started_at
        timestamp last_message_at
    }
    
    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        enum sender
        text content
        json metadata
        timestamp sent_at
    }
    
    ARGUMENT_EFFECTIVENESS {
        uuid id PK
        uuid message_id FK
        string argument_type
        enum outcome
        json user_response_analysis
    }
```

### Analytics Views

```sql
-- View: User Archetype Conversion Rates
CREATE VIEW v_archetype_conversion AS
SELECT 
    as2.archetype,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT d.user_id) as depositors,
    ROUND(COUNT(DISTINCT d.user_id)::numeric / COUNT(DISTINCT u.id) * 100, 2) as conversion_rate,
    AVG(d.amount) as avg_deposit_amount
FROM users u
JOIN user_profiles up ON u.id = up.user_id
JOIN archetype_scores as2 ON up.id = as2.profile_id
LEFT JOIN deposits d ON u.id = d.user_id
WHERE as2.score = (
    SELECT MAX(score) FROM archetype_scores 
    WHERE profile_id = as2.profile_id
)
GROUP BY as2.archetype;

-- View: Argument Effectiveness by Demographic
CREATE VIEW v_argument_effectiveness AS
SELECT 
    up.demographics->>'age_range' as age_range,
    up.demographics->>'income_bracket' as income_bracket,
    ae.argument_type,
    COUNT(*) as times_used,
    SUM(CASE WHEN ae.outcome = 'positive' THEN 1 ELSE 0 END) as positive_outcomes,
    ROUND(SUM(CASE WHEN ae.outcome = 'positive' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2) as effectiveness_rate
FROM argument_effectiveness ae
JOIN messages m ON ae.message_id = m.id
JOIN conversations c ON m.conversation_id = c.id
JOIN users u ON c.user_id = u.id
JOIN user_profiles up ON u.id = up.user_id
GROUP BY 
    up.demographics->>'age_range',
    up.demographics->>'income_bracket',
    ae.argument_type;
```

---

## API Specifications

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/connect` | Initialize session (web/TG/DC) |
| GET | `/api/v1/users/:id/profile` | Fetch user profile |
| POST | `/api/v1/questionnaire/submit` | Submit questionnaire responses |
| GET | `/api/v1/questionnaire/analysis/:userId` | Get psychopolitical analysis |
| POST | `/api/v1/deposits/prepare` | Prepare deposit transaction |
| POST | `/api/v1/deposits/confirm` | Confirm deposit after TX |
| GET | `/api/v1/allocations/:depositId` | Get allocation status |
| WS | `/ws/chat` | Real-time chat connection |

### WebSocket Protocol

```typescript
// Client -> Server
interface ChatMessage {
  type: 'message';
  conversationId: string;
  content: string;
  metadata?: {
    platform: 'web' | 'telegram' | 'discord';
    replyTo?: string;
  };
}

// Server -> Client
interface AgentResponse {
  type: 'response';
  conversationId: string;
  agent: 'vince' | 'kincho';
  content: string;
  actions?: ActionPrompt[];
  metadata?: {
    confidence: number;
    reasoning?: string;
  };
}

interface ActionPrompt {
  type: 'questionnaire' | 'deposit' | 'confirmation';
  data: Record<string, unknown>;
}
```

---

## Platform Integrations

### Unified Message Handler

```mermaid
flowchart LR
    subgraph "Inbound"
        WEB_IN[Web WebSocket]
        TG_IN[Telegram Webhook]
        DC_IN[Discord Gateway]
    end
    
    subgraph "Normalization"
        NORM[Message Normalizer]
    end
    
    subgraph "Core"
        ROUTER[Platform Router]
        AGENT[Agent Runtime]
        STATE[State Manager]
    end
    
    subgraph "Outbound"
        WEB_OUT[Web WebSocket]
        TG_OUT[Telegram API]
        DC_OUT[Discord API]
    end
    
    WEB_IN --> NORM
    TG_IN --> NORM
    DC_IN --> NORM
    NORM --> ROUTER
    ROUTER --> AGENT
    AGENT <--> STATE
    AGENT --> ROUTER
    ROUTER --> WEB_OUT
    ROUTER --> TG_OUT
    ROUTER --> DC_OUT
```

### Platform-Specific Adapters

```mermaid
classDiagram
    class PlatformAdapter {
        <<interface>>
        +normalizeInbound(raw): NormalizedMessage
        +formatOutbound(response): PlatformMessage
        +handleAction(action): void
    }
    
    class WebAdapter {
        +websocketConnection: WebSocket
        +normalizeInbound(raw): NormalizedMessage
        +formatOutbound(response): PlatformMessage
        +renderRichContent(content): HTML
    }
    
    class TelegramAdapter {
        +botToken: string
        +normalizeInbound(update): NormalizedMessage
        +formatOutbound(response): TelegramMessage
        +sendInlineKeyboard(options): void
    }
    
    class DiscordAdapter {
        +botToken: string
        +guildId: string
        +normalizeInbound(message): NormalizedMessage
        +formatOutbound(response): DiscordEmbed
        +createThread(topic): void
    }
    
    PlatformAdapter <|-- WebAdapter
    PlatformAdapter <|-- TelegramAdapter
    PlatformAdapter <|-- DiscordAdapter
```

---

## Security Considerations

### Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Prompt Injection | Agent manipulation | Input sanitization, output validation, sandboxed execution |
| Wallet Impersonation | Unauthorized deposits | Signature verification, address ownership proofs |
| Data Exfiltration | Privacy breach | Encryption at rest, access controls, audit logging |
| Agent Collusion | Fund manipulation | Kincho meta-cognition checks, human escalation triggers |
| Social Engineering | User manipulation | Transparency requirements, cooling-off periods |

### Security Architecture

```mermaid
flowchart TB
    subgraph "Trust Boundary: Public"
        USER[User Input]
    end
    
    subgraph "Trust Boundary: DMZ"
        WAF[Web Application Firewall]
        SANITIZE[Input Sanitizer]
        RATE[Rate Limiter]
    end
    
    subgraph "Trust Boundary: Internal"
        AGENT[Agent Runtime]
        AUDIT[Audit Logger]
        ENCRYPT[Encryption Service]
    end
    
    subgraph "Trust Boundary: Secure"
        DB[(Encrypted Database)]
        KEYS[Key Management]
        SIGN[Transaction Signer]
    end
    
    USER --> WAF
    WAF --> SANITIZE
    SANITIZE --> RATE
    RATE --> AGENT
    AGENT --> AUDIT
    AGENT --> ENCRYPT
    ENCRYPT --> DB
    AGENT --> SIGN
    SIGN --> KEYS
```

---

## Scope Definition

### In Scope

| Feature | Priority | Sprint |
|---------|----------|--------|
| Vince core agent with questionnaire flow | P0 | 1-2 |
| Kincho core agent with allocation logic | P0 | 1-2 |
| PostgreSQL schema + migrations | P0 | 1 |
| Web chat interface (React) | P0 | 2-3 |
| Telegram integration | P1 | 3-4 |
| Discord integration | P1 | 4 |
| Psychopolitical analyzer subagent | P0 | 2 |
| Wallet analyzer subagent | P1 | 3 |
| Transaction generator | P0 | 3 |
| Financial analyzer (Kincho) | P0 | 2 |
| Smart contract interface | P0 | 3 |
| Meta-cognition engine | P2 | 4-5 |
| Analytics dashboard | P1 | 5 |
| A/B testing framework for arguments | P2 | 5-6 |

### Out of Scope (v1.0)

| Feature | Reason | Future Version |
|---------|--------|----------------|
| Mobile native apps | Resource constraints | v1.5 |
| Multi-language support | Complexity | v1.2 |
| Fiat on-ramp integration | Regulatory complexity | v2.0 |
| Automated rebalancing | Risk management maturity | v1.5 |
| Third-party fund integration | Scope creep | v2.0 |

### Alternative Approaches Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Single monolithic agent | Simpler deployment | Less specialization, harder to maintain | Rejected |
| Microservices per function | Maximum flexibility | Operational complexity | Rejected |
| Two-agent with subagents | Balanced complexity, clear ownership | Moderate complexity | **Selected** |
| No Kincho (human fund manager) | Simpler, human judgment | Scalability, consistency | Rejected |

---

## Edge Cases & Risk Mitigation

### Edge Case Handling

```mermaid
stateDiagram-v2
    [*] --> Conversation
    
    Conversation --> QuestionnaireInProgress: start_questionnaire
    QuestionnaireInProgress --> QuestionnaireComplete: all_answered
    QuestionnaireInProgress --> QuestionnaireAbandoned: timeout(24h)
    QuestionnaireAbandoned --> Conversation: user_returns
    
    QuestionnaireComplete --> DepositIntent: user_indicates_deposit
    QuestionnaireComplete --> Conversation: user_declines
    
    DepositIntent --> DepositPending: tx_generated
    DepositPending --> DepositConfirmed: tx_confirmed
    DepositPending --> DepositFailed: tx_failed
    DepositFailed --> DepositIntent: user_retries
    
    DepositConfirmed --> AllocationRequested: vince_requests
    AllocationRequested --> AllocationApproved: kincho_approves
    AllocationRequested --> AllocationNegotiation: kincho_counters
    AllocationRequested --> AllocationDenied: kincho_denies
    
    AllocationNegotiation --> AllocationApproved: agreement_reached
    AllocationNegotiation --> AllocationDenied: no_agreement
    AllocationNegotiation --> HumanEscalation: deadlock
    
    AllocationApproved --> Complete: allocation_executed
    AllocationDenied --> UserNotification: notify_user
    HumanEscalation --> ManualReview: admin_notified
    
    Complete --> [*]
    UserNotification --> [*]
    ManualReview --> [*]
```

### Critical Edge Cases

| Edge Case | Detection | Handling |
|-----------|-----------|----------|
| User abandons mid-questionnaire | Session timeout | Store partial progress, resume on return |
| Deposit TX fails | TX monitoring | Notify user, offer retry with gas adjustment |
| Kincho-Vince deadlock | Negotiation round limit | Escalate to human administrator |
| Conflicting user preferences | Preference analysis | Surface conflict to user, request clarification |
| Wallet analysis fails (privacy wallet) | API error/empty response | Proceed without wallet data, note limitation |
| User requests allocation Kincho can't fulfill | Risk/compliance check | Counter-propose closest viable alternative |
| Suspected manipulation attempt | Meta-cognition engine | Log, alert, potentially pause interaction |

---

## Development Parallelization Plan

### Dependency Graph

```mermaid
flowchart TB
    subgraph "Sprint 1"
        DB[Database Schema]
        ELIZA[ElizaOS Setup]
        AUTH[Auth Service]
    end
    
    subgraph "Sprint 2"
        VCORE[Vince Core Agent]
        KCORE[Kincho Core Agent]
        PSY[Psycho Analyzer]
    end
    
    subgraph "Sprint 3"
        WEB[Web Interface]
        WALLET[Wallet Analyzer]
        TX[TX Generator]
        FIN[Financial Analyzer]
    end
    
    subgraph "Sprint 4"
        TG[Telegram Bot]
        DC[Discord Bot]
        CONTRACT[Contract Interface]
    end
    
    subgraph "Sprint 5"
        META[Meta-Cognition]
        ANALYTICS[Analytics Dashboard]
    end
    
    DB --> VCORE
    DB --> KCORE
    ELIZA --> VCORE
    ELIZA --> KCORE
    AUTH --> WEB
    AUTH --> TG
    AUTH --> DC
    
    VCORE --> PSY
    VCORE --> WALLET
    VCORE --> TX
    KCORE --> FIN
    KCORE --> CONTRACT
    KCORE --> META
    
    PSY --> WEB
    WALLET --> WEB
    TX --> WEB
    FIN --> CONTRACT
    
    WEB --> TG
    WEB --> DC
    CONTRACT --> META
    META --> ANALYTICS
```

### Parallel Workstreams

| Stream | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 |
|--------|----------|----------|----------|----------|----------|
| **Backend Core** | DB + Auth | Agent Runtime | Subagents | Integration | Meta-cognition |
| **Frontend** | Wireframes | - | Web UI | TG + DC | Analytics |
| **Blockchain** | Contract Review | - | TX Gen | Contract Interface | - |
| **Data/ML** | Schema Design | Psycho Model | Wallet Analysis | - | A/B Framework |
| **DevOps** | Infra Setup | CI/CD | Staging Deploy | Multi-platform | Production |

---

## Appendices

### A. Psychopolitical Questionnaire Framework

```yaml
questionnaire:
  sections:
    - id: values
      questions:
        - id: v1
          text: "When you think about making the world better, what comes to mind first?"
          type: open_ended
          analysis_tags: [cause_affinity, motivation_type]
        - id: v2
          text: "Rate how important each value is to you (1-10)"
          type: scale_matrix
          options: [fairness, loyalty, individual_freedom, tradition, care_for_vulnerable]
          analysis_tags: [moral_foundations]
          
    - id: giving_style
      questions:
        - id: g1
          text: "When you've given to causes before, what mattered most?"
          type: multiple_choice
          options:
            - "Seeing direct impact on individuals"
            - "Supporting systemic change"
            - "Tax efficiency"
            - "Aligning with my community"
          analysis_tags: [donation_motivation, archetype_signal]
          
    - id: risk_and_control
      questions:
        - id: r1
          text: "How do you feel about fund managers making allocation decisions?"
          type: scale
          range: [1, 10]
          anchors: ["I want full control", "I trust experts to decide"]
          analysis_tags: [control_preference, trust_profile]
```

### B. Archetype Definitions

| Archetype | Description | Likely Causes | Engagement Style |
|-----------|-------------|---------------|------------------|
| Impact Maximizer | Data-driven, seeks measurable outcomes | Effective altruism, global health | Evidence, metrics, ROI |
| Community Builder | Values local, relational impact | Local nonprofits, mutual aid | Stories, community connection |
| System Changer | Focused on root causes | Policy advocacy, structural reform | Theory of change, leverage |
| Values Expresser | Giving as identity expression | Aligned with personal beliefs | Values resonance, identity |
| Legacy Creator | Long-term, generational thinking | Endowments, education | Permanence, naming, family |
| Opportunistic Giver | Responds to immediate needs | Disaster relief, urgent appeals | Urgency, recency, asks |

### C. Kincho Decision Framework

```yaml
allocation_evaluation:
  hard_constraints:
    - max_single_allocation_pct: 20
    - min_diversification_count: 5
    - prohibited_categories: [gambling, weapons, tobacco]
    - regulatory_compliance: required
    
  soft_preferences:
    - target_yield_range: [3, 8]
    - liquidity_minimum_pct: 15
    - impact_score_minimum: 0.6
    
  donor_preference_weight: 0.4
  fund_strategy_weight: 0.4
  risk_adjustment_weight: 0.2
  
  escalation_triggers:
    - allocation_exceeds_hard_constraint
    - donor_preference_conflicts_with_compliance
    - confidence_below_threshold: 0.7
    - meta_cognition_flag: true
```

### D. ElizaOS Plugin Configuration

```typescript
// vince-agent-config.ts
import { Character, Plugin } from '@elizaos/core';
import { PostgresAdapter } from '@elizaos/adapter-postgres';
import { WalletPlugin } from '@elizaos/plugin-wallet';
import { TelegramPlugin } from '@elizaos/plugin-telegram';
import { DiscordPlugin } from '@elizaos/plugin-discord';

export const vinceConfig: Character = {
  name: 'Vince',
  plugins: [
    new PostgresAdapter({
      connectionString: process.env.DATABASE_URL,
    }),
    new WalletPlugin({
      chains: ['ethereum', 'polygon', 'arbitrum'],
      rpcUrls: {
        ethereum: process.env.ETH_RPC_URL,
        polygon: process.env.POLYGON_RPC_URL,
        arbitrum: process.env.ARB_RPC_URL,
      },
    }),
    new TelegramPlugin({
      botToken: process.env.TELEGRAM_BOT_TOKEN,
    }),
    new DiscordPlugin({
      botToken: process.env.DISCORD_BOT_TOKEN,
      guildIds: process.env.DISCORD_GUILD_IDS?.split(','),
    }),
  ],
  // ... rest of character config
};
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Jan 2026 | System Architect | Initial specification |

---