
import React, { useState, useEffect } from 'react';
import { ChatPanel } from '../components/ChatPanel';
import { Step1Workspace } from '../components/Step1Workspace';
import { Step2Workspace } from '../components/Step2Workspace';
import { Step3Workspace } from '../components/Step3Workspace';
import {
  AppView,
  AssessmentStep,
  ChatMessage,
  ChatOption,
  CompanyProfile,
  StrategicGoal,
  Challenge,
  Constraint
} from '../types';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { SYSTEM_PROMPTS, AIMessageHistory } from '../services/ai/gemini';
import { useAIStream } from '../hooks/useAIStream';

import { useScreenContext } from '../hooks/useScreenContext';
import { useAIContext } from '../contexts/AIContext';

const StepIndicator = ({ activeIdx }: { activeIdx: number }) => {
  return (
    <div className="flex items-center justify-center py-3 border-b border-white/5 bg-navy-950">
      {[1, 2, 3].map((step) => {
        const isCompleted = step < activeIdx;
        const isActive = step === activeIdx;
        return (
          <div key={step} className="flex items-center">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full border transition-all ${isActive ? 'bg-purple-600 border-purple-500 text-white' : isCompleted ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-navy-900 border-white/10 text-slate-500'}`}>
              {isCompleted ? <Check size={12} /> : <span className="text-[10px] font-bold">{step}</span>}
            </div>
            <span className={`ml-2 text-[10px] font-medium hidden lg:block ${isActive ? 'text-white' : 'text-slate-500'}`}>
              {step === 1 ? 'Profile & IT' : step === 2 ? 'Goals' : 'Challenges'}
            </span>
            {step < 3 && <div className={`w-8 h-px mx-2 ${isCompleted ? 'bg-green-500/30' : 'bg-white/10'}`}></div>}
          </div>
        );
      })}
    </div>
  );
};

export const FreeAssessmentView: React.FC = () => {
  const {
    currentUser,
    freeSessionData: sessionData,
    setFreeSessionData: setSessionData,
    currentView: currentAppView,
    setCurrentView: onNavigate,
    activeChatMessages: messages,
    addChatMessage,
    isBotTyping: isTyping,
    setIsBotTyping: setIsTyping
  } = useAppStore();

  const { isStreaming, streamedContent, startStream } = useAIStream();

  const [currentStep, setCurrentStep] = useState<AssessmentStep>(AssessmentStep.INTRO);
  const { t: translate } = useTranslation();
  const chat = translate('chat', { returnObjects: true }) as any;
  const t = chat?.scripts || {};
  const opts = chat?.options || {};

  const [profileData, setProfileData] = useState<Partial<CompanyProfile>>({
    name: currentUser?.companyName || 'My Company',
    role: '',
    industry: '',
    size: '',
    country: '',
    businessModel: { type: [], description: '' },
    coreProcesses: [],
    itLandscape: { erp: '', crm: '', mes: '', integrationLevel: 'Low' }
  });

  // --- CONTEXT INJECTION ---
  useScreenContext(
    'quick_assessment',
    'Quick Assessment (Profiling)',
    {
      currentStep,
      profile: profileData,
      goals: sessionData.strategicGoals,
      challenges: sessionData.challengesMap,
      constraints: sessionData.constraints
    },
    'User is going through the Quick Assessment wizard. Guide them to complete their profile, goals, and challenges.'
  );

  // --- EFFECT: Handle View Switching ---
  // Using a ref to prevent double-initialization
  const initializedRef = React.useRef(false);

  useEffect(() => {
    if (!initializedRef.current && messages.length === 0 && currentAppView === AppView.QUICK_STEP1_PROFILE && currentUser) {
      initializedRef.current = true;
      const greeting = t.intro.replace('{name}', currentUser.firstName);
      const initialMsg: ChatMessage = {
        id: '1',
        role: 'ai',
        content: greeting,
        timestamp: new Date(),
        options: [
          { id: 'start', label: opts.start, value: 'start' },
          { id: 'explain', label: opts.explain, value: 'explain' }
        ]
      };
      addChatMessage(initialMsg);
    }
  }, [currentUser, currentAppView, messages.length, t.intro, opts.start, opts.explain, addChatMessage]);

  const addAiMessage = (content: string, options?: ChatOption[], multiSelect?: boolean, delay = 600) => {
    setIsTyping(true);
    setTimeout(() => {
      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'ai',
        content,
        timestamp: new Date(),
        options,
        multiSelect
      };
      addChatMessage(newMsg);
      setIsTyping(false);
    }, delay);
  };

  const addUserMessage = (content: string) => {
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    addChatMessage(newMsg);
  };

  // --- AI HANDLER (Generic) ---
  const { screenContext } = useAIContext();

  const handleAiConversation = async (userText: string, contextOverride?: string) => {
    setIsTyping(true);
    const history: AIMessageHistory[] = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    let promptToSend = userText;
    if (contextOverride) {
      promptToSend = `${contextOverride}\n\nUser says: ${userText}`;
    }

    startStream(promptToSend, history, SYSTEM_PROMPTS.FREE_ASSESSMENT, screenContext || undefined);
  };

  const handleOptionSelect = (option: ChatOption, isMultiSelect?: boolean) => {
    if (isMultiSelect) return;
    addUserMessage(option.label);

    if (isStep1(currentStep)) {
      processStepLogic(option.value);
    } else if (currentStep === AssessmentStep.STRATEGIC_GOALS || currentStep === AssessmentStep.SUCCESS_CRITERIA) {
      // Step 2 Logic
      processStep2Logic(option.value, option.label);
    } else if (currentStep === AssessmentStep.CHALLENGES_MAP || currentStep === AssessmentStep.CONSTRAINTS) {
      // Step 3 Logic
      processStep3Logic(option.value);
    } else {
      handleAiConversation(option.label);
    }
  };

  const isStep1 = (step: AssessmentStep) => {
    const step1Steps = [
      AssessmentStep.INTRO, AssessmentStep.INDUSTRY,
      AssessmentStep.SIZE, AssessmentStep.COUNTRY,
      AssessmentStep.BUSINESS_MODEL, AssessmentStep.CORE_PROCESSES, AssessmentStep.IT_LANDSCAPE,
      AssessmentStep.SUMMARY
    ];
    return step1Steps.includes(step);
  };

  const handleMultiSelectSubmit = (values: string[]) => {
    const text = `Selected: ${values.join(', ')}`;
    addUserMessage(text);

    if (currentStep === AssessmentStep.CORE_PROCESSES) {
      setProfileData(prev => ({ ...prev, coreProcesses: values }));
      setCurrentStep(AssessmentStep.IT_LANDSCAPE);
      addAiMessage("Got it. Now, tell me about your IT Landscape. Which ERP do you use?", [
        { id: 'sap', label: 'SAP', value: 'SAP' },
        { id: 'ms', label: 'Microsoft', value: 'Microsoft' },
        { id: 'oracle', label: 'Oracle', value: 'Oracle' },
        { id: 'other', label: 'Other/None', value: 'Other' }
      ]);
    }
  };

  // --- LOGIC: STEP 1 (Profile) ---
  const processStepLogic = (value: string) => {
    switch (currentStep) {
      case AssessmentStep.INTRO:
        if (value === 'start') {
          setCurrentStep(AssessmentStep.INDUSTRY);
          addAiMessage(t.industry.replace('{role}', ''), [
            { id: 'mfg', label: opts.mfg, value: 'Production' },
            { id: 'log', label: opts.log, value: 'Logistics' }
          ]);
        }
        break;

      case AssessmentStep.INDUSTRY:
        setProfileData(prev => ({ ...prev, industry: value }));
        setCurrentStep(AssessmentStep.SIZE);
        addAiMessage(t.size, [
          { id: 's', label: '< 50', value: '< 50' },
          { id: 'm', label: '51 - 250', value: '51-250' },
          { id: 'l', label: '> 250', value: '> 250' }
        ]);
        break;

      case AssessmentStep.SIZE:
        setProfileData(prev => ({ ...prev, size: value }));
        setCurrentStep(AssessmentStep.COUNTRY);
        addAiMessage(t.country, [
          { id: 'pl', label: 'Poland', value: 'Poland' },
          { id: 'de', label: 'Germany', value: 'Germany' },
          { id: 'us', label: 'USA', value: 'USA' },
          { id: 'sa', label: 'Saudi Arabia', value: 'Saudi Arabia' }
        ]);
        break;

      case AssessmentStep.COUNTRY:
        setProfileData(prev => ({ ...prev, country: value }));
        // Move to Business Model
        setCurrentStep(AssessmentStep.BUSINESS_MODEL);
        addAiMessage("What is your primary Business Model?", [
          { id: 'b2b', label: 'B2B', value: 'B2B' },
          { id: 'b2c', label: 'B2C', value: 'B2C' },
          { id: 'marketplace', label: 'Marketplace', value: 'Marketplace' }
        ]);
        break;

      case AssessmentStep.BUSINESS_MODEL:
        setProfileData(prev => ({ ...prev, businessModel: { type: [value], description: '' } }));
        setCurrentStep(AssessmentStep.CORE_PROCESSES);
        addAiMessage("Select your Core Processes (Multiple):", [
          { id: 'sales', label: 'Sales & Marketing', value: 'Sales' },
          { id: 'prod', label: 'Production / Mfg', value: 'Production' },
          { id: 'log', label: 'Logistics / Supply Chain', value: 'Logistics' },
          { id: 'finance', label: 'Finance & HR', value: 'Finance' },
          { id: 'rnd', label: 'R&D', value: 'R&D' }
        ], true); // Enable Multiselect
        break;

      case AssessmentStep.IT_LANDSCAPE:
        setProfileData(prev => ({ ...prev, itLandscape: { ...prev.itLandscape, erp: value } }));
        setSessionData({ ...sessionData, step1Completed: true }); // Mark Step 1 Done

        // Trigger Summary Step
        setCurrentStep(AssessmentStep.SUMMARY);
        addAiMessage(`Profile Complete.\n- Industry: ${profileData.industry}\n- Size: ${profileData.size}\n- Model: ${profileData.businessModel?.type?.[0]}\n- ERP: ${value}\n\nReady for Strategic Goals?`, [
          { id: 'confirm', label: opts.confirm, value: 'confirm' }
        ]);
        break;

      case AssessmentStep.SUMMARY:
        if (value === 'confirm') {
          onNavigate(AppView.QUICK_STEP2_USER_CONTEXT);
        }
        break;
    }
  };

  // --- LOGIC: STEP 2 (Goals) ---
  const startStep2Flow = () => {
    setCurrentStep(AssessmentStep.STRATEGIC_GOALS);
    addAiMessage("Let's define your Strategic Goals. What is the #1 priority for this transformation?", [
      { id: 'eff', label: 'Efficiency & Cost', value: 'Efficiency' },
      { id: 'growth', label: 'Growth & Scale', value: 'Growth' },
      { id: 'qual', label: 'Quality & Compliance', value: 'Quality' },
      { id: 'inn', label: 'Innovation', value: 'Innovation' }
    ]);
  };

  const processStep2Logic = (value: string, label: string) => {
    if (currentStep === AssessmentStep.STRATEGIC_GOALS) {
      // Create a new goal
      const newGoal: StrategicGoal = {
        id: Date.now().toString(),
        title: `${label} Improvement`,
        type: value as any,
        priority: 'High',
        horizon: '12m'
      };
      const updatedGoals = [...(sessionData.strategicGoals || []), newGoal];
      setSessionData({ ...sessionData, strategicGoals: updatedGoals });

      setCurrentStep(AssessmentStep.SUCCESS_CRITERIA);
      addAiMessage("How will you measure success? (e.g., 'Reduce costs by 20%')", [
        { id: 'kpi1', label: 'Cost Reduction -15%', value: 'Cost -15%' },
        { id: 'kpi2', label: 'Output +20%', value: 'Output +20%' },
        { id: 'kpi3', label: 'Zero Defects', value: '0 Defects' }
      ]);
    } else if (currentStep === AssessmentStep.SUCCESS_CRITERIA) {
      setSessionData({ ...sessionData, successCriteria: label, step2Completed: true });
      onNavigate(AppView.QUICK_STEP3_EXPECTATIONS);
    }
  };

  // --- LOGIC: STEP 3 (Challenges & Constraints) ---
  const startStep3Flow = () => {
    setCurrentStep(AssessmentStep.CHALLENGES_MAP);
    addAiMessage("Now, the Challenges Map. What is hurting you the most right now?", [
      { id: 'ppl', label: 'Lack of Skills (People)', value: 'People' },
      { id: 'proc', label: 'Inefficient Processes', value: 'Process' },
      { id: 'tech', label: 'Legacy Systems (Tech)', value: 'Technology' },
      { id: 'data', label: 'Bad Data Quality', value: 'Data' }
    ]);
  };

  const processStep3Logic = (value: string) => {
    if (currentStep === AssessmentStep.CHALLENGES_MAP) {
      // Create challenge
      const newChallenge: Challenge = {
        id: Date.now().toString(),
        title: `Critical Gap in ${value}`,
        area: value as any,
        severity: 5,
        impact: 5,
        description: 'Identified during quick scan.'
      };
      const updatedChallenges = [...(sessionData.challengesMap || []), newChallenge];
      setSessionData({ ...sessionData, challengesMap: updatedChallenges });

      setCurrentStep(AssessmentStep.CONSTRAINTS);
      addAiMessage("Finally, do you have any hard constraints?", [
        { id: 'none', label: 'No hard constraints', value: 'None' },
        { id: 'budget', label: 'Limited Budget', value: 'Budget' },
        { id: 'time', label: 'Short Deadline (<3m)', value: 'Time' }
      ]);
    } else if (currentStep === AssessmentStep.CONSTRAINTS) {
      if (value !== 'None') {
        const newConstraint: Constraint = {
          id: Date.now().toString(),
          type: value as any,
          description: 'Hard limit by user',
          impactLevel: 'High'
        };
        setSessionData({ ...sessionData, constraints: [...(sessionData.constraints || []), newConstraint], step3Completed: true });
      } else {
        setSessionData({ ...sessionData, step3Completed: true });
      }
      // Done with Module 1
      addAiMessage("Module 1 Complete! We have your profile, goals, and challenges. Ready to create your account and start the full Assessment?", [
        { id: 'yes_full', label: 'Create Account & Start', value: 'yes_full' }
      ]);
    }
  };

  const handleSendMessage = (text: string) => {
    addUserMessage(text);
    if (isStep1(currentStep)) {
      // Allow typing for custom inputs if needed, or fallback
      handleAiConversation(text);
    } else {
      handleAiConversation(text);
    }
  };

  // --- EFFECT: Handle View Switching ---
  useEffect(() => {
    // Logic to resume specific steps based on View
    const timeout = setTimeout(() => {
      // Check if we already have the "starter message" for Step 2 to avoid duplicate triggers
      const hasStep2Msg = messages.some(m => m.content.includes("Strategic Goals"));
      // Check if we already have the "starter message" for Step 3
      const hasStep3Msg = messages.some(m => m.content.includes("Challenges Map"));

      if (currentAppView === AppView.QUICK_STEP2_USER_CONTEXT && !sessionData.step2Completed && currentStep !== AssessmentStep.STRATEGIC_GOALS && !hasStep2Msg) {
        startStep2Flow();
      }
      if (currentAppView === AppView.QUICK_STEP3_EXPECTATIONS && !sessionData.step3Completed && currentStep !== AssessmentStep.CHALLENGES_MAP && !hasStep3Msg) {
        startStep3Flow();
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [currentAppView, messages, sessionData, currentStep]);

  const getActiveStepIndex = () => {
    if (currentAppView === AppView.QUICK_STEP3_EXPECTATIONS) return 3;
    if (currentAppView === AppView.QUICK_STEP2_USER_CONTEXT) return 2;
    return 1;
  };

  return (
    <div className="flex w-full h-full">
      <div className="flex-1 flex flex-col h-full min-w-[600px] border-r border-elegant">
        <StepIndicator activeIdx={getActiveStepIndex()} />
        <ChatPanel
          messages={
            isStreaming
              ? [...messages, {
                id: 'streaming-ai',
                role: 'ai',
                content: streamedContent,
                timestamp: new Date()
              } as ChatMessage]
              : messages
          }
          onSendMessage={handleSendMessage}
          onOptionSelect={handleOptionSelect}
          onMultiSelectSubmit={handleMultiSelectSubmit}
          isTyping={isTyping}
        />
      </div>
      <div className="w-[50vw] shrink-0 bg-navy-900 flex flex-col border-l border-white/5">
        {currentAppView === AppView.QUICK_STEP3_EXPECTATIONS ? (
          <Step3Workspace
            profile={profileData}
            sessionData={sessionData}
            onStartFullProject={() => onNavigate(AppView.FULL_STEP1_ASSESSMENT)}
          />
        ) : currentAppView === AppView.QUICK_STEP2_USER_CONTEXT ? (
          <Step2Workspace
            profile={profileData}
            sessionData={sessionData}
            onNextStep={() => onNavigate(AppView.QUICK_STEP3_EXPECTATIONS)}
          />
        ) : (
          <Step1Workspace
            profile={profileData}
            sessionData={sessionData}
            isStepComplete={!!sessionData.step1Completed}
            onNextStep={() => onNavigate(AppView.QUICK_STEP2_USER_CONTEXT)}
          />
        )}
      </div>
    </div>
  );
};
