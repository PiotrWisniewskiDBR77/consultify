/**
 * Tests for useToolStore - Strategic Tools Zustand Store
 *
 * Tests cover:
 * - Session creation and management
 * - Step navigation
 * - SWOT data manipulation
 * - Porter data manipulation
 * - Progress calculation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { useToolStore, ToolType, SWOTData, PorterData, SWOT_STEPS, PORTER_STEPS } from '@/store/useToolStore';

describe('useToolStore', () => {
  // Reset store before each test
  beforeEach(() => {
    const store = useToolStore.getState();
    store.currentSession = null;
    store.currentStep = 1;
    store.savedSessions = [];
  });

  afterEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  describe('Session Management', () => {
    it('should create a new SWOT session', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
      });

      const state = useToolStore.getState();
      expect(state.currentSession).not.toBeNull();
      expect(state.currentSession?.toolType).toBe('dynamic-swot');
      expect(state.currentSession?.status).toBe('draft');
      expect(state.currentSession?.steps.length).toBe(SWOT_STEPS.length);
      expect(state.currentStep).toBe(1);
    });

    it('should create a new Porter session', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('market-forces');
      });

      const state = useToolStore.getState();
      expect(state.currentSession).not.toBeNull();
      expect(state.currentSession?.toolType).toBe('market-forces');
      expect(state.currentSession?.steps.length).toBe(PORTER_STEPS.length);
    });

    it('should initialize SWOT data correctly', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
      });

      const state = useToolStore.getState();
      const swotData = state.currentSession?.inputData as SWOTData;
      
      expect(swotData.context.goal).toBe('');
      expect(swotData.context.scope).toBe('');
      expect(swotData.context.timeframe).toBe('medium');
      expect(swotData.items).toEqual([]);
      expect(swotData.correlations).toEqual([]);
    });

    it('should initialize Porter data correctly', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('market-forces');
      });

      const state = useToolStore.getState();
      const porterData = state.currentSession?.inputData as PorterData;
      
      expect(porterData.context.industry).toBe('');
      expect(porterData.context.geographicScope).toBe('');
      expect(porterData.context.position).toBe('challenger');
      expect(porterData.forces.rivalry.score).toBe(3);
      expect(porterData.forces.newEntrants.score).toBe(3);
    });

    it('should save session to savedSessions', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
        store.saveSession();
      });

      const state = useToolStore.getState();
      expect(state.savedSessions.length).toBe(1);
      expect(state.savedSessions[0].id).toBe(state.currentSession?.id);
    });

    it('should load existing session', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
        store.saveSession();
      });

      const sessionId = useToolStore.getState().currentSession?.id;
      
      act(() => {
        store.createSession('market-forces'); // Create different session
        store.loadSession(sessionId!); // Load the SWOT session
      });

      const state = useToolStore.getState();
      expect(state.currentSession?.toolType).toBe('dynamic-swot');
    });

    it('should delete session', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
        store.saveSession();
      });

      const sessionId = useToolStore.getState().currentSession?.id;
      
      act(() => {
        store.deleteSession(sessionId!);
      });

      const state = useToolStore.getState();
      expect(state.savedSessions.length).toBe(0);
      expect(state.currentSession).toBeNull();
    });
  });

  describe('Step Navigation', () => {
    beforeEach(() => {
      const store = useToolStore.getState();
      act(() => {
        store.createSession('dynamic-swot');
      });
    });

    it('should navigate to next step', () => {
      const store = useToolStore.getState();
      
      // Add required context data first
      act(() => {
        store.updateInputData({
          context: {
            goal: 'Test goal',
            scope: 'Test scope',
            timeframe: 'medium',
          },
        });
        store.nextStep();
      });

      const state = useToolStore.getState();
      expect(state.currentStep).toBe(2);
      expect(state.currentSession?.steps[0].status).toBe('completed');
    });

    it('should navigate to previous step', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.setCurrentStep(3);
        store.prevStep();
      });

      expect(useToolStore.getState().currentStep).toBe(2);
    });

    it('should not go below step 1', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.prevStep();
      });

      expect(useToolStore.getState().currentStep).toBe(1);
    });

    it('should not exceed total steps', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.setCurrentStep(SWOT_STEPS.length + 1);
      });

      // Should remain at current step (1) because step 8 is invalid
      expect(useToolStore.getState().currentStep).toBe(1);
    });

    it('should set specific step', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.setCurrentStep(4);
      });

      expect(useToolStore.getState().currentStep).toBe(4);
    });
  });

  describe('SWOT Data Operations', () => {
    beforeEach(() => {
      const store = useToolStore.getState();
      act(() => {
        store.createSession('dynamic-swot');
      });
    });

    it('should add SWOT item', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.addSWOTItem({
          text: 'Strong brand recognition',
          impact: 'high',
          quadrant: 'strengths',
          source: 'user',
        });
      });

      const state = useToolStore.getState();
      const swotData = state.currentSession?.inputData as SWOTData;
      
      expect(swotData.items.length).toBe(1);
      expect(swotData.items[0].text).toBe('Strong brand recognition');
      expect(swotData.items[0].quadrant).toBe('strengths');
      expect(swotData.items[0].impact).toBe('high');
      expect(swotData.items[0].id).toBeDefined();
    });

    it('should remove SWOT item', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.addSWOTItem({
          text: 'Test item',
          impact: 'medium',
          quadrant: 'weaknesses',
        });
      });

      const itemId = (useToolStore.getState().currentSession?.inputData as SWOTData).items[0].id;
      
      act(() => {
        store.removeSWOTItem(itemId);
      });

      const swotData = useToolStore.getState().currentSession?.inputData as SWOTData;
      expect(swotData.items.length).toBe(0);
    });

    it('should update SWOT item', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.addSWOTItem({
          text: 'Original text',
          impact: 'low',
          quadrant: 'opportunities',
        });
      });

      const itemId = (useToolStore.getState().currentSession?.inputData as SWOTData).items[0].id;
      
      act(() => {
        store.updateSWOTItem(itemId, {
          text: 'Updated text',
          impact: 'high',
        });
      });

      const swotData = useToolStore.getState().currentSession?.inputData as SWOTData;
      expect(swotData.items[0].text).toBe('Updated text');
      expect(swotData.items[0].impact).toBe('high');
      expect(swotData.items[0].quadrant).toBe('opportunities'); // Should remain unchanged
    });

    it('should add correlation', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.addCorrelation({
          items: ['item1', 'item2'],
          type: 'SO',
          insight: 'Strategic insight',
          initiativeProposal: 'Proposed initiative',
        });
      });

      const swotData = useToolStore.getState().currentSession?.inputData as SWOTData;
      expect(swotData.correlations.length).toBe(1);
      expect(swotData.correlations[0].type).toBe('SO');
      expect(swotData.correlations[0].id).toBeDefined();
    });

    it('should update input data (context)', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.updateInputData({
          context: {
            goal: 'Increase market share',
            scope: 'EMEA region',
            timeframe: 'long',
          },
        });
      });

      const swotData = useToolStore.getState().currentSession?.inputData as SWOTData;
      expect(swotData.context.goal).toBe('Increase market share');
      expect(swotData.context.scope).toBe('EMEA region');
      expect(swotData.context.timeframe).toBe('long');
    });
  });

  describe('Initiative Management', () => {
    beforeEach(() => {
      const store = useToolStore.getState();
      act(() => {
        store.createSession('dynamic-swot');
      });
    });

    it('should add initiative', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.addInitiative({
          title: 'Digital Transformation',
          description: 'Modernize IT infrastructure',
          type: 'strategic',
          source: 'dynamic-swot',
          linkedItems: ['item1', 'item2'],
          estimatedImpact: 'high',
          estimatedEffort: 'high',
          rationale: 'Addresses core weakness',
        });
      });

      const state = useToolStore.getState();
      expect(state.currentSession?.generatedInitiatives.length).toBe(1);
      expect(state.currentSession?.generatedInitiatives[0].title).toBe('Digital Transformation');
      expect(state.currentSession?.generatedInitiatives[0].id).toBeDefined();
    });
  });

  describe('Chat History', () => {
    beforeEach(() => {
      const store = useToolStore.getState();
      act(() => {
        store.createSession('dynamic-swot');
      });
    });

    it('should add chat message', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.addChatMessage({
          role: 'user',
          content: 'What are our main strengths?',
        });
      });

      const state = useToolStore.getState();
      expect(state.currentSession?.chatHistory.length).toBe(1);
      expect(state.currentSession?.chatHistory[0].role).toBe('user');
      expect(state.currentSession?.chatHistory[0].timestamp).toBeDefined();
      expect(state.currentSession?.chatHistory[0].stepId).toBeDefined();
    });

    it('should track message step context', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.setCurrentStep(3); // weaknesses step
        store.addChatMessage({
          role: 'assistant',
          content: 'Here are some weaknesses to consider...',
        });
      });

      const state = useToolStore.getState();
      expect(state.currentSession?.chatHistory[0].stepId).toBe('weaknesses');
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress for SWOT', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
      });

      // Initially 0%
      expect(store.calculateProgress()).toBe(0);

      // Complete first step
      act(() => {
        store.updateInputData({
          context: { goal: 'Test', scope: 'Test', timeframe: 'medium' },
        });
        store.nextStep();
      });

      // Should be ~14% (1/7 steps)
      expect(store.calculateProgress()).toBe(14);
    });

    it('should return correct step definitions', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
      });

      const steps = store.getStepDefinitions();
      expect(steps.length).toBe(7);
      expect(steps[0].id).toBe('context');
      expect(steps[6].id).toBe('summary');
    });
  });

  describe('Step Advancement Validation', () => {
    it('should allow advancing from context step when data filled', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
        store.updateInputData({
          context: {
            goal: 'Test goal',
            scope: 'Test scope',
            timeframe: 'medium',
          },
        });
      });

      expect(store.canAdvanceStep()).toBe(true);
    });

    it('should prevent advancing from context step when data empty', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
      });

      expect(store.canAdvanceStep()).toBe(false);
    });

    it('should allow advancing from quadrant step when items exist', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
        store.setCurrentStep(2); // strengths step
        store.addSWOTItem({
          text: 'Test strength',
          impact: 'high',
          quadrant: 'strengths',
        });
      });

      expect(store.canAdvanceStep()).toBe(true);
    });

    it('should prevent advancing from quadrant step when no items', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.createSession('dynamic-swot');
        store.setCurrentStep(2); // strengths step
      });

      expect(store.canAdvanceStep()).toBe(false);
    });
  });

  describe('Porter-specific Operations', () => {
    beforeEach(() => {
      const store = useToolStore.getState();
      act(() => {
        store.createSession('market-forces');
      });
    });

    it('should not allow SWOT operations on Porter session', () => {
      const store = useToolStore.getState();
      
      act(() => {
        store.addSWOTItem({
          text: 'This should not work',
          impact: 'high',
          quadrant: 'strengths',
        });
      });

      // Porter sessions don't have items array
      const porterData = useToolStore.getState().currentSession?.inputData as PorterData;
      expect((porterData as any).items).toBeUndefined();
    });

    it('should initialize forces correctly', () => {
      const porterData = useToolStore.getState().currentSession?.inputData as PorterData;
      
      expect(Object.keys(porterData.forces)).toHaveLength(5);
      expect(porterData.forces.rivalry).toBeDefined();
      expect(porterData.forces.newEntrants).toBeDefined();
      expect(porterData.forces.substitutes).toBeDefined();
      expect(porterData.forces.buyerPower).toBeDefined();
      expect(porterData.forces.supplierPower).toBeDefined();
    });
  });
});
