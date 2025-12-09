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
  AxisId
} from '../types';
import { translations } from '../translations';
import { Check } from 'lucide-react';
import { quickWinsLibrary } from '../contentLibraries';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI, SYSTEM_PROMPTS, AIMessageHistory } from '../services/ai/gemini';

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

  const [currentStep, setCurrentStep] = useState<AssessmentStep>(AssessmentStep.INTRO);
  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.chat.scripts;
  const opts = translations.chat.options;

  const [profileData, setProfileData] = useState<Partial<CompanyProfile>>({
    name: currentUser?.companyName || 'My Company',
    role: '',
    industry: '',
    size: '',
    country: ''
  });

  // --- EFFECT: Handle View Switching ---
  useEffect(() => {
    // Logic to resume specific steps based on View
    if (currentAppView === AppView.QUICK_STEP2_CHALLENGES && !sessionData.step2Completed && currentStep !== AssessmentStep.CHALLENGES && currentStep !== AssessmentStep.PRIORITY && currentStep !== AssessmentStep.DIGITAL_MATURITY && currentStep !== AssessmentStep.REVENUE) {
      startStep2Flow();
    }
    if (currentAppView === AppView.QUICK_STEP3_RECOMMENDATIONS && !sessionData.step3Completed) {
      startStep3Flow();
    }
  }, [currentAppView]);

  useEffect(() => {
    if (messages.length === 0 && currentAppView === AppView.QUICK_STEP1_PROFILE && currentUser) {
      const greeting = t.intro[language].replace('{name}', currentUser.firstName);
      // We can use AI to generate greeting too, but hardcoded checks correct key is nice.
      // Let's use hardcoded for instant load, then transition to AI.
      const initialMsg: ChatMessage = {
        id: '1',
        role: 'ai',
        content: greeting,
        timestamp: new Date(),
        options: [
          { id: 'start', label: opts.start[language], value: 'start' },
          { id: 'explain', label: opts.explain[language], value: 'explain' }
        ]
      };
      addChatMessage(initialMsg);
    }
  }, [currentUser, currentAppView, messages.length]);

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

  // --- AI HANDLER ---
  const handleAiConversation = async (userText: string, contextOverride?: string) => {
    setIsTyping(true);

    // Prepare history
    // We map our ChatMessage (user/ai) to Gemini (user/model)
    // We filter out options or metadata, just keep text
    const history: AIMessageHistory[] = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // If step 2 or 3, we inject the System Prompt tailored for that step if it's the start
    // But currently we use the global SYSTEM_PROMPT.
    // We can append context to the user message invisibly?
    // Or just rely on the conversation flow.

    let promptToSend = userText;
    if (contextOverride) {
      promptToSend = `${contextOverride}\n\nUser says: ${userText}`;
    }

    const responseText = await sendMessageToAI(history, promptToSend, SYSTEM_PROMPTS.FREE_ASSESSMENT);

    // Check if AI suggested moving to next step? (e.g. [NEXT]) - For now simpler: Just display text.
    addAiMessage(responseText, undefined, false, 0); // Delay handled by await
  };

  const handleOptionSelect = (option: ChatOption, isMultiSelect?: boolean) => {
    if (isMultiSelect) return;
    addUserMessage(option.label);

    // If we are in Step 1 (Structured), use processStepLogic
    if (isStep1(currentStep)) {
      processStepLogic(option.value);
    } else {
      // Step 2/3: Pass option label as text to AI to continue conversation
      // Also fire specific logic if needed (e.g. Priority Selection)
      if (currentStep === AssessmentStep.PRIORITY) {
        // Handle priority selection logic explicitly, then tell AI
        handlePrioritySelection(option.value, option.label);
      } else if (currentStep === AssessmentStep.REVENUE || currentStep === AssessmentStep.DIGITAL_MATURITY) {
        processStepLogic(option.value);
      } else {
        handleAiConversation(option.label);
      }
    }
  };

  const isStep1 = (step: AssessmentStep) => {
    // Intro -> Summary are Step 1
    const step1Steps = [
      AssessmentStep.INTRO, AssessmentStep.ROLE, AssessmentStep.INDUSTRY,
      AssessmentStep.SIZE, AssessmentStep.COUNTRY, AssessmentStep.HORIZON,
      AssessmentStep.GOAL, AssessmentStep.SUMMARY
    ];
    return step1Steps.includes(step);
  };

  const handleMultiSelectSubmit = (values: string[]) => {
    const text = `Selected pain points: ${values.join(', ')}`;
    addUserMessage(text);

    if (currentStep === AssessmentStep.CHALLENGES) {
      setSessionData({ ...sessionData, painPoints: values });
      setCurrentStep(AssessmentStep.PRIORITY);

      // Notify AI and ask for transition to Priority
      const context = `User selected these pain points: ${values.join(', ')}. Now ask them to select their ONE top priority area to focus on.`;

      // We manually show chips for priority to force structured choice, but let AI ask the question
      handleAiConversation("", context).then(() => {
        // We append chips to the LAST AI message (which we just added)
        // Since we can't easily modify the last message in store without action,
        // for now let's just add a separate "System" message with chips?
        // Or better: Just Add a new AI message with the chips.
        // Actually, handleAiConversation adds a message.
        // We can't attach options to it easily here.
        // Workaround: Add the options in a follow-up 0ms delay message or assume AI text + Chips are separate.
        // Let's hardcode chips for Priority.
        const priorityOpts = [
          { id: 'proc', label: opts.proc[language], value: 'Processes' },
          { id: 'data', label: opts.data[language], value: 'Data' },
          { id: 'auto', label: opts.auto[language], value: 'Automation' },
          { id: 'cult', label: opts.culture[language], value: 'Culture' }
        ];
        // We force a new message for chips
        // addAiMessage("Please select the priority:", priorityOpts);
        // Better: update the AI message options? Too complex for now.
        // Just send another message.
        addAiMessage("Select your priority:", priorityOpts, false, 200);
      });
    }
  };

  const handlePrioritySelection = (value: string, label: string) => {
    setSessionData({ ...sessionData, priorityArea: value });
    setCurrentStep(AssessmentStep.DIGITAL_MATURITY);

    // Tell AI
    const context = `User chose priority: ${label}. Now move to assessing Digital Maturity (1-5).`;
    handleAiConversation("", context).then(() => {
      addAiMessage("Rate your maturity:", [
        { id: '1', label: '1 - Low', value: '1' },
        { id: '3', label: '3 - Medium', value: '3' },
        { id: '5', label: '5 - High', value: '5' }
      ], false, 200);
    });
  };

  const handleSendMessage = (text: string) => {
    addUserMessage(text);
    if (isStep1(currentStep)) {
      // In Step 1, we mostly expect Chip clicks, but if they type, we treat as generic AI chat?
      // Or ignore? Let's treat as AI chat but warn it might break structure.
      // Actually, let's keep Step 1 strict.
      processStepLogic('start'); // Fallback
    } else {
      // Step 2/3 - Open conversation
      handleAiConversation(text);
    }
  };

  // --- STEP 2 LOGIC ---
  const startStep2Flow = () => {
    setCurrentStep(AssessmentStep.CHALLENGES);
    // Start AI Context
    const profileSummary = `Profile: ${profileData.role}, ${profileData.industry}, ${profileData.size}, ${profileData.country}. Goal: ${sessionData.goal}.`;
    const context = `${profileSummary} We are entering Step 2: Challenges. Ask the user to identify their main inefficiencies or pain points. Suggest generic options but encourage them to elaborate.`;

    handleAiConversation("", context).then(() => {
      // Show default chips as backup/suggestions
      addAiMessage("", [
        { id: 'ineff', label: opts.inefficient[language], value: 'Inefficient Processes' },
        { id: 'vis', label: opts.lackData[language], value: 'Lack of Visibility' },
        { id: 'man', label: opts.manual[language], value: 'Manual Work' },
        { id: 'qual', label: opts.quality[language], value: 'Quality Issues' },
        { id: 'auto', label: opts.automation[language], value: 'Low Automation' }
      ], true, 0);
    });
  };

  // --- STEP 3 LOGIC GENERATION ---
  const startStep3Flow = () => {
    const pain = sessionData.mainPainPoint || sessionData.painPoints?.[0] || 'Efficiency';

    // We let AI generate the specific recommendations based on the whole chat history!
    const context = `Step 2 completed. Priority: ${sessionData.priorityArea}. Pain Points: ${sessionData.painPoints?.join(', ')}. Revenue: ${sessionData.revenueBracket}. Now providing Step 3: Recommendations.
    Generate 3 specific "Quick Wins" for this client.
    Format them clearly.
    Then ask if they want to unlock the Full Pilot.`;

    // AI generates the text
    handleAiConversation("", context);

    // We still need to populate specific "Quick Wins" cards on the right.
    // For Phase 1/2, we can keep using any library generic ones OR ask AI to output JSON.
    // Let's stick to Library for the *Cards* but AI for the *Explanation*.
    // ... existing logic to populate sessionData.generatedQuickWins ...
    updateQuickWinsFromLibrary(pain);

    setTimeout(() => {
      addAiMessage(translations.chat.scripts.step3Upsell[language], [
        { id: 'yes', label: opts.yesFull[language], value: 'yes_full' },
        { id: 'no', label: opts.notNow[language], value: 'not_now' }
      ], false, 4000);
    }, 1000);
  };

  const updateQuickWinsFromLibrary = (pain: string) => {
    // ... logic from before to populate cards
    const focusAreas = ['Process Optimization', 'Data Digitization'];
    const quickWins = [...quickWinsLibrary.generic];

    const priorityKey = sessionData.priorityArea?.toLowerCase() as string;
    let axisKey: AxisId | undefined;
    if (priorityKey?.includes('process')) axisKey = 'processes';
    else if (priorityKey?.includes('data')) axisKey = 'dataManagement';
    else if (priorityKey?.includes('culture')) axisKey = 'culture';
    else if (priorityKey?.includes('auto')) axisKey = 'aiMaturity';
    // 3. Fallback for pain points
    if (pain.includes('Inefficient')) {
      const procWins = quickWinsLibrary.byAxis['processes']?.[0];
      if (procWins) {
        quickWins.push({ ...procWins, axis: 'processes' });
      }
    }

    // Ensure all have axis if required by type (casting for now to avoid complexity if type is loose but lint is strict)
    // The previous mapping logic was trying to fix items already in array. 
    // If 'generic' items have axis, we are good. If not, we might need map.
    // Let's assume generic items have axis.

    // const finalWins = quickWins.map(w => ({ ...w, axis: (w as any).axis || 'generic' }));
    // Reverting to direct usage if quickWins is correct type now.

    // Fix: Add axis to the items being pushed from byAxis
    if (axisKey && quickWinsLibrary.byAxis[axisKey]) {
      const specificWins = quickWinsLibrary.byAxis[axisKey].map(w => ({ ...w, axis: axisKey || 'generic' }));
      // We use 'any' cast to bypass the specific axis enum check if strict
      quickWins.push(...(specificWins as any[]));
    }

    const updatedSession = {
      ...sessionData,
      generatedFocusAreas: focusAreas.slice(0, 5),
      generatedQuickWins: quickWins.slice(0, 5),
      step3Completed: true
    };
    setSessionData(updatedSession);
  };

  const handleUpdateQuickWin = (index: number, updatedWin: { title: string; desc: string }) => {
    const currentWins = sessionData.generatedQuickWins ? [...sessionData.generatedQuickWins] : [];
    if (index >= 0 && index < currentWins.length) {
      currentWins[index] = updatedWin;
      setSessionData({ ...sessionData, generatedQuickWins: currentWins });
    }
  };

  const processStepLogic = (value: string) => {
    if (value === 'yes_full') {
      onNavigate(AppView.FULL_STEP1_ASSESSMENT);
      return;
    }
    if (value === 'not_now') return;

    switch (currentStep) {
      case AssessmentStep.INTRO:
        if (value === 'start') {
          setCurrentStep(AssessmentStep.ROLE);
          addAiMessage(t.role[language], [
            { id: 'ceo', label: opts.ceo[language], value: 'CEO' },
            { id: 'plant', label: opts.plant[language], value: 'Plant Manager' },
            { id: 'coo', label: opts.coo[language], value: 'COO' },
            { id: 'other', label: 'Other', value: 'Other' }
          ]);
        }
        break;

      case AssessmentStep.ROLE:
        setProfileData(prev => ({ ...prev, role: value }));
        setCurrentStep(AssessmentStep.INDUSTRY);
        addAiMessage(t.industry[language].replace('{role}', value), [
          { id: 'mfg', label: opts.mfg[language], value: 'Production' },
          { id: 'log', label: opts.log[language], value: 'Logistics' }
        ]);
        break;

      case AssessmentStep.INDUSTRY:
        setProfileData(prev => ({ ...prev, industry: value }));
        setCurrentStep(AssessmentStep.SIZE);
        addAiMessage(t.size[language], [
          { id: 's', label: '< 50', value: '< 50' },
          { id: 'm', label: '51 - 250', value: '51-250' },
          { id: 'l', label: '> 250', value: '> 250' }
        ]);
        break;

      case AssessmentStep.SIZE:
        setProfileData(prev => ({ ...prev, size: value }));
        setCurrentStep(AssessmentStep.COUNTRY);
        addAiMessage(t.country[language], [
          { id: 'pl', label: 'Poland', value: 'Poland' },
          { id: 'de', label: 'Germany', value: 'Germany' },
          { id: 'us', label: 'USA', value: 'USA' },
          { id: 'sa', label: 'Saudi Arabia', value: 'Saudi Arabia' }
        ]);
        break;

      case AssessmentStep.COUNTRY:
        setProfileData(prev => ({ ...prev, country: value }));
        setCurrentStep(AssessmentStep.HORIZON);
        addAiMessage(t.horizon[language], [
          { id: '3m', label: opts.m3[language], value: '3' },
          { id: '6m', label: opts.m6[language], value: '6' },
          { id: '12m', label: opts.m12[language], value: '12' }
        ]);
        break;

      case AssessmentStep.HORIZON:
        setSessionData({ ...sessionData, timeHorizon: value });
        setCurrentStep(AssessmentStep.GOAL);
        addAiMessage(t.goal[language], [
          { id: 'effic', label: 'Increase Efficiency', value: 'Efficiency' },
          { id: 'cost', label: 'Reduce Costs', value: 'Reduce Costs' }
        ]);
        break;

      case AssessmentStep.GOAL:
        setSessionData({ ...sessionData, goal: value, step1Completed: true });
        setCurrentStep(AssessmentStep.SUMMARY);
        addAiMessage(t.summary[language].replace('{role}', profileData.role || '').replace('{industry}', profileData.industry || '').replace('{goal}', value || ''), [
          { id: 'confirm', label: opts.confirm[language], value: 'confirm' }
        ]);
        break;

      case AssessmentStep.SUMMARY:
        if (value === 'confirm') {
          // Move to Step 2 AI Flow
          // We initiate logic here?
          // Note: Sidebar or App checks session status.
          // Let's just manually trigger next step.
          onNavigate(AppView.QUICK_STEP2_CHALLENGES);
        }
        break;

      case AssessmentStep.DIGITAL_MATURITY:
        setSessionData({ ...sessionData, digitalMaturity: value });
        setCurrentStep(AssessmentStep.REVENUE);
        // Tell AI context and ask next
        handleAiConversation("", `User maturity: ${value}. Ask for Revenue Bracket.`).then(() => {
          addAiMessage("", [
            { id: 's', label: '< $5M', value: '< $5M' },
            { id: 'm', label: '$5M - $20M', value: '$5M - $20M' },
            { id: 'l', label: '> $20M', value: '> $20M' }
          ], false, 200);
        });
        break;

      case AssessmentStep.REVENUE:
        setSessionData({ ...sessionData, revenueBracket: value, step2Completed: true });
        // Finish Step 2
        onNavigate(AppView.QUICK_STEP3_RECOMMENDATIONS);
        break;
    }
  };

  const getActiveStepIndex = () => {
    if (currentAppView === AppView.QUICK_STEP3_RECOMMENDATIONS) return 3;
    if (currentAppView === AppView.QUICK_STEP2_CHALLENGES) return 2;
    return 1;
  };

  const StepIndicator = () => {
    const activeIdx = getActiveStepIndex();
    return (
      <div className="flex items-center justify-center py-4 border-b border-white/5 bg-navy-950">
        {[1, 2, 3].map((step) => {
          const isCompleted = step < activeIdx;
          const isActive = step === activeIdx;
          return (
            <div key={step} className="flex items-center">
              {/* Dot */}
              <div className={`
                              flex items-center justify-center w-8 h-8 rounded-full border transition-all
                              ${isActive ? 'bg-purple-600 border-purple-500 text-white' :
                  isCompleted ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-navy-900 border-white/10 text-slate-500'}
                          `}>
                {isCompleted ? <Check size={14} /> : <span className="text-xs font-bold">{step}</span>}
              </div>

              {/* Label */}
              <span className={`ml-2 text-xs font-medium hidden lg:block ${isActive ? 'text-white' : 'text-slate-500'}`}>
                {step === 1 ? 'Profile' : step === 2 ? 'Challenges' : 'Plan'}
              </span>

              {/* Line */}
              {step < 3 && (
                <div className={`w-12 h-px mx-3 ${isCompleted ? 'bg-green-500/30' : 'bg-white/10'}`}></div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex w-full h-full" dir={language === 'AR' ? 'rtl' : 'ltr'}>
      {/* CENTER: Chat - Flex Grow */}
      <div className={`flex-1 flex flex-col h-full min-w-[600px] ${language === 'AR' ? 'border-l' : 'border-r'} border-elegant`}>

        {/* Step Indicator inside Chat Panel */}
        <StepIndicator />

        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onOptionSelect={handleOptionSelect}
          onMultiSelectSubmit={handleMultiSelectSubmit}
          isTyping={isTyping}
        />
      </div>

      {/* RIGHT: Workspace - Fixed Width */}
      <div className="w-[450px] shrink-0 bg-navy-900 flex flex-col border-l border-white/5">
        {currentAppView === AppView.QUICK_STEP3_RECOMMENDATIONS ? (
          <Step3Workspace
            profile={profileData}
            sessionData={sessionData}
            onStartFullProject={() => onNavigate(AppView.FULL_STEP1_ASSESSMENT)}
            language={language}
            onUpdateQuickWin={handleUpdateQuickWin}
          />
        ) : currentAppView === AppView.QUICK_STEP2_CHALLENGES ? (
          <Step2Workspace
            profile={profileData}
            sessionData={sessionData}
            onNextStep={() => onNavigate(AppView.QUICK_STEP3_RECOMMENDATIONS)}
            language={language}
          />
        ) : (
          <Step1Workspace
            profile={profileData}
            sessionData={sessionData}
            isStepComplete={!!sessionData.step1Completed}
            onNextStep={() => onNavigate(AppView.QUICK_STEP2_CHALLENGES)}
            language={language}
          />
        )}
      </div>
    </div>
  );
};
