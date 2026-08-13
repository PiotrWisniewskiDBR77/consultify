/**
 * Demo Organization Seed Script
 *
 * Creates a complete demo organization "Acme Digital Corp" with:
 * - 3 Projects (different phases)
 * - 18+ Initiatives (various statuses)
 * - 50+ Tasks
 * - Multiple Assessments (DRD, SIRI)
 * - Benefits tracking
 * - Team members
 * - Documents
 *
 * Run: node server/seed/seed_demo_organization.js
 */

import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path - use consultinity.db which is the actual database used by server
const dbPath = path.join(__dirname, '../consultinity.db');
const db = new sqlite3.Database(dbPath);

// Promise wrapper for db.run
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Promise wrapper for db.all
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// ==========================================
// MULTILINGUAL HELPERS
// ==========================================

/**
 * Creates multilingual text object for all supported languages
 * @param {Object} translations - Object with translations: {pl: '...', en: '...', de: '...', es: '...', ar: '...', ja: '...'}
 * @returns {string} JSON string with translations
 */
const createMultilingualText = (translations) => {
  return JSON.stringify({
    pl: translations.pl || translations.en || '',
    en: translations.en || '',
    de: translations.de || translations.en || '',
    es: translations.es || translations.en || '',
    ar: translations.ar || translations.en || '',
    ja: translations.ja || translations.en || '',
  });
};

// ==========================================
// CONSTANTS
// ==========================================

const DEMO_ORG_ID = 'org-demo-acme-global';
const DEMO_ORG_NAME = {
  pl: 'Acme Digital Corp',
  en: 'Acme Digital Corp',
  de: 'Acme Digital Corp',
  es: 'Acme Digital Corp',
  ar: 'شركة أكمي الرقمية',
  ja: 'アックミー・デジタル・コーポレーション',
};

// Demo Users
const DEMO_USERS = [
  {
    id: 'demo-user-ceo',
    email: 'anna.kowalska@acme-demo.com',
    firstName: 'Anna',
    lastName: 'Kowalska',
    role: 'ADMIN',
    title: 'CEO',
  },
  {
    id: 'demo-user-cto',
    email: 'tomasz.nowak@acme-demo.com',
    firstName: 'Tomasz',
    lastName: 'Nowak',
    role: 'ADMIN',
    title: 'CTO',
  },
  {
    id: 'demo-user-cfo',
    email: 'maria.wisniewska@acme-demo.com',
    firstName: 'Maria',
    lastName: 'Wiśniewska',
    role: 'ADMIN',
    title: 'CFO',
  },
  {
    id: 'demo-user-pm1',
    email: 'jan.kowalczyk@acme-demo.com',
    firstName: 'Jan',
    lastName: 'Kowalczyk',
    role: 'USER',
    title: 'Project Manager',
  },
  {
    id: 'demo-user-pm2',
    email: 'ewa.nowicka@acme-demo.com',
    firstName: 'Ewa',
    lastName: 'Nowicka',
    role: 'USER',
    title: 'Senior PM',
  },
  {
    id: 'demo-user-analyst',
    email: 'piotr.lewandowski@acme-demo.com',
    firstName: 'Piotr',
    lastName: 'Lewandowski',
    role: 'USER',
    title: 'Business Analyst',
  },
  {
    id: 'demo-user-dev1',
    email: 'karolina.mazur@acme-demo.com',
    firstName: 'Karolina',
    lastName: 'Mazur',
    role: 'USER',
    title: 'Tech Lead',
  },
  {
    id: 'demo-user-dev2',
    email: 'michal.wojcik@acme-demo.com',
    firstName: 'Michał',
    lastName: 'Wójcik',
    role: 'USER',
    title: 'Senior Developer',
  },
];

// Demo Projects (Multilingual)
const DEMO_PROJECTS = [
  {
    id: 'demo-proj-transform',
    name: createMultilingualText({
      pl: 'Transformacja Cyfrowa 2025',
      en: 'Digital Transformation 2025',
      de: 'Digitale Transformation 2025',
      es: 'Transformación Digital 2025',
      ar: 'التحول الرقمي 2025',
      ja: 'デジタル変革2025',
    }),
    description: createMultilingualText({
      pl: 'Kompleksowy program modernizacji systemów IT i procesów biznesowych firmy Acme Digital Corp. Obejmuje migrację do chmury, wdrożenie AI i automatyzację procesów.',
      en: 'Comprehensive IT systems modernization and business processes program for Acme Digital Corp. Includes cloud migration, AI implementation, and process automation.',
      de: 'Umfassendes Programm zur Modernisierung von IT-Systemen und Geschäftsprozessen für Acme Digital Corp. Umfasst Cloud-Migration, KI-Implementierung und Prozessautomatisierung.',
      es: 'Programa integral de modernización de sistemas TI y procesos empresariales para Acme Digital Corp. Incluye migración a la nube, implementación de IA y automatización de procesos.',
      ar: 'برنامج شامل لتحديث أنظمة تكنولوجيا المعلومات والعمليات التجارية لشركة أكمي الرقمية. يشمل الهجرة إلى السحابة وتنفيذ الذكاء الاصطناعي وأتمتة العمليات.',
      ja: 'アックミー・デジタル・コーポレーションのITシステムとビジネスプロセスの包括的な近代化プログラム。クラウド移行、AI実装、プロセス自動化を含む。',
    }),
    status: 'EXECUTING',
    phase: 'execution',
    progress: 65,
    startDate: '2025-01-01',
    targetDate: '2025-12-31',
    budget: 2500000,
    sponsor: 'demo-user-ceo',
    manager: 'demo-user-pm1',
  },
  {
    id: 'demo-proj-ai-hub',
    name: createMultilingualText({
      pl: 'AI Operations Hub',
      en: 'AI Operations Hub',
      de: 'KI-Betriebszentrum',
      es: 'Centro de Operaciones de IA',
      ar: 'مركز عمليات الذكاء الاصطناعي',
      ja: 'AI運用ハブ',
    }),
    description: createMultilingualText({
      pl: 'Wdrożenie centralnej platformy AI do automatyzacji operacji i wsparcia decyzji biznesowych. Projekt pilotażowy przed skalowaniem na całą organizację.',
      en: 'Implementation of a central AI platform for operations automation and business decision support. Pilot project before scaling to the entire organization.',
      de: 'Implementierung einer zentralen KI-Plattform zur Automatisierung von Betriebsabläufen und Unterstützung von Geschäftsentscheidungen. Pilotprojekt vor der Skalierung auf die gesamte Organisation.',
      es: 'Implementación de una plataforma central de IA para automatización de operaciones y apoyo a decisiones empresariales. Proyecto piloto antes de escalar a toda la organización.',
      ar: 'تنفيذ منصة ذكاء اصطناعي مركزية لأتمتة العمليات ودعم القرارات التجارية. مشروع تجريبي قبل التوسع إلى المنظمة بأكملها.',
      ja: '運用自動化とビジネス意思決定支援のための中央AIプラットフォームの実装。組織全体へのスケーリング前のパイロットプロジェクト。',
    }),
    status: 'PLANNING',
    phase: 'planning',
    progress: 25,
    startDate: '2025-03-01',
    targetDate: '2026-06-30',
    budget: 1800000,
    sponsor: 'demo-user-cto',
    manager: 'demo-user-pm2',
  },
  {
    id: 'demo-proj-legacy',
    name: createMultilingualText({
      pl: 'Modernizacja Systemów Legacy',
      en: 'Legacy System Modernization',
      de: 'Modernisierung von Legacy-Systemen',
      es: 'Modernización de Sistemas Legacy',
      ar: 'تحديث الأنظمة القديمة',
      ja: 'レガシーシステムの近代化',
    }),
    description: createMultilingualText({
      pl: 'Projekt zakończony z sukcesem. Modernizacja przestarzałych systemów ERP i CRM, migracja danych i integracja z nowoczesnymi rozwiązaniami.',
      en: 'Successfully completed project. Modernization of outdated ERP and CRM systems, data migration, and integration with modern solutions.',
      de: 'Erfolgreich abgeschlossenes Projekt. Modernisierung veralteter ERP- und CRM-Systeme, Datenmigration und Integration mit modernen Lösungen.',
      es: 'Proyecto completado con éxito. Modernización de sistemas ERP y CRM obsoletos, migración de datos e integración con soluciones modernas.',
      ar: 'مشروع مكتمل بنجاح. تحديث أنظمة تخطيط موارد المؤسسات وإدارة علاقات العملاء القديمة، وهجرة البيانات، والتكامل مع الحلول الحديثة.',
      ja: '成功裏に完了したプロジェクト。時代遅れのERPおよびCRMシステムの近代化、データ移行、最新ソリューションとの統合。',
    }),
    status: 'COMPLETED',
    phase: 'completed',
    progress: 100,
    startDate: '2024-01-01',
    targetDate: '2024-12-31',
    budget: 1200000,
    sponsor: 'demo-user-cfo',
    manager: 'demo-user-pm1',
  },
];

// Helper function to create multilingual initiative
const createInitiative = (base, translations) => ({
  ...base,
  name: createMultilingualText(translations.name),
  description: createMultilingualText(translations.description),
});

// Helper function to create multilingual task
const createTask = (base, translations) => ({
  ...base,
  title: createMultilingualText(translations.title),
});

// Demo Initiatives (Multilingual)
const DEMO_INITIATIVES = [
  // Project 1: Transformacja Cyfrowa
  createInitiative(
    {
      id: 'demo-init-rpa',
      projectId: 'demo-proj-transform',
      status: 'EXECUTING',
      progress: 75,
      businessValue: 450000,
      costCapex: 120000,
      costOpex: 35000,
      expectedRoi: 220,
      priority: 'HIGH',
      owner: 'demo-user-pm1',
      valueDriver: 'Cost Reduction',
    },
    {
      name: {
        pl: 'Automatyzacja procesów z RPA',
        en: 'RPA Process Automation',
        de: 'RPA-Prozessautomatisierung',
        es: 'Automatización de Procesos con RPA',
        ar: 'أتمتة العمليات باستخدام RPA',
        ja: 'RPAプロセス自動化',
      },
      description: {
        pl: 'Wdrożenie robotów procesowych (RPA) do automatyzacji powtarzalnych zadań w działach finansów, HR i operacji.',
        en: 'Implementation of robotic process automation (RPA) to automate repetitive tasks in finance, HR, and operations departments.',
        de: 'Implementierung von Robotic Process Automation (RPA) zur Automatisierung wiederholbarer Aufgaben in den Bereichen Finanzen, Personalwesen und Betrieb.',
        es: 'Implementación de automatización robótica de procesos (RPA) para automatizar tareas repetitivas en los departamentos de finanzas, RRHH y operaciones.',
        ar: 'تنفيذ أتمتة العمليات الروبوتية (RPA) لأتمتة المهام المتكررة في أقسام المالية والموارد البشرية والعمليات.',
        ja: '財務、人事、運用部門の反復的なタスクを自動化するためのロボティック・プロセス・オートメーション（RPA）の実装。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-cloud',
      projectId: 'demo-proj-transform',
      status: 'EXECUTING',
      progress: 60,
      businessValue: 380000,
      costCapex: 200000,
      costOpex: 80000,
      expectedRoi: 140,
      priority: 'HIGH',
      owner: 'demo-user-dev1',
      valueDriver: 'Scalability',
    },
    {
      name: {
        pl: 'Migracja do chmury AWS',
        en: 'AWS Cloud Migration',
        de: 'AWS-Cloud-Migration',
        es: 'Migración a la Nube AWS',
        ar: 'الهجرة إلى سحابة AWS',
        ja: 'AWSクラウド移行',
      },
      description: {
        pl: 'Przeniesienie infrastruktury IT do Amazon Web Services z wykorzystaniem podejścia lift-and-shift oraz modernizacji.',
        en: 'Moving IT infrastructure to Amazon Web Services using lift-and-shift and modernization approaches.',
        de: 'Verlagerung der IT-Infrastruktur zu Amazon Web Services mit Lift-and-Shift- und Modernisierungsansätzen.',
        es: 'Traslado de la infraestructura TI a Amazon Web Services utilizando enfoques de lift-and-shift y modernización.',
        ar: 'نقل البنية التحتية لتكنولوجيا المعلومات إلى Amazon Web Services باستخدام نهج الرفع والتحويل والتحديث.',
        ja: 'リフト・アンド・シフトおよび近代化アプローチを使用して、ITインフラストラクチャをAmazon Web Servicesに移行。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-data-lake',
      projectId: 'demo-proj-transform',
      status: 'EXECUTING',
      progress: 45,
      businessValue: 520000,
      costCapex: 280000,
      costOpex: 60000,
      expectedRoi: 160,
      priority: 'MEDIUM',
      owner: 'demo-user-analyst',
      valueDriver: 'Data-Driven Decisions',
    },
    {
      name: {
        pl: 'Platforma Data Lake Analytics',
        en: 'Data Lake Analytics Platform',
        de: 'Data Lake Analytics-Plattform',
        es: 'Plataforma de Análisis de Data Lake',
        ar: 'منصة تحليل بحيرة البيانات',
        ja: 'データレイク分析プラットフォーム',
      },
      description: {
        pl: 'Budowa centralnego repozytorium danych z możliwościami zaawansowanej analityki i machine learning.',
        en: 'Building a central data repository with advanced analytics and machine learning capabilities.',
        de: 'Aufbau eines zentralen Datenrepositoriums mit erweiterten Analyse- und Machine-Learning-Funktionen.',
        es: 'Construcción de un repositorio de datos central con capacidades avanzadas de análisis y aprendizaje automático.',
        ar: 'بناء مستودع بيانات مركزي بإمكانيات تحليل متقدمة وتعلم الآلة.',
        ja: '高度な分析と機械学習機能を備えた中央データリポジトリの構築。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-security',
      projectId: 'demo-proj-transform',
      status: 'PLANNING',
      progress: 20,
      businessValue: 200000,
      costCapex: 150000,
      costOpex: 40000,
      expectedRoi: 80,
      priority: 'HIGH',
      owner: 'demo-user-cto',
      valueDriver: 'Risk Reduction',
    },
    {
      name: {
        pl: 'Framework Bezpieczeństwa Zero Trust',
        en: 'Zero Trust Security Framework',
        de: 'Zero-Trust-Sicherheitsframework',
        es: 'Marco de Seguridad Zero Trust',
        ar: 'إطار أمان Zero Trust',
        ja: 'ゼロトラストセキュリティフレームワーク',
      },
      description: {
        pl: 'Implementacja nowoczesnego modelu bezpieczeństwa Zero Trust z MFA, SASE i ciągłym monitoringiem.',
        en: 'Implementation of a modern Zero Trust security model with MFA, SASE, and continuous monitoring.',
        de: 'Implementierung eines modernen Zero-Trust-Sicherheitsmodells mit MFA, SASE und kontinuierlicher Überwachung.',
        es: 'Implementación de un modelo de seguridad Zero Trust moderno con MFA, SASE y monitoreo continuo.',
        ar: 'تنفيذ نموذج أمان Zero Trust حديث مع المصادقة متعددة العوامل وSASE والمراقبة المستمرة.',
        ja: 'MFA、SASE、継続的な監視を備えた最新のゼロトラストセキュリティモデルの実装。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-dx-culture',
      projectId: 'demo-proj-transform',
      status: 'EXECUTING',
      progress: 55,
      businessValue: 180000,
      costCapex: 80000,
      costOpex: 50000,
      expectedRoi: 90,
      priority: 'MEDIUM',
      owner: 'demo-user-pm2',
      valueDriver: 'Employee Productivity',
    },
    {
      name: {
        pl: 'Kultura Cyfrowa i Zarządzanie Zmianą',
        en: 'Digital Culture & Change Management',
        de: 'Digitale Kultur & Veränderungsmanagement',
        es: 'Cultura Digital y Gestión del Cambio',
        ar: 'الثقافة الرقمية وإدارة التغيير',
        ja: 'デジタル文化とチェンジマネジメント',
      },
      description: {
        pl: 'Program zmiany kultury organizacyjnej, szkolenia pracowników i budowy kompetencji cyfrowych.',
        en: 'Organizational culture change program, employee training, and building digital competencies.',
        de: 'Programm zur Veränderung der Organisationskultur, Mitarbeiterschulung und Aufbau digitaler Kompetenzen.',
        es: 'Programa de cambio de cultura organizacional, capacitación de empleados y construcción de competencias digitales.',
        ar: 'برنامج تغيير الثقافة التنظيمية وتدريب الموظفين وبناء الكفاءات الرقمية.',
        ja: '組織文化の変革プログラム、従業員研修、デジタル能力の構築。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-api',
      projectId: 'demo-proj-transform',
      status: 'COMPLETED',
      progress: 100,
      businessValue: 320000,
      costCapex: 100000,
      costOpex: 25000,
      expectedRoi: 220,
      priority: 'HIGH',
      owner: 'demo-user-dev1',
      valueDriver: 'Integration Efficiency',
    },
    {
      name: {
        pl: 'API Gateway i Platforma Integracyjna',
        en: 'API Gateway & Integration Platform',
        de: 'API-Gateway & Integrationsplattform',
        es: 'API Gateway y Plataforma de Integración',
        ar: 'بوابة API ومنصة التكامل',
        ja: 'APIゲートウェイと統合プラットフォーム',
      },
      description: {
        pl: 'Wdrożenie centralnej platformy integracyjnej opartej na API Gateway i Event Bus.',
        en: 'Implementation of a central integration platform based on API Gateway and Event Bus.',
        de: 'Implementierung einer zentralen Integrationsplattform basierend auf API-Gateway und Event Bus.',
        es: 'Implementación de una plataforma de integración central basada en API Gateway y Event Bus.',
        ar: 'تنفيذ منصة تكامل مركزية تعتمد على بوابة API وناقل الأحداث.',
        ja: 'APIゲートウェイとイベントバスに基づく中央統合プラットフォームの実装。',
      },
    }
  ),

  // Project 2: AI Operations Hub
  createInitiative(
    {
      id: 'demo-init-ai-predict',
      projectId: 'demo-proj-ai-hub',
      status: 'PLANNING',
      progress: 15,
      businessValue: 680000,
      costCapex: 350000,
      costOpex: 80000,
      expectedRoi: 180,
      priority: 'HIGH',
      owner: 'demo-user-cto',
      valueDriver: 'Operational Excellence',
    },
    {
      name: {
        pl: 'AI Predykcyjne Utrzymanie',
        en: 'Predictive Maintenance AI',
        de: 'KI für vorausschauende Wartung',
        es: 'IA de Mantenimiento Predictivo',
        ar: 'ذكاء اصطناعي للصيانة التنبؤية',
        ja: '予測メンテナンスAI',
      },
      description: {
        pl: 'System AI do przewidywania awarii maszyn produkcyjnych na podstawie danych z IoT.',
        en: 'AI system for predicting production machine failures based on IoT data.',
        de: 'KI-System zur Vorhersage von Produktionsmaschinenausfällen basierend auf IoT-Daten.',
        es: 'Sistema de IA para predecir fallos de máquinas de producción basado en datos de IoT.',
        ar: 'نظام ذكاء اصطناعي للتنبؤ بأعطال آلات الإنتاج بناءً على بيانات إنترنت الأشياء.',
        ja: 'IoTデータに基づいて生産機械の故障を予測するAIシステム。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-ai-chatbot',
      projectId: 'demo-proj-ai-hub',
      status: 'PLANNING',
      progress: 30,
      businessValue: 420000,
      costCapex: 180000,
      costOpex: 45000,
      expectedRoi: 190,
      priority: 'MEDIUM',
      owner: 'demo-user-analyst',
      valueDriver: 'Customer Experience',
    },
    {
      name: {
        pl: 'Chatbot Obsługi Klienta AI',
        en: 'AI Customer Service Chatbot',
        de: 'KI-Chatbot für Kundenservice',
        es: 'Chatbot de Atención al Cliente con IA',
        ar: 'روبوت محادثة خدمة العملاء بالذكاء الاصطناعي',
        ja: 'AIカスタマーサービスチャットボット',
      },
      description: {
        pl: 'Wdrożenie inteligentnego chatbota do obsługi klienta z wykorzystaniem NLP i RAG.',
        en: 'Implementation of an intelligent chatbot for customer service using NLP and RAG.',
        de: 'Implementierung eines intelligenten Chatbots für den Kundenservice mit NLP und RAG.',
        es: 'Implementación de un chatbot inteligente para atención al cliente utilizando NLP y RAG.',
        ar: 'تنفيذ روبوت محادثة ذكي لخدمة العملاء باستخدام معالجة اللغة الطبيعية وRAG.',
        ja: 'NLPとRAGを活用したカスタマーサービス用のインテリジェントチャットボットの実装。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-ai-demand',
      projectId: 'demo-proj-ai-hub',
      status: 'IDEA',
      progress: 5,
      businessValue: 550000,
      costCapex: 220000,
      costOpex: 50000,
      expectedRoi: 200,
      priority: 'MEDIUM',
      owner: 'demo-user-cfo',
      valueDriver: 'Supply Chain Optimization',
    },
    {
      name: {
        pl: 'Prognozowanie Popytu AI',
        en: 'AI Demand Forecasting',
        de: 'KI-Nachfrageprognose',
        es: 'Pronóstico de Demanda con IA',
        ar: 'التنبؤ بالطلب بالذكاء الاصطناعي',
        ja: 'AI需要予測',
      },
      description: {
        pl: 'System prognozowania popytu z wykorzystaniem ML do optymalizacji łańcucha dostaw.',
        en: 'Demand forecasting system using ML to optimize the supply chain.',
        de: 'Nachfrageprognosesystem mit ML zur Optimierung der Lieferkette.',
        es: 'Sistema de pronóstico de demanda utilizando ML para optimizar la cadena de suministro.',
        ar: 'نظام التنبؤ بالطلب باستخدام التعلم الآلي لتحسين سلسلة التوريد.',
        ja: 'サプライチェーンを最適化するための機械学習を使用した需要予測システム。',
      },
    }
  ),

  // Project 3: Legacy Modernization (Completed)
  createInitiative(
    {
      id: 'demo-init-erp',
      projectId: 'demo-proj-legacy',
      status: 'COMPLETED',
      progress: 100,
      businessValue: 480000,
      costCapex: 400000,
      costOpex: 120000,
      expectedRoi: 85,
      priority: 'HIGH',
      owner: 'demo-user-pm1',
      valueDriver: 'Process Efficiency',
    },
    {
      name: {
        pl: 'Migracja Systemu ERP',
        en: 'ERP System Migration',
        de: 'ERP-Systemmigration',
        es: 'Migración del Sistema ERP',
        ar: 'هجرة نظام تخطيط موارد المؤسسات',
        ja: 'ERPシステム移行',
      },
      description: {
        pl: 'Migracja z przestarzałego systemu ERP do SAP S/4HANA Cloud.',
        en: 'Migration from outdated ERP system to SAP S/4HANA Cloud.',
        de: 'Migration vom veralteten ERP-System zu SAP S/4HANA Cloud.',
        es: 'Migración del sistema ERP obsoleto a SAP S/4HANA Cloud.',
        ar: 'الهجرة من نظام تخطيط موارد المؤسسات القديم إلى SAP S/4HANA Cloud.',
        ja: '時代遅れのERPシステムからSAP S/4HANA Cloudへの移行。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-crm',
      projectId: 'demo-proj-legacy',
      status: 'COMPLETED',
      progress: 100,
      businessValue: 350000,
      costCapex: 180000,
      costOpex: 60000,
      expectedRoi: 150,
      priority: 'HIGH',
      owner: 'demo-user-pm2',
      valueDriver: 'Sales Effectiveness',
    },
    {
      name: {
        pl: 'Modernizacja CRM (Salesforce)',
        en: 'CRM Modernization (Salesforce)',
        de: 'CRM-Modernisierung (Salesforce)',
        es: 'Modernización CRM (Salesforce)',
        ar: 'تحديث إدارة علاقات العملاء (Salesforce)',
        ja: 'CRM近代化（Salesforce）',
      },
      description: {
        pl: 'Wdrożenie Salesforce jako centralnego systemu zarządzania relacjami z klientami.',
        en: 'Implementation of Salesforce as the central customer relationship management system.',
        de: 'Implementierung von Salesforce als zentrales Customer-Relationship-Management-System.',
        es: 'Implementación de Salesforce como sistema central de gestión de relaciones con clientes.',
        ar: 'تنفيذ Salesforce كنظام مركزي لإدارة علاقات العملاء.',
        ja: '顧客関係管理の中央システムとしてSalesforceの実装。',
      },
    }
  ),
  createInitiative(
    {
      id: 'demo-init-data-migration',
      projectId: 'demo-proj-legacy',
      status: 'COMPLETED',
      progress: 100,
      businessValue: 150000,
      costCapex: 80000,
      costOpex: 20000,
      expectedRoi: 75,
      priority: 'MEDIUM',
      owner: 'demo-user-analyst',
      valueDriver: 'Data Quality',
    },
    {
      name: {
        pl: 'Migracja i Oczyszczenie Danych',
        en: 'Data Migration & Cleansing',
        de: 'Datenmigration & -bereinigung',
        es: 'Migración y Limpieza de Datos',
        ar: 'هجرة وتنظيف البيانات',
        ja: 'データ移行とクレンジング',
      },
      description: {
        pl: 'Migracja i oczyszczenie danych z systemów legacy do nowych platform.',
        en: 'Migration and cleansing of data from legacy systems to new platforms.',
        de: 'Migration und Bereinigung von Daten aus Legacy-Systemen zu neuen Plattformen.',
        es: 'Migración y limpieza de datos de sistemas legacy a nuevas plataformas.',
        ar: 'هجرة وتنظيف البيانات من الأنظمة القديمة إلى المنصات الجديدة.',
        ja: 'レガシーシステムから新しいプラットフォームへのデータ移行とクレンジング。',
      },
    }
  ),
];

// Demo Tasks (Multilingual)
const DEMO_TASKS = [
  // RPA Initiative Tasks
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-rpa',
      projectId: 'demo-proj-transform',
      status: 'COMPLETED',
      priority: 'HIGH',
      assignee: 'demo-user-analyst',
      dueDate: '2025-01-15',
    },
    {
      title: {
        pl: 'Analiza procesów do automatyzacji',
        en: 'Process Analysis for Automation',
        de: 'Prozessanalyse für Automatisierung',
        es: 'Análisis de Procesos para Automatización',
        ar: 'تحليل العمليات للأتمتة',
        ja: '自動化のためのプロセス分析',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-rpa',
      projectId: 'demo-proj-transform',
      status: 'COMPLETED',
      priority: 'HIGH',
      assignee: 'demo-user-dev1',
      dueDate: '2025-01-30',
    },
    {
      title: {
        pl: 'Wybór platformy RPA (UiPath vs Automation Anywhere)',
        en: 'RPA Platform Selection (UiPath vs Automation Anywhere)',
        de: 'RPA-Plattformauswahl (UiPath vs Automation Anywhere)',
        es: 'Selección de Plataforma RPA (UiPath vs Automation Anywhere)',
        ar: 'اختيار منصة RPA (UiPath مقابل Automation Anywhere)',
        ja: 'RPAプラットフォームの選択（UiPath vs Automation Anywhere）',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-rpa',
      projectId: 'demo-proj-transform',
      status: 'COMPLETED',
      priority: 'HIGH',
      assignee: 'demo-user-dev2',
      dueDate: '2025-02-28',
    },
    {
      title: {
        pl: 'Wdrożenie pilotażowe - 5 procesów HR',
        en: 'Pilot Implementation - 5 HR Processes',
        de: 'Pilotimplementierung - 5 HR-Prozesse',
        es: 'Implementación Piloto - 5 Procesos de RRHH',
        ar: 'التنفيذ التجريبي - 5 عمليات موارد بشرية',
        ja: 'パイロット実装 - 5つのHRプロセス',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-rpa',
      projectId: 'demo-proj-transform',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignee: 'demo-user-pm1',
      dueDate: '2025-04-30',
    },
    {
      title: {
        pl: 'Rollout - automatyzacja 20 procesów finansowych',
        en: 'Rollout - Automation of 20 Finance Processes',
        de: 'Rollout - Automatisierung von 20 Finanzprozessen',
        es: 'Lanzamiento - Automatización de 20 Procesos Financieros',
        ar: 'النشر - أتمتة 20 عملية مالية',
        ja: 'ロールアウト - 20の財務プロセスの自動化',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-rpa',
      projectId: 'demo-proj-transform',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assignee: 'demo-user-analyst',
      dueDate: '2025-03-31',
    },
    {
      title: {
        pl: 'Szkolenie zespołu z obsługi RPA',
        en: 'Team Training on RPA Operations',
        de: 'Team-Schulung zu RPA-Betrieb',
        es: 'Capacitación del Equipo en Operaciones RPA',
        ar: 'تدريب الفريق على عمليات RPA',
        ja: 'RPA運用に関するチーム研修',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-rpa',
      projectId: 'demo-proj-transform',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee: 'demo-user-dev2',
      dueDate: '2025-05-31',
    },
    {
      title: {
        pl: 'Monitoring i optymalizacja botów',
        en: 'Bot Monitoring and Optimization',
        de: 'Bot-Überwachung und -Optimierung',
        es: 'Monitoreo y Optimización de Bots',
        ar: 'مراقبة وتحسين الروبوتات',
        ja: 'ボットの監視と最適化',
      },
    }
  ),

  // Cloud Migration Tasks
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-cloud',
      projectId: 'demo-proj-transform',
      status: 'COMPLETED',
      priority: 'HIGH',
      assignee: 'demo-user-dev1',
      dueDate: '2025-01-20',
    },
    {
      title: {
        pl: 'Audyt infrastruktury on-premise',
        en: 'On-Premise Infrastructure Audit',
        de: 'On-Premise-Infrastruktur-Audit',
        es: 'Auditoría de Infraestructura On-Premise',
        ar: 'تدقيق البنية التحتية المحلية',
        ja: 'オンプレミスインフラの監査',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-cloud',
      projectId: 'demo-proj-transform',
      status: 'COMPLETED',
      priority: 'HIGH',
      assignee: 'demo-user-dev1',
      dueDate: '2025-02-15',
    },
    {
      title: {
        pl: 'Projekt architektury AWS',
        en: 'AWS Architecture Design',
        de: 'AWS-Architekturdesign',
        es: 'Diseño de Arquitectura AWS',
        ar: 'تصميم بنية AWS',
        ja: 'AWSアーキテクチャ設計',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-cloud',
      projectId: 'demo-proj-transform',
      status: 'COMPLETED',
      priority: 'HIGH',
      assignee: 'demo-user-dev2',
      dueDate: '2025-03-01',
    },
    {
      title: {
        pl: 'Migracja środowiska DEV',
        en: 'DEV Environment Migration',
        de: 'DEV-Umgebungsmigration',
        es: 'Migración del Entorno DEV',
        ar: 'هجرة بيئة التطوير',
        ja: 'DEV環境の移行',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-cloud',
      projectId: 'demo-proj-transform',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignee: 'demo-user-dev2',
      dueDate: '2025-04-15',
    },
    {
      title: {
        pl: 'Migracja środowiska UAT',
        en: 'UAT Environment Migration',
        de: 'UAT-Umgebungsmigration',
        es: 'Migración del Entorno UAT',
        ar: 'هجرة بيئة الاختبار',
        ja: 'UAT環境の移行',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-cloud',
      projectId: 'demo-proj-transform',
      status: 'TODO',
      priority: 'HIGH',
      assignee: 'demo-user-dev1',
      dueDate: '2025-05-30',
    },
    {
      title: {
        pl: 'Migracja PROD - faza 1',
        en: 'PROD Migration - Phase 1',
        de: 'PROD-Migration - Phase 1',
        es: 'Migración PROD - Fase 1',
        ar: 'هجرة الإنتاج - المرحلة 1',
        ja: 'PROD移行 - フェーズ1',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-cloud',
      projectId: 'demo-proj-transform',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee: 'demo-user-dev1',
      dueDate: '2025-06-30',
    },
    {
      title: {
        pl: 'Konfiguracja Disaster Recovery',
        en: 'Disaster Recovery Setup',
        de: 'Disaster-Recovery-Einrichtung',
        es: 'Configuración de Recuperación ante Desastres',
        ar: 'إعداد استعادة الكوارث',
        ja: '災害復旧の設定',
      },
    }
  ),

  // Data Lake Tasks
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-data-lake',
      projectId: 'demo-proj-transform',
      status: 'COMPLETED',
      priority: 'HIGH',
      assignee: 'demo-user-analyst',
      dueDate: '2025-02-01',
    },
    {
      title: {
        pl: 'Wybór technologii (Snowflake vs Databricks)',
        en: 'Technology Selection (Snowflake vs Databricks)',
        de: 'Technologieauswahl (Snowflake vs Databricks)',
        es: 'Selección de Tecnología (Snowflake vs Databricks)',
        ar: 'اختيار التكنولوجيا (Snowflake مقابل Databricks)',
        ja: 'テクノロジー選択（Snowflake vs Databricks）',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-data-lake',
      projectId: 'demo-proj-transform',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignee: 'demo-user-dev1',
      dueDate: '2025-04-30',
    },
    {
      title: {
        pl: 'Budowa Data Lake na AWS S3',
        en: 'Data Lake Build on AWS S3',
        de: 'Data Lake-Aufbau auf AWS S3',
        es: 'Construcción de Data Lake en AWS S3',
        ar: 'بناء بحيرة البيانات على AWS S3',
        ja: 'AWS S3でのデータレイク構築',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-data-lake',
      projectId: 'demo-proj-transform',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assignee: 'demo-user-analyst',
      dueDate: '2025-05-15',
    },
    {
      title: {
        pl: 'Integracja źródeł danych (ERP, CRM, IoT)',
        en: 'Data Sources Integration (ERP, CRM, IoT)',
        de: 'Datenquellenintegration (ERP, CRM, IoT)',
        es: 'Integración de Fuentes de Datos (ERP, CRM, IoT)',
        ar: 'تكامل مصادر البيانات (ERP, CRM, IoT)',
        ja: 'データソース統合（ERP、CRM、IoT）',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-data-lake',
      projectId: 'demo-proj-transform',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee: 'demo-user-analyst',
      dueDate: '2025-06-30',
    },
    {
      title: {
        pl: 'Budowa dashboardów analitycznych',
        en: 'Analytics Dashboards Build',
        de: 'Aufbau von Analyse-Dashboards',
        es: 'Construcción de Dashboards Analíticos',
        ar: 'بناء لوحات المعلومات التحليلية',
        ja: '分析ダッシュボードの構築',
      },
    }
  ),

  // AI Hub Tasks
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-ai-predict',
      projectId: 'demo-proj-ai-hub',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignee: 'demo-user-cto',
      dueDate: '2025-04-15',
    },
    {
      title: {
        pl: 'Analiza przypadków użycia AI',
        en: 'AI Use Cases Analysis',
        de: 'KI-Anwendungsfallanalyse',
        es: 'Análisis de Casos de Uso de IA',
        ar: 'تحليل حالات استخدام الذكاء الاصطناعي',
        ja: 'AIユースケース分析',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-ai-predict',
      projectId: 'demo-proj-ai-hub',
      status: 'TODO',
      priority: 'HIGH',
      assignee: 'demo-user-dev1',
      dueDate: '2025-06-30',
    },
    {
      title: {
        pl: 'Integracja z czujnikami IoT',
        en: 'IoT Sensors Integration',
        de: 'IoT-Sensorintegration',
        es: 'Integración con Sensores IoT',
        ar: 'التكامل مع أجهزة استشعار إنترنت الأشياء',
        ja: 'IoTセンサー統合',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-ai-chatbot',
      projectId: 'demo-proj-ai-hub',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assignee: 'demo-user-analyst',
      dueDate: '2025-04-30',
    },
    {
      title: {
        pl: 'Wybór platformy NLP (OpenAI vs Azure)',
        en: 'NLP Platform Selection (OpenAI vs Azure)',
        de: 'NLP-Plattformauswahl (OpenAI vs Azure)',
        es: 'Selección de Plataforma NLP (OpenAI vs Azure)',
        ar: 'اختيار منصة NLP (OpenAI مقابل Azure)',
        ja: 'NLPプラットフォーム選択（OpenAI vs Azure）',
      },
    }
  ),
  createTask(
    {
      id: uuidv4(),
      initiativeId: 'demo-init-ai-chatbot',
      projectId: 'demo-proj-ai-hub',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee: 'demo-user-analyst',
      dueDate: '2025-05-31',
    },
    {
      title: {
        pl: 'Przygotowanie bazy wiedzy',
        en: 'Knowledge Base Preparation',
        de: 'Wissensbasisvorbereitung',
        es: 'Preparación de Base de Conocimientos',
        ar: 'إعداد قاعدة المعرفة',
        ja: 'ナレッジベースの準備',
      },
    }
  ),
];

// Demo Assessments
const DEMO_ASSESSMENTS = [
  {
    id: 'demo-assess-drd-transform',
    projectId: 'demo-proj-transform',
    type: 'DRD',
    name: 'Digital Readiness Diagnosis - Q1 2025',
    status: 'COMPLETED',
    overallScore: 3.8,
    dimensions: {
      strategy: 4.2,
      processes: 3.5,
      technology: 3.8,
      people: 4.0,
      data: 3.6,
      culture: 3.9,
    },
    completedAt: '2025-01-15',
  },
  {
    id: 'demo-assess-siri-transform',
    projectId: 'demo-proj-transform',
    type: 'SIRI',
    name: 'Smart Industry Readiness Index',
    status: 'COMPLETED',
    overallScore: 2.9,
    dimensions: {
      operations: 3.2,
      supplyChain: 2.8,
      productLifecycle: 2.5,
      enterpriseSystem: 3.1,
    },
    completedAt: '2025-01-20',
  },
  {
    id: 'demo-assess-drd-ai',
    projectId: 'demo-proj-ai-hub',
    type: 'DRD',
    name: 'AI Readiness Assessment',
    status: 'IN_PROGRESS',
    overallScore: 2.4,
    dimensions: {
      strategy: 2.8,
      processes: 2.2,
      technology: 2.5,
      people: 2.1,
      data: 2.6,
    },
    completedAt: null,
  },
  {
    id: 'demo-assess-drd-legacy',
    projectId: 'demo-proj-legacy',
    type: 'DRD',
    name: 'Post-Migration Assessment',
    status: 'COMPLETED',
    overallScore: 4.2,
    dimensions: {
      strategy: 4.5,
      processes: 4.0,
      technology: 4.3,
      people: 4.1,
      data: 4.2,
    },
    completedAt: '2024-12-15',
  },
];

// Demo Benefits
const DEMO_BENEFITS = [
  {
    id: uuidv4(),
    initiativeId: 'demo-init-rpa',
    name: 'Redukcja FTE w operacjach',
    type: 'FINANCIAL',
    plannedValue: 280000,
    actualValue: 295000,
    status: 'REALIZED',
    category: 'Cost Savings',
  },
  {
    id: uuidv4(),
    initiativeId: 'demo-init-rpa',
    name: 'Skrócenie czasu procesów o 60%',
    type: 'OPERATIONAL',
    plannedValue: null,
    actualValue: null,
    status: 'REALIZED',
    category: 'Efficiency',
  },
  {
    id: uuidv4(),
    initiativeId: 'demo-init-rpa',
    name: 'Redukcja błędów o 95%',
    type: 'QUALITY',
    plannedValue: null,
    actualValue: null,
    status: 'IN_PROGRESS',
    category: 'Quality',
  },
  {
    id: uuidv4(),
    initiativeId: 'demo-init-cloud',
    name: 'Redukcja kosztów infrastruktury',
    type: 'FINANCIAL',
    plannedValue: 180000,
    actualValue: 165000,
    status: 'IN_PROGRESS',
    category: 'Cost Savings',
  },
  {
    id: uuidv4(),
    initiativeId: 'demo-init-cloud',
    name: 'Zwiększenie dostępności do 99.9%',
    type: 'OPERATIONAL',
    plannedValue: null,
    actualValue: null,
    status: 'TRACKING',
    category: 'Reliability',
  },
  {
    id: uuidv4(),
    initiativeId: 'demo-init-erp',
    name: 'Usprawnienie procesów finansowych',
    type: 'FINANCIAL',
    plannedValue: 320000,
    actualValue: 345000,
    status: 'REALIZED',
    category: 'Revenue',
  },
  {
    id: uuidv4(),
    initiativeId: 'demo-init-crm',
    name: 'Wzrost konwersji sprzedaży o 15%',
    type: 'FINANCIAL',
    plannedValue: 250000,
    actualValue: 280000,
    status: 'REALIZED',
    category: 'Revenue',
  },
];

// ==========================================
// SEED FUNCTIONS
// ==========================================

async function seedOrganization() {
  console.log('🏢 Creating demo organization...');

  await dbRun(
    `
        INSERT OR REPLACE INTO organizations (id, name, industry, plan, status, organization_type, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    [DEMO_ORG_ID, DEMO_ORG_NAME, 'Manufacturing & Technology', 'enterprise', 'active', 'DEMO', 1]
  );

  console.log('✅ Demo organization created');
}

async function seedUsers() {
  console.log('👥 Creating demo users...');

  const hashedPassword = await bcrypt.hash('demo123', 10);

  for (const user of DEMO_USERS) {
    await dbRun(
      `
            INSERT OR REPLACE INTO users (id, organization_id, email, password, first_name, last_name, role, status, title, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'))
        `,
      [
        user.id,
        DEMO_ORG_ID,
        user.email,
        hashedPassword,
        user.firstName,
        user.lastName,
        user.role,
        user.title,
      ]
    );
  }

  console.log(`✅ Created ${DEMO_USERS.length} demo users`);
}

async function seedProjects() {
  console.log('📁 Creating demo projects...');

  for (const project of DEMO_PROJECTS) {
    await dbRun(
      `
            INSERT OR REPLACE INTO projects (
                id, organization_id, name, description, status, phase, current_phase,
                start_date, end_date, budget, lead_id, owner_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
      [
        project.id,
        DEMO_ORG_ID,
        project.name,
        project.description,
        project.status,
        project.phase,
        project.phase,
        project.startDate,
        project.targetDate,
        project.budget,
        project.manager,
        project.sponsor,
      ]
    );
  }

  console.log(`✅ Created ${DEMO_PROJECTS.length} demo projects`);
}

async function seedInitiatives() {
  console.log('🚀 Creating demo initiatives...');

  // Map status to db values (canonical InitiativeStatus — SSOT:
  // server/src/constants/initiativeStatuses.ts). The legacy funnel vocabulary
  // ('step3'/'step4_pilot'/'step5_full') is rejected by initiatives_status_check.
  const statusMap = {
    IDEA: 'DRAFT',
    PLANNING: 'PLANNING',
    EXECUTING: 'EXECUTING',
    COMPLETED: 'DONE',
  };

  // Map priority to business_value
  const priorityMap = {
    HIGH: 'High',
    MEDIUM: 'Med',
    LOW: 'Low',
  };

  for (const init of DEMO_INITIATIVES) {
    await dbRun(
      `
            INSERT OR REPLACE INTO initiatives (
                id, organization_id, project_id, name, summary, problem_statement,
                status, current_stage, business_value, cost_capex, cost_opex,
                expected_roi, owner_business_id, owner_execution_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
      [
        init.id,
        DEMO_ORG_ID,
        init.projectId,
        init.name,
        init.description,
        `Problem: ${init.valueDriver} - ${init.description.substring(0, 100)}`,
        statusMap[init.status] || 'DRAFT',
        init.status.toLowerCase(),
        priorityMap[init.priority] || 'Med',
        init.costCapex,
        init.costOpex,
        init.expectedRoi,
        init.owner,
        init.owner,
      ]
    );
  }

  console.log(`✅ Created ${DEMO_INITIATIVES.length} demo initiatives`);
}

async function seedTasks() {
  console.log('📋 Creating demo tasks...');

  // Map status to db values
  const statusMap = {
    COMPLETED: 'done',
    IN_PROGRESS: 'in_progress',
    TODO: 'todo',
  };

  for (const task of DEMO_TASKS) {
    await dbRun(
      `
            INSERT OR REPLACE INTO tasks (
                id, organization_id, project_id, initiative_id, title,
                status, priority, assignee_id, due_date,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
      [
        task.id,
        DEMO_ORG_ID,
        task.projectId,
        task.initiativeId,
        task.title,
        statusMap[task.status] || 'todo',
        task.priority.toLowerCase(),
        task.assignee,
        task.dueDate,
      ]
    );
  }

  console.log(`✅ Created ${DEMO_TASKS.length} demo tasks`);
}

async function seedAssessments() {
  console.log('📊 Creating demo assessments...');

  // Create assessments table if not exists
  await dbRun(`
        CREATE TABLE IF NOT EXISTS assessments (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            project_id TEXT,
            type TEXT,
            name TEXT,
            status TEXT DEFAULT 'draft',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  for (const assess of DEMO_ASSESSMENTS) {
    // Main assessment record
    await dbRun(
      `
            INSERT OR REPLACE INTO assessments (
                id, organization_id, project_id, type, name, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
      [assess.id, DEMO_ORG_ID, assess.projectId, assess.type, assess.name, assess.status]
    );

    // Maturity assessment
    const isComplete = assess.status === 'COMPLETED' ? 1 : 0;
    await dbRun(
      `
            INSERT OR REPLACE INTO maturity_assessments (
                id, project_id, axis_scores, completed_axes,
                overall_as_is, overall_to_be, overall_gap,
                is_complete, assessment_status, finalized_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `,
      [
        assess.id,
        assess.projectId,
        JSON.stringify(assess.dimensions),
        JSON.stringify(Object.keys(assess.dimensions)),
        assess.overallScore,
        assess.overallScore + 1.0, // target is higher
        1.0, // gap
        isComplete,
        assess.status,
        isComplete ? assess.completedAt : null,
      ]
    );
  }

  console.log(`✅ Created ${DEMO_ASSESSMENTS.length} demo assessments`);
}

async function seedBenefits() {
  console.log('💰 Creating demo benefits...');

  // Create benefits table if not exists
  await dbRun(`
        CREATE TABLE IF NOT EXISTS benefits (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            initiative_id TEXT,
            name TEXT,
            type TEXT,
            planned_value REAL,
            actual_value REAL,
            status TEXT DEFAULT 'tracking',
            category TEXT,
            measurement_method TEXT,
            baseline_value REAL,
            target_value REAL,
            realization_date TEXT,
            owner_id TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  for (const benefit of DEMO_BENEFITS) {
    await dbRun(
      `
            INSERT OR REPLACE INTO benefits (
                id, organization_id, initiative_id, name, type,
                planned_value, actual_value, status, category,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
      [
        benefit.id,
        DEMO_ORG_ID,
        benefit.initiativeId,
        benefit.name,
        benefit.type,
        benefit.plannedValue,
        benefit.actualValue,
        benefit.status,
        benefit.category,
      ]
    );
  }

  console.log(`✅ Created ${DEMO_BENEFITS.length} demo benefits`);
}

async function seedUserPreferencesTable() {
  console.log('⚙️ Creating user_preferences table if not exists...');

  await dbRun(`
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id TEXT PRIMARY KEY,
            demo_mode_enabled INTEGER DEFAULT 0,
            theme TEXT DEFAULT 'dark',
            language TEXT DEFAULT 'en',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  console.log('✅ user_preferences table ready');
}

// ==========================================
// MAIN EXECUTION
// ==========================================

async function main() {
  console.log('\n🌟 ==========================================');
  console.log('   DEMO ORGANIZATION SEED SCRIPT');
  console.log('   Creating Acme Digital Corp');
  console.log('==========================================\n');

  try {
    await seedUserPreferencesTable();
    await seedOrganization();
    await seedUsers();
    await seedProjects();
    await seedInitiatives();
    await seedTasks();
    await seedAssessments();
    await seedBenefits();

    console.log('\n🎉 ==========================================');
    console.log('   DEMO DATA CREATED SUCCESSFULLY!');
    console.log('==========================================');
    console.log(`\n📊 Summary:`);
    console.log(`   - Organization: ${DEMO_ORG_NAME}`);
    console.log(`   - Users: ${DEMO_USERS.length}`);
    console.log(`   - Projects: ${DEMO_PROJECTS.length}`);
    console.log(`   - Initiatives: ${DEMO_INITIATIVES.length}`);
    console.log(`   - Tasks: ${DEMO_TASKS.length}`);
    console.log(`   - Assessments: ${DEMO_ASSESSMENTS.length}`);
    console.log(`   - Benefits: ${DEMO_BENEFITS.length}`);
    console.log('\n');
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
