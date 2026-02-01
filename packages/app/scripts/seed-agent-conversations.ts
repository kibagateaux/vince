/**
 * Seed script to create test agent conversations for development
 * Run with: npx tsx scripts/seed-agent-conversations.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env from root
config({ path: '../../.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('Supabase URL:', SUPABASE_URL ? 'found' : 'missing');
console.log('Supabase Key:', SUPABASE_KEY ? 'found' : 'missing');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedAgentConversations() {
  console.log('Seeding agent conversations...');

  // First, get an existing allocation request or create a test user
  const { data: existingConv } = await supabase
    .from('agent_conversations')
    .select('id, allocation_request_id')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!existingConv) {
    console.log('No existing agent conversation found. Please create an allocation request first.');
    return;
  }

  console.log(`Found conversation: ${existingConv.id}`);

  // Check if Kincho has already responded
  const { data: existingMessages } = await supabase
    .from('agent_messages')
    .select('*')
    .eq('agent_conversation_id', existingConv.id)
    .eq('sender', 'kincho');

  if (existingMessages && existingMessages.length > 0) {
    console.log('Kincho has already responded to this conversation.');
    return;
  }

  // Insert a Kincho response
  const kinchoResponse = {
    type: 'ALLOCATION_RESPONSE',
    requestId: existingConv.allocation_request_id,
    decision: 'modified',
    allocations: [
      {
        causeId: 'cause-climate-001',
        causeName: 'Climate Action Fund',
        amount: 4000000,
        allocationType: 'grant',
        reasoning: 'User has shown preference for environmental causes'
      },
      {
        causeId: 'cause-education-001',
        causeName: 'Education Access Initiative',
        amount: 3000000,
        allocationType: 'grant',
        reasoning: 'Diversified impact allocation'
      },
      {
        causeId: 'yield-reserve-001',
        causeName: 'DAF Yield Reserve',
        amount: 3000000,
        allocationType: 'yield',
        reasoning: 'Maintain 30% liquidity reserve'
      }
    ],
    modifications: [
      {
        original: { causeId: 'cause-general-001', amount: 7000000 },
        modified: { causeId: 'cause-climate-001', amount: 4000000 },
        reason: 'Redirected to user-preferred climate causes'
      }
    ],
    userFriendlyExplanation: 'I\'ve adjusted your allocation to prioritize climate action (40%) and education (30%), based on your stated values, while maintaining a healthy yield reserve (30%).',
    detailedReasoning: 'Analysis of user profile indicates strong environmental values. Modified allocation to better align with archetype "Impact Maximizer". Risk tolerance "moderate" supports the 30% reserve strategy.',
    confidence: 0.87
  };

  const { data: newMessage, error } = await supabase
    .from('agent_messages')
    .insert({
      agent_conversation_id: existingConv.id,
      sender: 'kincho',
      content: JSON.stringify(kinchoResponse),
      metadata: { type: 'allocation_response' }
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting Kincho response:', error);
    return;
  }

  // Update the conversation last_message_at
  await supabase
    .from('agent_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', existingConv.id);

  // Update allocation request status to 'modified'
  await supabase
    .from('allocation_requests')
    .update({ status: 'modified' })
    .eq('id', existingConv.allocation_request_id);

  console.log('Successfully inserted Kincho response:', newMessage?.id);
  console.log('\nYou can now view the conversation at:');
  console.log(`http://localhost:3001/admin/agent-conversations/${existingConv.id}`);
}

seedAgentConversations().catch(console.error);
