/**
 * @module @bangui/api/routes/questionnaire
 * Questionnaire submission and analysis routes
 * @see {@link @bangui/types#QuestionnaireSubmitRequest}
 */

import { Hono } from 'hono';
import type { Db } from '@bangui/db';
import {
  saveQuestionnaireResponse,
  getQuestionnaireResponses,
  getUserProfile,
  saveArchetypeScores,
  saveCauseAffinities,
  updateConversationState,
  getConversation,
} from '@bangui/db';
import { analyzeResponses, isQuestionnaireComplete, allQuestions, logUser, logAgent, logAnalysis, logDB, logTimed } from '@bangui/agent';
import type {
  QuestionnaireSubmitRequest,
  UUID,
  Archetype,
  ConversationState,
} from '@bangui/types';

/** Route context with database */
export interface QuestionnaireContext {
  Variables: { db: Db };
}

/**
 * Creates questionnaire routes
 * @returns Hono router with questionnaire endpoints
 */
export const createQuestionnaireRoutes = () => {
  const router = new Hono<QuestionnaireContext>();

  /**
   * POST /api/v1/questionnaire/submit
   * Submits questionnaire responses and triggers analysis if complete
   */
  router.post('/submit', async (c) => {
    const done = logTimed('AGENT', '/questionnaire/submit');

    const db = c.get('db');
    const body = await c.req.json<QuestionnaireSubmitRequest>();
    const { userId, responses } = body;

    logUser.info('Questionnaire submit request', {
      userId,
      responseCount: responses.length,
      questionIds: responses.map(r => r.questionId),
    });

    // Save each response
    for (const response of responses) {
      logDB.debug('Saving questionnaire response', {
        userId,
        questionId: response.questionId,
      });
      await saveQuestionnaireResponse(db, {
        userId,
        questionId: response.questionId,
        response: response.response,
        responseTimeMs: response.responseTimeMs,
      });
    }

    // Check if questionnaire is complete
    const allResponses = await getQuestionnaireResponses(db, userId);
    const answeredIds = new Set(allResponses.map((r) => r.questionId));
    const complete = isQuestionnaireComplete(answeredIds);

    logAgent.debug('Questionnaire completion check', {
      userId,
      answeredCount: answeredIds.size,
      totalQuestions: allQuestions.length,
      isComplete: complete,
    });

    if (complete) {
      logAnalysis.info('Questionnaire complete, running analysis', { userId });

      // Run analysis
      const analysis = analyzeResponses(
        userId,
        allResponses.map((r) => ({
          questionId: r.questionId,
          response: r.response,
        }))
      );

      logAnalysis.info('Analysis complete', {
        userId,
        archetype: analysis.archetypeProfile.primaryArchetype,
        confidence: analysis.archetypeProfile.confidence,
      });

      // Save results
      const profile = await getUserProfile(db, userId);
      if (profile) {
        logDB.debug('Saving archetype scores', {
          profileId: profile.id,
          primaryArchetype: analysis.archetypeProfile.primaryArchetype,
        });

        await saveArchetypeScores(db, {
          profileId: profile.id as UUID,
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

        logDB.debug('Saving cause affinities', {
          profileId: profile.id,
          causeCount: Math.min(5, analysis.causeAffinities.length),
        });

        await saveCauseAffinities(db, {
          profileId: profile.id as UUID,
          affinities: analysis.causeAffinities.slice(0, 5).map((a) => ({
            causeCategory: a.causeId,
            affinityScore: a.affinityScore,
            reasoning: { text: a.reasoning },
          })),
        });
      }

      logUser.info('Questionnaire submission complete', {
        userId,
        complete: true,
        archetype: analysis.archetypeProfile.primaryArchetype,
      });

      done();
      return c.json({
        complete: true,
        analysis: {
          archetype: analysis.archetypeProfile.primaryArchetype,
          causeAffinities: analysis.causeAffinities.slice(0, 3),
        },
      });
    }

    logUser.info('Questionnaire submission complete (in progress)', {
      userId,
      complete: false,
      progress: answeredIds.size,
      total: allQuestions.length,
    });

    done();
    return c.json({
      complete: false,
      progress: answeredIds.size,
      total: allQuestions.length,
    });
  });

  /**
   * GET /api/v1/questionnaire/analysis/:userId
   * Gets psychopolitical analysis for a user
   */
  router.get('/analysis/:userId', async (c) => {
    const db = c.get('db');
    const userId = c.req.param('userId') as UUID;

    logUser.debug('Fetching analysis for user', { userId });

    const profile = await getUserProfile(db, userId);
    if (!profile) {
      logUser.warn('Profile not found for analysis request', { userId });
      return c.json({ error: 'Profile not found' }, 404);
    }

    const primaryScore = profile.archetypeScores.reduce(
      (max, s) => (Number(s.score) > Number(max.score) ? s : max),
      profile.archetypeScores[0]!
    );

    logUser.debug('Analysis retrieved', {
      userId,
      archetype: primaryScore.archetype,
      confidence: primaryScore.confidence,
    });

    return c.json({
      archetype: primaryScore.archetype,
      confidence: Number(primaryScore.confidence),
      causeAffinities: profile.causeAffinities.map((a) => ({
        category: a.causeCategory,
        score: Number(a.affinityScore),
      })),
    });
  });

  return router;
};
