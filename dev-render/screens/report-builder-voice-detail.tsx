/**
 * RB-1 v2 (Wpis 79, P2#1) — REALNY Report Builder w REALNEJ powłoce aplikacji.
 *
 * Wpis 76 montował sam `<SettingsPanel>` na pustym tle (brak Menu 1 / canvasu /
 * kebaba), więc zrzut nie pokazywał produktu. Ten harness montuje kompozycję
 * trasy `src/routes/AppRoutes.tsx:2701-2724`:
 *
 *   MainLayout(breadcrumbs: Materials › Report Builder) → ReportEditor
 *
 * z PRAWDZIWYM edytorem (canvas bloków + prawy pas `ArtifactRightPanel` →
 * zakładka Content → karta „Voice & Detail"). Fixturowana jest TYLKO granica
 * API: `Api.get('/report-builder/<id>')` oddaje jeden raport z trzema
 * wygenerowanymi sekcjami, `Api.getLinkGraphBacklinks` — pustą listę. Żaden
 * komponent nie jest reimplementowany.
 *
 * Karta „Voice & Detail" startuje zwinięta (`defaultOpen=false`), więc harness
 * wykonuje po montażu JEDEN prawdziwy klik w jej nagłówek — tę samą czynność,
 * którą wykonuje użytkownik.
 *
 * ?lang=en|pl &theme=light|dark
 */
import React, { useEffect } from 'react';

import { ReportEditor } from '../../src/components/ReportBuilder/ReportEditor/ReportEditor';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { MainLayout } from '../../src/layouts/MainLayout';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// Tożsamość demo po angielsku — powłoka (Menu 1, przełącznik organizacji,
// profil) musi czytać się w tym samym języku co zrzut.
useAppStore.setState({
  currentUser: {
    id: 'user-james',
    firstName: 'James',
    lastName: 'Whitfield',
    email: 'james.whitfield@northwind.example',
    companyName: 'Northwind Packaging',
    role: 'ADMIN',
    status: 'active',
    isAuthenticated: true,
    accessLevel: 'full',
    preferredLanguage: 'en',
    organizationId: 'org-northwind',
    organizationName: 'Northwind Packaging',
    isDemo: true,
  },
  currentOrganization: {
    id: 'org-northwind',
    name: 'Northwind Packaging',
    plan: 'enterprise',
    status: 'active',
    createdAt: '2025-03-02T09:00:00Z',
    userCount: 9,
  },
} as never);

const REPORT_ID = 'rb1-voice-detail';

const report = {
  id: REPORT_ID,
  title: 'Northwind Packaging — Digital Readiness Diagnosis',
  sourceType: 'ASSESSMENT',
  sourceId: 'assessment-northwind-drd-2026',
  sourceName: 'Northwind Packaging — DRD',
  templateId: 'tpl-drd-board-report-v2',
  version: 3,
  status: 'DRAFT',
  config: {
    language: 'en',
    intent: {
      audience: 'board',
      goal: 'investment_decision',
      language: 'en',
      tone: 'decisive',
      scope: 'full',
      verbosity: 'comprehensive',
      writingStyle: 'consultative',
      illustrationLevel: 'extensive',
      customTone: 'direct and data-driven',
    },
    styling: {
      theme: 'professional',
      primaryColor: '#85182F',
      accentColor: '#85182F',
      fontFamily: 'inter',
      showLogo: false,
      showBranding: true,
    },
  },
};

const sections = [
  {
    sectionKey: 'cover',
    sectionType: 'cover',
    title: 'Cover Page',
    length: 'short',
    language: 'business',
    enabled: true,
    orderIndex: 0,
    generatedAt: '2026-09-16T08:10:00.000Z',
    generationModel: 'narrative-engine-v3',
    // Realne wyjście LLM bywa ogrodzone ```json — przed naprawą (Wpis 88)
    // podgląd karty pokazywał ten surowy tekst zamiast strony tytułowej.
    generatedContent:
      '```json\n' +
      JSON.stringify(
        {
          title: 'Northwind Packaging — Digital Readiness Diagnosis',
          subtitle: 'Board decision pack',
          companyName: 'Northwind Packaging',
          date: '8 September 2026',
          assessmentType: 'DRD',
        },
        null,
        2
      ) +
      '\n```',
    blockConfig: {},
  },
  {
    sectionKey: 'exec_summary',
    sectionType: 'executive_summary',
    title: 'Executive summary',
    length: 'medium',
    language: 'business',
    enabled: true,
    orderIndex: 1,
    rag: 'amber',
    generatedAt: '2026-09-16T08:12:00.000Z',
    generationModel: 'narrative-engine-v3',
    generatedContent:
      'Northwind Packaging scores 3.4 of 7 on digital readiness. Two of seven axes are decision-ready; the integration workstream carries the largest gap.',
    blockConfig: {},
  },
  {
    sectionKey: 'roadmap_90d',
    sectionType: 'roadmap',
    title: '90-day roadmap',
    length: 'long',
    language: 'business',
    enabled: true,
    orderIndex: 2,
    generatedAt: '2026-09-16T08:14:00.000Z',
    generationModel: 'narrative-engine-v3',
    generatedContent:
      'Weeks one to four close the MES interface tests on Line 3; weeks five to eight move the predictive-maintenance model into production.',
    blockConfig: {},
  },
  {
    sectionKey: 'investment_case',
    sectionType: 'financial_analysis',
    title: 'Investment case',
    length: 'medium',
    language: 'business',
    enabled: true,
    orderIndex: 3,
    generatedAt: '2026-09-16T08:16:00.000Z',
    generationModel: 'narrative-engine-v3',
    generatedContent:
      'The programme needs 1.9 M EUR over four quarters; benefit tracking reconciles with the ledger each month.',
    blockConfig: {},
  },
];

const oryginalnyGet = Api.get;
Api.get = async (url: string) => {
  if (url.startsWith(`/report-builder/${REPORT_ID}`)) {
    if (url.includes('/comments')) return { comments: [] } as never;
    if (url.includes('/versions')) return { versions: [] } as never;
    if (url.includes('/share')) return { links: [] } as never;
    return { report, sections } as never;
  }
  return oryginalnyGet(url);
};
Api.getLinkGraphBacklinks = async () => ({ backlinks: [] }) as never;

export default function ReportBuilderVoiceDetailScreen(): React.ReactElement {
  useEffect(() => {
    // Karta startuje zwinięta (defaultOpen=false). Kliknij jej nagłówek, aż
    // kontrolki pojawią się w DOM (StrictMode montuje efekt dwukrotnie, więc
    // bez ref-guarda; warunek stopu = widoczny select „Verbosity").
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const revealed = Array.from(document.querySelectorAll('label')).some((l) =>
        /Verbosity/i.test(l.textContent || '')
      );
      if (revealed || tries > 60) {
        clearInterval(timer);
        return;
      }
      const header = Array.from(document.querySelectorAll('button')).find((b) =>
        /Voice & Detail|Głos i szczegółowość/i.test(b.textContent || '')
      );
      header?.click();
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <MainLayout breadcrumbs={['Materials', 'Report Builder']}>
          <div className="h-[calc(100vh-8rem)] w-full">
            <ReportEditor reportId={REPORT_ID} sourceName="Northwind Packaging — DRD" />
          </div>
        </MainLayout>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}
