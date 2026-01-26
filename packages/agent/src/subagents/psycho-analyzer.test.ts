/**
 * @module @bangui/agent/subagents/psycho-analyzer.test
 * Test specifications for Psychopolitical Analyzer
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMoralVector,
  inferArchetype,
  inferCauseAffinities,
  analyzeResponses,
} from './psycho-analyzer.js';
import type { Archetype, MoralVector } from '@bangui/types';

describe('PsychopoliticalAnalyzer', () => {
  describe('calculateMoralVector', () => {
    it('should return normalized values between 0 and 1', () => {
      const responses = [
        { questionId: 'v2', response: 'Care for the most vulnerable' },
        { questionId: 'g1', response: 'Seeing direct impact on specific individuals' },
      ];
      const vector = calculateMoralVector(responses);

      expect(vector.care).toBeGreaterThanOrEqual(0);
      expect(vector.care).toBeLessThanOrEqual(1);
      expect(vector.fairness).toBeGreaterThanOrEqual(0);
      expect(vector.loyalty).toBeGreaterThanOrEqual(0);
    });

    it('should weight care highly for care-focused responses', () => {
      const responses = [
        { questionId: 'v2', response: 'Care for the most vulnerable' },
        { questionId: 'g1', response: 'Seeing direct impact on specific individuals' },
      ];
      const vector = calculateMoralVector(responses);

      expect(vector.care).toBeGreaterThan(0.5);
    });

    it('should weight fairness highly for fairness-focused responses', () => {
      const responses = [
        { questionId: 'v2', response: 'Fairness and equal opportunity for all' },
        { questionId: 'g1', response: 'Supporting systemic or policy change' },
      ];
      const vector = calculateMoralVector(responses);

      expect(vector.fairness).toBeGreaterThan(0.5);
    });
  });

  describe('inferArchetype', () => {
    it('should return impact_maximizer for data-driven responses', () => {
      const responses = [
        { questionId: 'g2', response: 'Detailed metrics and data' },
        { questionId: 'g1', response: 'Tax efficiency and financial planning' },
      ];
      const moralVector: MoralVector = {
        care: 0.6,
        fairness: 0.8,
        loyalty: 0.3,
        authority: 0.2,
        sanctity: 0.2,
        liberty: 0.7,
      };

      const result = inferArchetype(responses, moralVector);
      expect(result.primaryArchetype).toBe('impact_maximizer');
    });

    it('should return community_builder for community-focused responses', () => {
      const responses = [
        { questionId: 'g2', response: 'Updates from community members' },
        { questionId: 'g1', response: 'Aligning with my community or network' },
        { questionId: 'v2', response: 'Loyalty to community and tradition' },
      ];
      const moralVector: MoralVector = {
        care: 0.5,
        fairness: 0.4,
        loyalty: 0.9,
        authority: 0.5,
        sanctity: 0.4,
        liberty: 0.3,
      };

      const result = inferArchetype(responses, moralVector);
      expect(result.primaryArchetype).toBe('community_builder');
    });

    it('should return system_changer for policy-focused responses', () => {
      const responses = [
        { questionId: 'g1', response: 'Supporting systemic or policy change' },
        { questionId: 'g2', response: 'Reports on systemic progress' },
      ];
      const moralVector: MoralVector = {
        care: 0.5,
        fairness: 0.9,
        loyalty: 0.2,
        authority: 0.3,
        sanctity: 0.2,
        liberty: 0.8,
      };

      const result = inferArchetype(responses, moralVector);
      expect(result.primaryArchetype).toBe('system_changer');
    });

    it('should include confidence score', () => {
      const responses = [{ questionId: 'g1', response: 'Creating a lasting legacy' }];
      const moralVector: MoralVector = {
        care: 0.4,
        fairness: 0.4,
        loyalty: 0.6,
        authority: 0.7,
        sanctity: 0.5,
        liberty: 0.3,
      };

      const result = inferArchetype(responses, moralVector);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('inferCauseAffinities', () => {
    it('should return affinities sorted by score descending', () => {
      const responses = [
        { questionId: 'v1', response: 'I care about climate change and the environment' },
        { questionId: 'v2', response: 'Care for the most vulnerable' },
      ];

      const affinities = inferCauseAffinities(responses);
      for (let i = 1; i < affinities.length; i++) {
        expect(affinities[i - 1]!.affinityScore).toBeGreaterThanOrEqual(
          affinities[i]!.affinityScore
        );
      }
    });

    it('should include reasoning for each affinity', () => {
      const responses = [
        { questionId: 'v1', response: 'Education is fundamental to progress' },
      ];

      const affinities = inferCauseAffinities(responses);
      expect(affinities.length).toBeGreaterThan(0);
      affinities.forEach((a) => {
        expect(a.reasoning).toBeDefined();
        expect(a.reasoning.length).toBeGreaterThan(0);
      });
    });
  });

  describe('analyzeResponses', () => {
    it('should return complete PsychopoliticalAnalysis', () => {
      const userId = 'test-user-id' as any;
      const responses = [
        { questionId: 'v1', response: 'I want to help people in need' },
        { questionId: 'v2', response: 'Care for the most vulnerable' },
        { questionId: 'g1', response: 'Seeing direct impact on specific individuals' },
        { questionId: 'g2', response: 'Personal stories from beneficiaries' },
        { questionId: 'r1', response: 5 },
        { questionId: 'r2', response: 'Balanced mix of established and emerging opportunities' },
      ];

      const analysis = analyzeResponses(userId, responses);

      expect(analysis.userId).toBe(userId);
      expect(analysis.archetypeProfile).toBeDefined();
      expect(analysis.moralVector).toBeDefined();
      expect(analysis.causeAffinities).toBeDefined();
      expect(analysis.analyzedAt).toBeDefined();
    });
  });
});
