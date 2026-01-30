/**
 * POST /api/v1/questionnaire/submit
 * Submits questionnaire responses and triggers analysis if complete
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  saveQuestionnaireResponse,
  getQuestionnaireResponses,
  getUserProfile,
  saveArchetypeScores,
  saveCauseAffinities,
} from '../../../../../lib/db';
import { analyzeResponses, isQuestionnaireComplete, allQuestions } from '@bangui/agent';
import type { QuestionnaireSubmitRequest, UUID } from '@bangui/types';

export async function POST(request: NextRequest) {
  const db = getSupabase();
  const body: QuestionnaireSubmitRequest = await request.json();
  const { userId, responses } = body;

  // Save each response
  for (const response of responses) {
    await saveQuestionnaireResponse(db, {
      userId: userId as string,
      questionId: response.questionId,
      response: response.response,
      responseTimeMs: response.responseTimeMs,
    });
  }

  // Check if questionnaire is complete
  const allResponses = await getQuestionnaireResponses(db, userId as string);
  const answeredIds = new Set(allResponses.map((r) => r.question_id));
  const complete = isQuestionnaireComplete(answeredIds);

  if (complete) {
    // Run analysis
    const analysis = analyzeResponses(
      userId,
      allResponses.map((r) => ({
        questionId: r.question_id,
        response: r.response,
      }))
    );

    // Save results
    const profile = await getUserProfile(db, userId as string);
    if (profile) {
      await saveArchetypeScores(db, {
        profileId: profile.id,
        scores: [
          {
            archetype: analysis.archetypeProfile.primaryArchetype,
            score: analysis.archetypeProfile.confidence,
            confidence: analysis.archetypeProfile.confidence,
          },
          ...analysis.archetypeProfile.secondaryTraits.map((a, i) => ({
            archetype: a,
            score: 0.5 - i * 0.1,
            confidence: 0.7,
          })),
        ],
      });

      await saveCauseAffinities(db, {
        profileId: profile.id,
        affinities: analysis.causeAffinities.slice(0, 5).map((a) => ({
          causeCategory: a.causeId,
          affinityScore: a.affinityScore,
          reasoning: { text: a.reasoning },
        })),
      });
    }

    return NextResponse.json({
      complete: true,
      analysis: {
        archetype: analysis.archetypeProfile.primaryArchetype,
        causeAffinities: analysis.causeAffinities.slice(0, 3),
      },
    });
  }

  return NextResponse.json({
    complete: false,
    progress: answeredIds.size,
    total: allQuestions.length,
  });
}
