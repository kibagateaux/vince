/**
 * @module @bangui/agent/questionnaire
 * Psychopolitical questionnaire definition
 * @see {@link @bangui/types#Question}
 */

import type { Questionnaire, Question, QuestionType } from '@bangui/types';

/**
 * Creates a question with proper typing
 * @param id - Unique question identifier
 * @param sectionId - Parent section ID
 * @param text - Question text shown to user
 * @param type - Question type
 * @param analysisTags - Tags for analysis
 * @param options - Optional answer options
 */
const q = (
  id: string,
  sectionId: string,
  text: string,
  type: QuestionType,
  analysisTags: readonly string[],
  options?: {
    readonly choices?: readonly string[];
    readonly range?: readonly [number, number];
    readonly anchors?: readonly [string, string];
  }
): Question => ({
  id,
  sectionId,
  text,
  type,
  analysisTags,
  ...(options?.choices && { options: options.choices }),
  ...(options?.range && { range: options.range }),
  ...(options?.anchors && { anchors: options.anchors }),
});

/**
 * Main questionnaire definition
 * Covers values, giving style, and risk/control preferences
 */
export const questionnaire: Questionnaire = {
  id: 'psychopolitical_v1',
  version: '1.0.0',
  sections: [
    {
      id: 'values',
      title: 'Your Values',
      questions: [
        q(
          'v1',
          'values',
          'When you think about making the world better, what comes to mind first?',
          'open_ended',
          ['cause_affinity', 'motivation_type']
        ),
        q(
          'v2',
          'values',
          'Which of these values resonates most strongly with you?',
          'multiple_choice',
          ['moral_foundations', 'archetype_signal'],
          {
            choices: [
              'Fairness and equal opportunity for all',
              'Loyalty to community and tradition',
              'Individual freedom and autonomy',
              'Care for the most vulnerable',
              'Building lasting institutions',
            ],
          }
        ),
      ],
    },
    {
      id: 'giving_style',
      title: 'Your Giving Style',
      questions: [
        q(
          'g1',
          'giving_style',
          "When you've given to causes before, what mattered most to you?",
          'multiple_choice',
          ['donation_motivation', 'archetype_signal'],
          {
            choices: [
              'Seeing direct impact on specific individuals',
              'Supporting systemic or policy change',
              'Tax efficiency and financial planning',
              'Aligning with my community or network',
              'Creating a lasting legacy',
            ],
          }
        ),
        q(
          'g2',
          'giving_style',
          'How do you prefer to learn about the impact of your giving?',
          'multiple_choice',
          ['engagement_style', 'archetype_signal'],
          {
            choices: [
              'Detailed metrics and data',
              'Personal stories from beneficiaries',
              'Reports on systemic progress',
              'Updates from community members',
              'Annual summaries and milestones',
            ],
          }
        ),
      ],
    },
    {
      id: 'risk_control',
      title: 'Risk & Control',
      questions: [
        q(
          'r1',
          'risk_control',
          'How do you feel about fund managers making allocation decisions on your behalf?',
          'scale',
          ['control_preference', 'trust_profile'],
          {
            range: [1, 10],
            anchors: ['I want full control over every decision', 'I trust experts to decide'],
          }
        ),
        q(
          'r2',
          'risk_control',
          'When it comes to charitable investments, which approach appeals to you more?',
          'multiple_choice',
          ['risk_tolerance', 'archetype_signal'],
          {
            choices: [
              'Proven, lower-risk initiatives with steady impact',
              'Balanced mix of established and emerging opportunities',
              'Higher-risk, higher-potential-impact ventures',
            ],
          }
        ),
      ],
    },
  ],
};

/** All questions flattened for easy lookup */
export const allQuestions: readonly Question[] = questionnaire.sections.flatMap(
  (s) => s.questions
);

/** Question lookup by ID */
export const questionById: ReadonlyMap<string, Question> = new Map(
  allQuestions.map((q) => [q.id, q])
);

/** Total number of questions */
export const totalQuestions = allQuestions.length;

/**
 * Gets the next unanswered question
 * @param answeredIds - Set of already answered question IDs
 * @returns Next question or null if all answered
 */
export const getNextQuestion = (
  answeredIds: ReadonlySet<string>
): Question | null => allQuestions.find((q) => !answeredIds.has(q.id)) ?? null;

/**
 * Checks if questionnaire is complete
 * @param answeredIds - Set of answered question IDs
 */
export const isQuestionnaireComplete = (answeredIds: ReadonlySet<string>): boolean =>
  allQuestions.every((q) => answeredIds.has(q.id));
