
export const translations = {
  sidebar: {
    // Main Sections
    dashboard: 'Dashboard',
    quickAssessment: 'Quick Assessment',
    fullProject: 'Full Transformation',
    masterclass: 'Masterclass',
    resources: 'Resources',

    // Modules
    module1: '1. Expectations & Challenges',
    module1_1: 'Company Profile',
    module1_2: 'Goals & Expectations',
    module1_3: 'Challenges Map',

    module2: '2. Assessment (DRD)',
    module3: '3. Initiatives & Roadmap',
    module3_1: 'Initiatives List',
    module3_2: 'Roadmap Builder',

    module4: '4. Pilot Execution',
    module5: '5. Full Rollout',
    module6: '6. Economics & ROI',
    module7: '7. Execution Reports',

    // Admin
    adminPanel: 'Admin Panel',
    adminUsers: 'Users',
    adminProjects: 'Projects',
    adminLLM: 'LLM Management',
    adminKnowledge: 'Knowledge Base',
    adminFeedback: 'User Feedback',

    // Quick Steps
    quickStep1: 'Company & Expectations',
    quickStep2: 'Challenges & Profile Questions',
    quickStep3: 'Recommendations',

    // Full Steps
    fullStep1: 'Assessment (DRD)',
    fullStep1_proc: 'Processes',
    fullStep1_prod: 'Digital Products',
    fullStep1_model: 'Business Models',
    fullStep1_data: 'Data Management',
    fullStep1_cult: 'Culture',
    fullStep1_ai: 'AI Maturity',

    fullStep2: 'Initiatives Generator',
    fullStep3: 'Transformation Roadmap',
    fullStep4: 'Economics & ROI',
    fullStep5: 'Execution Dashboard',
    fullStep6: 'Reports',

    // Actions
    newConversation: 'New Conversation',
    settings: 'Settings',
    mobileApp: 'Mobile App',
    logOut: 'Log Out',
  },
  settings: {
    menu: {
      header: 'Settings',
      myProfile: 'My Profile',
      billing: 'Billing & Plans',
      aiConfig: 'AI Configuration',
      notifications: 'Notifications',
      integrations: 'Integrations',
      regionalization: 'Regionalization',
    },
    profile: {
      header: 'My Profile',
      photo: 'Profile Photo',
      photoHint: 'Strictly professional. AI judges you.',
      firstName: 'First Name',
      lastName: 'Last Name',
      role: 'Role',
      email: 'Email',
      company: 'Company',
      preferences: 'Preferences',
      theme: 'Theme',
      light: 'Light',
      dark: 'Dark',
      language: 'Language',
      save: 'Save Changes',
      saving: 'Saving...',
      saved: 'Settings Saved',
      changePhoto: 'Change Photo',
      manage: 'Manage your personal information and preferences.'
    }
  },
  auth: {
    startQuick: 'Start Your Quick Assessment',
    setupFull: 'Setup Your Full Account',
    unlockFull: 'Unlock Full Transformation',
    enterCode: 'Enter the 6-digit access code provided by DBR77.',
    verifyCode: 'Verify Code',
    personalize: 'We need a few details to personalize your roadmap.',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Work Email',
    phone: 'Phone Number',
    company: 'Company Name',
    password: 'Password (min. 8 chars)',
    createStart: 'Create Account & Start',
    haveAccount: 'Already have an account?',
    noAccount: "Don't have an account?",
    logIn: 'Log In',
    createOne: 'Create one',
    welcomeBack: 'Welcome Back!',
    signInText: 'Sign in to continue your transformation journey.',
    backToStart: 'Back to Start Screen',
  },
  step1: {
    title: 'Step 1 of 3 — Company & Expectations',
    subtitle: 'Quick Assessment',
    profile: 'Company Profile',
    role: 'Role',
    industry: 'Industry',
    size: 'Size',
    country: 'Country',
    expectations: 'Challenges & Goals',
    mainChallenges: 'Main Challenges',
    mainGoal: 'Main Transformation Goal',
    horizon: 'Time Horizon',
    nextStep: 'Go to Action Proposals (Step 2)',
    notSelected: 'Not selected yet...',
    toBeDefined: 'To be defined...',
    months: 'months',
  },
  step3: {
    title: 'Step 3 of 3 — Recommendations',
    snapshot: 'Company Snapshot',
    focusAreas: 'Recommended Focus Areas',
    quickWins: 'Actionable Quick Wins',
    startFull: 'Start Full Transformation Project',
    download: 'Download Summary',
    revenue: 'Revenue',
    maturity: 'Digital Maturity',
  },
  chat: {
    header: 'Transformation Assistant',
    subHeader: 'Step 1: Profiling',
    placeholder: 'Type your answer...',
    scripts: {
      intro: `Hello {name}. I am your Transformation Assistant.\n\nIn this Quick Assessment (Free), we will go through 3 steps:\n1. Company & expectations\n2. Challenges & profile questions\n3. Recommendations & quick wins.\n\nShall we start?`,
      role: "Great. Let's start with the basics.\n\nWhat is your role in the company?",
      industry: "Nice to meet you, {role}. Perspective matters.\n\nWhat industry do you operate in?",
      industrySub: "Production. Got it. What kind specifically?",
      size: "How many employees do you have roughly?",
      country: "Understood. Scale changes the available solutions.\n\nWhich country is your main operation in?",
      challenges: "Great, let's explore your current challenges to build meaningful recommendations.\n\nWhat is your main operational pain point? (Select one or type)",
      goal: "Understood. Dealing with key challenges.\n\nNow, if we talk in 12 months, what would be the MAIN success statement you'd like to make?",
      horizon: "Clear goal.\n\nWhen do you need to see the first tangible results?",
      summary: "Perfect. We have the profile.\n\nSummary:\n- Role: {role}\n- Sector: {industry}\n- Goal: {goal}\n\nI will now generate specific ideas for you.",
      done: "Great! Please click the button on the right to view your Action Proposals.",
      step3Intro: "Based on your answers, here is a quick snapshot of your situation and my recommendations.",
      step3Summary: "Your company is in the {industry} sector with a clear goal to {goal}. The main challenge is {painPoint}.",
      step3Focus: "I recommend focusing immediately on these areas:",
      step3Wins: "Here are some Quick Wins you can start next Monday:",
      step3Upsell: "Would you like to move to the Full Transformation Project and build a full roadmap?",
    },
    options: {
      start: "OK, let's start",
      explain: "Explain process",
      ceo: "Owner / CEO",
      plant: "Plant Manager",
      coo: "COO",
      mfg: "Production",
      log: "Logistics",
      inefficient: "Inefficient production processes",
      lackData: "Lack of data / visibility",
      manual: "Too many manual tasks",
      quality: "Problems with quality",
      automation: "Low automation level",
      proc: "Processes",
      data: "Data",
      auto: "Automation",
      culture: "Culture",
      m3: "3 months",
      m6: "6 months",
      m12: "12 months",
      confirm: "Looks correct",
      edit: "Change something",
      yesFull: "Yes, start Full Project",
      notNow: "Not now"
    }
  },
  fullAssessment: {
    intro: "Welcome to the Full Digital Readiness Diagnosis (DRD). We will assess 6 key axes of your business on a scale of 1-7. This will generate your Maturity Heatmap.",
    axisIntro: "Let's assess your {axis}. How mature are you in this area?",
    startAxis: "Start Axis",
    currentAxis: "Current Axis",
    continue: "Continue",
    completed: "Completed",
    score: "Score",
    maturityOverview: "Maturity Overview",
    nextStep: "Go to Initiatives Generator (Step 2)",
    summary: "Here is your digital maturity profile across 6 axes. Based on the scores, we should prioritize {weakest}.",
    introMicrocopy: "This assessment evaluates your organization across 6 dimensions of the Digital Readiness Diagnosis (DRD) model. Scores range from 1 (Novice) to 7 (Leader).",
    descriptions: {
      processes: "Standardization & Efficiency",
      digitalProducts: "Connectivity & UX",
      businessModels: "Scalability & Revenue",
      dataManagement: "Quality & Governance",
      culture: "Skills & Mindset",
      aiMaturity: "Adoption & Strategy"
    },
    questions: {
      processes: [
        "How standardized are your core production processes?",
        "How well are your processes measured and monitored?",
        "To what extent are your processes digitally supported?"
      ],
      digitalProducts: [
        "Does your product portfolio include digital services?",
        "How integrated are your products with IoT?",
        "Do you use customer usage data to improve products?"
      ],
      businessModels: [
        "Are you shifting from CAPEX to OPEX models?",
        "Do you have digital ecosystem partnerships?",
        "How scalable is your current business model?"
      ],
      dataManagement: [
        "Is there a single source of truth for key data?",
        "How automated is data collection?",
        "Do you use predictive analytics?"
      ],
      culture: [
        "How open is the leadership to digital change?",
        "Do employees have digital skills training?",
        "Is innovation rewarded in the company?"
      ],
      aiMaturity: [
        "Are you piloting any AI solutions currently?",
        "Do you have data ready for AI training?",
        "Is there an AI strategy in place?"
      ]
    }
  },
  assessment: {
    wizard: {
      startDesc: "Assess your current digital maturity across different sub-areas.",
      startBtn: "Start Assessment",
      cancel: "Cancel",
      recommendedLevel: "Recommended Level",
      acceptResult: "Accept & Continue",
      adjustManually: "Adjust Manually"
    },
    axisContent: {
      processes: {
        title: "Processes & Operations",
        intro: "We evaluate how digitized and efficient your operational processes are.",
        areas: {
          standardization: { title: "Standardization", levels: ["Ad-hoc", "Defined", "Standardized", "Measured", "Optimized", "Automated", "Autonomous"] },
          integration: { title: "Digital Integration", levels: ["None", "Silos", "Connected", "Integrated", "Platform", "Ecosystem", "Universal"] }
        }
      },
      digitalProducts: {
        title: "Digital Products",
        intro: "How smart and connected are your products?",
        areas: {
          connectivity: { title: "Connectivity", levels: ["Offline", "Basic", "Connected", "Smart", "Intelligent", "Predictive", "Adaptive"] },
          service: { title: "Digital Services", levels: ["Product only", "Support", "Value-add", "Service-based", "Outcome-based", "Platform", "Ecosystem"] }
        }
      },
      businessModels: {
        title: "Business Models",
        intro: "Are you leveraging digital to create new value streams?",
        areas: {
          revenue: { title: "Revenue Model", levels: ["Asset sale", "Licensing", "Subscription", "Usage-based", "Performance", "Outcome", "Ecosystem"] },
          scalability: { title: "Scalability", levels: ["Linear", "Incremental", "Modular", "Digital", "Platform", " Exponential", "Infinite"] }
        }
      },
      dataManagement: {
        title: "Data Management",
        intro: "Is data a byproduct or a strategic asset?",
        areas: {
          governance: { title: "Governance", levels: ["None", "Ad-hoc", "Departmental", "Corporate", "Managed", "Optimized", "Automated"] },
          analytics: { title: "Analytics", levels: ["None", "Descriptive", "Diagnostic", "Predictive", "Prescriptive", "Cognitive", "Autonomous"] }
        }
      },
      culture: {
        title: "Culture & Organization",
        intro: "Is your organization ready for change?",
        areas: {
          leadership: { title: "Leadership", levels: ["Skeptical", "Aware", "Supportive", "Committed", "Driving", "Visionary", "Digital-Native"] },
          skills: { title: "Digital Skills", levels: ["None", "Basic", "Specialists", "Broad", "Advanced", "Expert", "Culture"] }
        }
      },
      aiMaturity: {
        title: "AI Maturity",
        intro: "How advanced is your AI adoption?",
        areas: {
          adoption: { title: "Adoption", levels: ["None", "Interest", "Pilots", "Production", "Scaling", "Strategic", "Native"] },
          capability: { title: "Capability", levels: ["None", "Outsourced", "Hybrid", "Internal", "Center of Excellence", "Industry Leader", "Innovator"] }
        }
      }
    }
  },
  fullInitiatives: {
    intro: "Based on your maturity scores, I've generated a set of transformation initiatives. You can review and edit them in the table on the right.",
    tableHeader: {
      initiative: "Initiative Name",
      axis: "Axis",
      priority: "Priority",
      complexity: "Complexity",
      status: "Status",
      notes: "Notes",
      actions: "Actions",
    },
    priorities: {
      High: 'High',
      Medium: 'Medium',
      Low: 'Low',
    },
    complexities: {
      High: 'High',
      Medium: 'Medium',
      Low: 'Low',
    },
    statuses: {
      Draft: 'Draft',
      Ready: 'Ready',
      Archived: 'Archived',
    },
    nextStep: "Go to Transformation Roadmap (Step 3)"
  },
  fullRoadmap: {
    intro: "I have drafted a roadmap for you based on the priority and complexity of your initiatives. Foundational tasks (Data/Process) are scheduled earlier.",
    tableHeader: {
      quarter: "Quarter",
      wave: "Wave",
    },
    workload: {
      title: "Workload Distribution",
      initiatives: "initiatives",
      overloaded: "Overloaded",
    },
    nextStep: "Go to Economics & ROI (Step 4)"
  },
  fullROI: {
    intro: "Now let's estimate the costs and benefits. You don't need to be precise – ranges and best guesses are ok for now.",
    tableHeader: {
      cost: "Est. Cost (k$)",
      benefit: "Est. Benefit (k$/yr)",
    },
    summary: {
      totalCost: "Total Cost",
      totalBenefit: "Total Annual Benefit",
      roi: "Overall ROI",
      payback: "Payback Period",
      years: "years",
    },
    nextStep: "Go to Execution Dashboard (Step 5)"
  },
  fullExecution: {
    intro: "Welcome to Execution Mode. Here you can track progress, assign owners, and manage blockers. Drag or update statuses to move initiatives forward.",
    columns: {
      todo: "To Do",
      inProgress: "In Progress",
      blocked: "Blocked",
      done: "Done",
    },
    kpi: {
      total: "Total Initiatives",
      completion: "Completion Rate",
    },
    fields: {
      owner: "Owner",
      dueDate: "Due Date",
      progress: "Progress",
    },
    nextStep: "Go to Final Report (Step 6)"
  },
  fullReports: {
    header: "Transformation Report",
    sections: {
      exec: "Executive Summary",
      maturity: "Digital Maturity Profile",
      initiatives: "Key Initiatives",
      roadmap: "Transformation Roadmap",
      economics: "Economics & ROI",
      execution: "Execution Status",
    },
    cards: {
      maturity: "Maturity & Focus",
      economics: "Project Economics",
      execution: "Execution Snapshot",
    },
    buttons: {
      export: "Export Report",
      copy: "Copy Text",
    },
    labels: {
      strongest: "Strongest Asset",
      weakest: "Critical Gap",
      totalCost: "Total Cost",
      annualBenefit: "Annual Benefit",
      roi: "ROI",
      payback: "Payback Period",
      completionRate: "Completion Rate",
      initiatives: "Initiatives",
      done: "Done",
      inProg: "In Prog",
      blocked: "Blocked"
    },
    reportTemplates: {
      execSummary: "{companyName} has embarked on a strategic digital transformation journey. Based on the comprehensive DRD assessment, the organization demonstrates strong maturity in {strongest} ({strongestScore}/7), while facing significant challenges in {weakest} ({weakestScore}/7).\n\nTo address these gaps, a tailored roadmap consisting of {initCount} strategic initiatives has been developed. The plan focuses on building foundational capabilities in the first 12 months before scaling advanced digital solutions.\n\nFrom an economic perspective, the transformation is projected to generate an annual benefit of ${benefit}k against a total investment of ${cost}k. This yields an attractive ROI of {roi}% with a payback period of {payback} years.",
      finding1: "{strongest} is your strongest asset, acting as a pillar for future growth.",
      finding2: "{weakest} requires immediate attention to prevent bottlenecks in scaling.",
      finding3: "The organization is ready for {type} transformation.",
      aggressive: "aggressive",
      focused: "focused"
    }
  },
  transformationScenarios: {
    banner: {
      title: "AI Strategic Recommendation",
      subtitle: "Analyzing your {count} challenges and constraints, our pattern recognition engine suggests the {name} strategy to balance ambition with operational stability."
    },
    confirm: "Confirm Strategy",
    selected: "Strategy Selected",
    select: "Select This Strategy",
    cancel: "Cancel",
    recommended: "Recommended",
    deepDive: {
      title: "Scenario Deep Dive",
      subtitle: 'Detailed analysis of the "{name}" strategy.',
      definition: "Strategy Definition",
      aiReasoning: "Why AI Suggests This",
      tradeoffs: "Strategic Trade-offs",
      gains: "Key Gains",
      sacrifices: "Sacrifices",
      impact: "Organizational Impact"
    },
    scenarios: {
      stabilize: {
        name: "Stabilize & Optimize",
        narrative: "Order first, ambition later.",
        description: "Focus on stabilizing critical processes, paying off technical debt, and preparing the organization for future changes.",
        gains: ["Operational control recovery", "Reduced failure rate", "Process clarity"],
        sacrifices: ["No 'WOW' effect", "Innovation delayed 6-12 mo", "Frustration of ambitious leaders"]
      },
      quickwins: {
        name: "Quick Wins First",
        narrative: "Show results to buy time.",
        description: "Aggressive search for low-hanging fruit to build budget and morale before deeper structural changes.",
        gains: ["Immediate ROI", "Increased team morale", "Budget for future steps"],
        sacrifices: ["Technical debt grows", "Short-term focus", "Risk of 'patchwork' architecture"]
      },
      balanced: {
        name: "Balanced Hybrid Core",
        narrative: "Change without shock, but with direction.",
        description: "Parallel execution of operational cleanup and foundational build-up for future automation and AI.",
        gains: ["Sustainable pace", "Risk mitigation", "Cultural acceptance"],
        sacrifices: ["Slower initial results", "Requires high coordination", "Resource intensive"]
      },
      foundation: {
        name: "AI & Data Foundation",
        narrative: "Data is the new oil. Build the refinery.",
        description: "Heavy investment in data infrastructure and governance before any shiny tools or apps.",
        gains: ["Scalability ready", "High quality data", "Future-proof"],
        sacrifices: ["Zero visible business value for 9mo", "High CAPEX", "Hard to explain to board"]
      },
      scaleup: {
        name: "Digital Scale-Up",
        narrative: "We have the base, now we run.",
        description: "Rapid replication of proven digital pilots across all business units.",
        gains: ["Exponential impact", "Market dominance", "Talent magnet"],
        sacrifices: ["Process breakage risk", "Governance overload", "High burn rate"]
      },
      fullreset: {
        name: "Full Digital Reset",
        narrative: "Burn the boats. New chapter.",
        description: "Abandoning legacy systems and processes to build a digital-native organization from scratch.",
        gains: ["No technical debt", "Maximum agility", "Modern stack"],
        sacrifices: ["Huge organizational resistance", "High failure risk", "Business disruption"]
      }
    }
  }
};
