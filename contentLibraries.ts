
import { AxisId } from './types';

// 1. INITIATIVES LIBRARY
export const initiativesLibrary: Record<AxisId, { id: string; name: string; description: string; complexity: 'Low' | 'Medium' | 'High'; tags: string[] }[]> = {
  processes: [
    {
      id: "proc-daily-mgmt",
      name: "Daily Shopfloor Management",
      description: "Implement 15-min stand-up meetings to review safety, quality, and output targets.",
      complexity: "Low",
      tags: ["lean", "execution"]
    },
    {
      id: "proc-digital-sop",
      name: "Digitize Standard Operating Procedures (SOPs)",
      description: "Convert paper instructions into digital, interactive guides accessible on tablets.",
      complexity: "Medium",
      tags: ["standardization", "digital"]
    },
    {
      id: "proc-process-mining",
      name: "Process Mining Pilot",
      description: "Analyze event logs from ERP/MES to identify hidden bottlenecks in the Order-to-Cash process.",
      complexity: "High",
      tags: ["analytics", "optimization"]
    }
  ],
  digitalProducts: [
    {
      id: "prod-customer-portal",
      name: "B2B Customer Portal MVP",
      description: "Launch a self-service portal for customers to track orders and view invoices.",
      complexity: "Medium",
      tags: ["cx", "platform"]
    },
    {
      id: "prod-iot-conn",
      name: "Product Connectivity (IoT) Assessment",
      description: "Evaluate feasibility of embedding sensors in core products for usage tracking.",
      complexity: "High",
      tags: ["iot", "r&d"]
    }
  ],
  businessModels: [
    {
      id: "model-ecom",
      name: "Direct-to-Consumer Channel Pilot",
      description: "Launch a pilot e-commerce store for spare parts or accessories.",
      complexity: "Medium",
      tags: ["sales", "channel"]
    },
    {
      id: "model-servitization",
      name: "Servitization Strategy Development",
      description: "Design a roadmap to shift from one-off sales to recurring service revenue.",
      complexity: "High",
      tags: ["strategy", "revenue"]
    }
  ],
  dataManagement: [
    {
      id: "data-gov-board",
      name: "Establish Data Governance Board",
      description: "Form a cross-functional team to define data ownership and quality standards.",
      complexity: "Low",
      tags: ["governance", "foundation"]
    },
    {
      id: "data-kpi-dash",
      name: "Unified Management Dashboard",
      description: "Centralize key operational KPIs into a single real-time PowerBI/Tableau view.",
      complexity: "Medium",
      tags: ["bi", "reporting"]
    },
    {
      id: "data-lake",
      name: "Data Lake Architecture Setup",
      description: "Implement a scalable data lake to store unstructured and structured data.",
      complexity: "High",
      tags: ["architecture", "infrastructure"]
    }
  ],
  culture: [
    {
      id: "cult-dig-academy",
      name: "Digital Academy Launch",
      description: "Create internal learning paths for digital upskilling of employees.",
      complexity: "Medium",
      tags: ["hr", "skills"]
    },
    {
      id: "cult-change-network",
      name: "Change Champion Network",
      description: "Identify and train digital ambassadors in every department to drive adoption.",
      complexity: "Low",
      tags: ["change-management"]
    }
  ],
  cybersecurity: [
    {
      id: "cyber-risk-assessment",
      name: "Cybersecurity Risk Assessment",
      description: "Comprehensive evaluation of current security posture and vulnerability mapping.",
      complexity: "Medium",
      tags: ["security", "compliance"]
    },
    {
      id: "cyber-zero-trust",
      name: "Zero Trust Architecture Planning",
      description: "Design and roadmap for implementing zero trust security model.",
      complexity: "High",
      tags: ["architecture", "security"]
    },
    {
      id: "cyber-awareness",
      name: "Security Awareness Program",
      description: "Employee training program on phishing, social engineering, and secure practices.",
      complexity: "Low",
      tags: ["training", "culture"]
    }
  ],
  aiMaturity: [
    {
      id: "ai-usecase-radar",
      name: "AI Opportunity Workshop",
      description: "Facilitated session to identify high-value/low-risk AI use cases.",
      complexity: "Low",
      tags: ["strategy", "ideation"]
    },
    {
      id: "ai-copilot",
      name: "Internal Knowledge Copilot",
      description: "Deploy an LLM-based assistant to search internal documentation and wikis.",
      complexity: "Medium",
      tags: ["genai", "productivity"]
    },
    {
      id: "ai-predictive-maint",
      name: "Predictive Maintenance Model",
      description: "Train ML models on historical sensor data to predict equipment failure.",
      complexity: "High",
      tags: ["ml", "operations"]
    }
  ]
};

// 2. QUICK WINS LIBRARY
export const quickWinsLibrary = {
  generic: [
    {
      title: "Weekly 'Kaizen' Stand-up",
      desc: "Start a 15-minute weekly meeting focused solely on small process improvements.",
      axis: "culture"
    },
    {
      title: "Digital Shift Handover",
      desc: "Replace paper logs with a simple shared spreadsheet or form for shift notes.",
      axis: "processes"
    }
  ],
  byAxis: {
    processes: [
      { title: "Visual Management Board", desc: "Install a simple whiteboard tracking hourly output vs target." },
      { title: "Shadowing Session", desc: "Have IT shadow Ops for one day to spot friction points." }
    ],
    dataManagement: [
      { title: "KPI Dictionary", desc: "Define exactly how top 5 KPIs are calculated to ensure alignment." },
      { title: "Kill Unused Reports", desc: "Stop generating reports that no one has opened in 3 months." }
    ],
    culture: [
      { title: "Fail-Fast Award", desc: "Celebrate a failed experiment to encourage risk-taking." },
      { title: "Digital Tip of the Week", desc: "Share one simple tech tip in the company newsletter." }
    ],
    digitalProducts: [
      { title: "Customer Interview Sprint", desc: "Talk to 5 customers specifically about their digital needs." }
    ],
    businessModels: [
      { title: "Competitor Digital Audit", desc: "Analyze the digital services of 3 main competitors." }
    ],
    aiMaturity: [
      { title: "AI Policy Draft", desc: "Create a simple 1-page guideline on using ChatGPT securely." }
    ]
  }
};

// 3. MATURITY INTERPRETATIONS
export const maturityInterpretations: Record<AxisId, { low: string; medium: string; high: string }> = {
  processes: {
    low: "Processes are largely ad-hoc, dependent on individual heroics, and lack documentation.",
    medium: "Standard processes exist but execution varies. Some digital tools are used in isolation.",
    high: "Processes are standardized, digitally orchestrated, and continuously optimized."
  },
  digitalProducts: {
    low: "Products are purely physical with no digital overlay or connectivity.",
    medium: "Basic digital extensions exist (e.g., app, portal) but are not core to value.",
    high: "Smart, connected products generate data and recurring revenue streams."
  },
  businessModels: {
    low: "Traditional transactional sales model (CAPEX) with no ecosystem integration.",
    medium: "Experimenting with services or subscriptions, but revenue is still mainly hardware.",
    high: "Platform-based or Outcome-as-a-Service models are a significant revenue driver."
  },
  dataManagement: {
    low: "Data is siloed in spreadsheets, quality is poor, and ownership is undefined.",
    medium: "Core systems (ERP) are in place, but data integration and BI are fragmented.",
    high: "Single source of truth exists. Data is democratized and powers predictive decisions."
  },
  culture: {
    low: "Digital is seen as an IT topic. Resistance to change is high.",
    medium: "Awareness of digital importance exists, but skills and agility are lacking.",
    high: "Digital-first mindset is embedded. Experimentation and continuous learning are norms."
  },
  cybersecurity: {
    low: "Basic security measures only. No formal security policies or proactive monitoring.",
    medium: "Security policies exist with partial implementation. Some automated monitoring.",
    high: "Zero trust architecture, continuous monitoring, and security integrated into DevSecOps."
  },
  aiMaturity: {
    low: "No AI usage or awareness. Processes are manual and reactive.",
    medium: "Ad-hoc pilots or isolated use cases (e.g., basic chatbots) exist.",
    high: "AI is scaled across value chain, driving automation and strategic advantage."
  }
};
