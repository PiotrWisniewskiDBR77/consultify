#!/usr/bin/env tsx
/**
 * Seed: VTS Group organization + users + access code
 *
 * Creates:
 * 1. VTS Group S.A. organization (enterprise plan, active)
 * 2. Hubert Kowalski (hubert.kowalski@vtsgroup.lu) as OWNER
 * 3. Piotr Wiśniewski (piotr.wisniewski@dbr77.com) as ADMIN member of VTS
 * 4. Access code "VTS-2026" for kickoff self-registration (30 uses, expires 2026-04-30)
 *
 * Public company context seeded from:
 * - https://vtsgroup.com/about-us
 * - public Luxembourg registry aggregators referencing VTS Group S.A. in Windhof, Luxembourg
 *
 * Usage:
 *   npx tsx server/scripts/seed-vts-organization.ts
 *
 * For PostgreSQL production:
 *   DB_TYPE=postgres DATABASE_URL=... npx tsx server/scripts/seed-vts-organization.ts
 */

import crypto from 'crypto';

import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import {
  logSelectedDatabaseTarget,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE, override: true });
}

const VTS_ORG_ID = process.env.SEED_ORG_ID || 'vts';
const VTS_ORG_NAME = process.env.SEED_ORG_NAME || 'VTS Group S.A.';
const VTS_PLAN = 'enterprise';
const VTS_DOMAIN = 'vtsgroup.com';
const VTS_INDUSTRY = 'manufacturing';
const VTS_PROFILE_ID = `${VTS_ORG_ID}-profile`;
const VTS_PUBLIC_SOURCE = 'https://vtsgroup.com/about-us';
const VTS_DESCRIPTION =
  'VTS Group is a global manufacturer of HVAC equipment, including air handling units, air curtains, heating units, and fan coil systems.';
const VTS_MISSION = 'To be a manufacturer NUMBER 1 of air-handling and air-conditioning units in the world';
const VTS_VISION =
  'Build a globally scalable HVAC platform with standardized products, strong delivery discipline, and a broad partner network.';
const VTS_PUBLIC_FACTS = {
  website: `https://${VTS_DOMAIN}`,
  source: VTS_PUBLIC_SOURCE,
  foundedYear: 1989,
  headquartersCountry: 'Luxembourg',
  headquartersAddress: "20 Rue de l'Industrie, Windhof 1, Luxembourg",
  employeesApprox: '500+',
  salesEngineersApprox: '350+',
  branchesCount: 20,
  countriesServed: '65+',
  soldDevices: '1500000+',
  industry: 'HVAC manufacturing',
  products: ['VENTUS', 'VENTUS Compact', 'WING', 'VOLCANO', 'Fan Coil Units'],
};
const VTS_BRANDING_SETTINGS = {
  description: VTS_DESCRIPTION,
  industry: 'Manufacturing / HVAC',
  companySize: '500+',
  website: `https://${VTS_DOMAIN}`,
  defaultLanguage: 'en',
  currency: 'EUR',
};
const VTS_PROFILE = {
  industry: 'Manufacturing',
  industrySubsector: 'HVAC equipment',
  companySize: 'ENTERPRISE',
  employeeCount: 500,
  foundingYear: 1989,
  headquartersCountry: 'Luxembourg',
  strategicPriorities: [
    'Global growth in HVAC equipment',
    'Standardized product portfolio',
    'Fast delivery and logistics excellence',
    'Expansion through international branches and sales engineering',
  ],
  competitivePosition: 'CHALLENGER',
  growthStage: 'MATURE',
  missionStatement: VTS_MISSION,
  visionStatement: VTS_VISION,
  primaryMarkets: ['Europe', 'Middle East', 'Asia', 'North America', 'South America'],
  customerSegments: ['B2B', 'Installers', 'Distributors', 'Industrial and commercial facilities'],
  regulatoryEnvironment: ['EU product compliance', 'Energy efficiency regulations', 'Local building codes'],
  riskAppetite: 'MODERATE',
  preferredLanguage: 'en',
  communicationStyle: 'PROFESSIONAL',
  industryJargonLevel: 'HIGH',
  profileCompleteness: 88,
};

const HUBERT_EMAIL = process.env.VTS_OWNER_EMAIL || 'hubert.kowalski@vtsgroup.lu';
const HUBERT_TEMP_PASSWORD = process.env.VTS_OWNER_PASSWORD || 'VTS2026!change';
const HUBERT_FIRST = process.env.VTS_OWNER_FIRST_NAME || 'Hubert';
const HUBERT_LAST = process.env.VTS_OWNER_LAST_NAME || 'Kowalski';

const PIOTR_EMAIL = process.env.VTS_ADMIN_EMAIL || 'piotr.wisniewski@dbr77.com';

const ACCESS_CODE = process.env.VTS_ACCESS_CODE || 'VTS-2026';
const ACCESS_CODE_MAX_USES = parseInt(process.env.VTS_ACCESS_CODE_MAX_USES || '30', 10);
const ACCESS_CODE_EXPIRES = process.env.VTS_ACCESS_CODE_EXPIRES || '2026-04-30T23:59:59.000Z';
const VTS_TEMPLATE_TARGET_ORGS = Array.from(
  new Set(
    String(process.env.VTS_TEMPLATE_TARGET_ORGS || `${VTS_ORG_ID},vts-group`)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
);

function nowIso() {
  return new Date().toISOString();
}

function requireProductionConfirmation() {
  const mode = String(process.env.SEED_MODE || '').toLowerCase();
  const confirm = String(process.env.SEED_CONFIRM || '');
  if (mode !== 'production') {
    throw new Error(`Refusing to run: set SEED_MODE=production (current: "${mode || '(empty)'}")`);
  }
  if (confirm !== 'YES_I_UNDERSTAND_PRODUCTION') {
    throw new Error(
      'Refusing to run without explicit confirmation. Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION'
    );
  }
}

type VtsInterviewQuestion = {
  id: string;
  category: 'strategy' | 'operations' | 'digital' | 'people' | 'finance';
  questionText: string;
  description?: string;
  evidencePrompt?: string;
  answerType?: string;
  expectedAnswerShape?: string;
};

type VtsInterviewTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  audience: string;
  estimatedTimeMinutes: number;
  areaTags: string[];
  questions: VtsInterviewQuestion[];
};

const DEFAULT_EXPECTED_ANSWER_SHAPE =
  'Podaj konkretną odpowiedź opartą na faktach. Jeśli to możliwe, dodaj przykłady, dane, KPI, nazwy systemów, właścicieli procesu lub dokumenty.';

const VTS_INTERVIEW_TEMPLATES: VtsInterviewTemplate[] = [
  {
    id: 'vts_hq_core_v1',
    name: 'VTS HQ - wspólne',
    description:
      'Wspólny pakiet pytań dla wszystkich respondentów z HQ. Skupia się na priorytetach biznesowych, wąskich gardłach między funkcjami oraz potencjale automatyzacji i AI.',
    category: 'EXECUTIVE',
    audience: 'Liderzy centrali ze wszystkich funkcji',
    estimatedTimeMinutes: 20,
    areaTags: ['strategy', 'operations', 'digital', 'people', 'finance'],
    questions: [
      {
        id: 'q01',
        category: 'strategy',
        questionText:
          'Jakie są 3 najważniejsze priorytety biznesowe VTS na najbliższe 12-24 miesiące i dlaczego właśnie teraz są kluczowe?',
      },
      {
        id: 'q02',
        category: 'operations',
        questionText:
          'Które procesy end-to-end pomiędzy funkcjami tworzą dziś największe tarcie dla wzrostu, marży lub szybkości działania organizacji?',
      },
      {
        id: 'q03',
        category: 'people',
        questionText:
          'W których miejscach decyzje lub ścieżki akceptacyjne najczęściej spowalniają organizację?',
      },
      {
        id: 'q04',
        category: 'operations',
        questionText:
          'Jakie działania w HQ nadal pochłaniają najwięcej pracy manualnej, mimo że powinny być prostsze albo bardziej standaryzowane?',
      },
      {
        id: 'q05',
        category: 'digital',
        questionText:
          'Gdzie informacje są dziś duplikowane, przepisywane lub uzgadniane pomiędzy systemami, plikami i zespołami?',
      },
      {
        id: 'q06',
        category: 'digital',
        questionText:
          'Które decyzje są dziś ograniczane przez brak danych, opóźnione dane albo niski poziom zaufania do danych?',
      },
      {
        id: 'q07',
        category: 'strategy',
        questionText:
          'Które 2-3 obszary biznesowe mają obecnie największy potencjał do automatyzacji lub wykorzystania AI?',
      },
      {
        id: 'q08',
        category: 'finance',
        questionText:
          'Jakie ograniczenia budżetowe, ryzyka, wymogi compliance lub cyberbezpieczeństwa musi uwzględniać każdy projekt digitalizacyjny?',
      },
      {
        id: 'q09',
        category: 'finance',
        questionText:
          'Jakie KPI powinny służyć do oceny, czy program digitalizacji VTS rzeczywiście przynosi wartość?',
      },
      {
        id: 'q10',
        category: 'people',
        questionText:
          'Które decyzje lub interakcje powinny pozostać przede wszystkim po stronie człowieka, nawet jeśli wdrożymy AI lub automatyzację?',
      },
    ],
  },
  {
    id: 'vts_sales_v1',
    name: 'VTS Sprzedaż',
    description:
      'Pakiet komercyjny do identyfikacji wąskich gardeł w sprzedaży, problemów z pricingiem, luk danych oraz use case’ów AI wspierających wzrost.',
    category: 'SALES',
    audience: 'Liderzy sprzedaży, key account managerowie, wsparcie sprzedaży, commercial operations',
    estimatedTimeMinutes: 20,
    areaTags: ['sales', 'strategy', 'operations', 'digital', 'finance'],
    questions: [
      {
        id: 'q01',
        category: 'operations',
        questionText:
          'Jakie są główne etapy procesu od leada do zamówienia w VTS i na których etapach szanse sprzedażowe najczęściej zwalniają lub zatrzymują się?',
      },
      {
        id: 'q02',
        category: 'finance',
        questionText:
          'Które elementy ofertowania, kalkulacji ceny, akceptacji rabatów lub przygotowania przetargów są dziś najbardziej czasochłonne?',
      },
      {
        id: 'q03',
        category: 'digital',
        questionText:
          'Na ile dobrze współpracują dziś CRM, ERP, pliki pricingowe i pozostałe narzędzia komercyjne?',
      },
      {
        id: 'q04',
        category: 'finance',
        questionText:
          'Jak dokładna jest obecna prognoza sprzedaży i co najczęściej powoduje największe odchylenia względem wyniku rzeczywistego?',
      },
      {
        id: 'q05',
        category: 'operations',
        questionText:
          'Które powtarzalne zadania handlowe lub zapytania klientów są na tyle standardowe, że można je zautomatyzować albo mocno uprościć?',
      },
      {
        id: 'q06',
        category: 'digital',
        questionText:
          'Gdzie zespoły sprzedaży tracą dziś najwięcej czasu na szukanie informacji o produktach, cenach, terminach lub kliencie zamiast na sprzedaż?',
      },
      {
        id: 'q07',
        category: 'people',
        questionText:
          'Które handoffy pomiędzy sprzedażą a innymi zespołami powodują najwięcej tarcia, poprawek lub nieporozumień?',
        description: 'Pomyśl szczególnie o marketingu, logistyce, finansach, jakości oraz R&D.',
      },
      {
        id: 'q08',
        category: 'strategy',
        questionText:
          'Które use case’y AI mogłyby najbardziej poprawić win rate, szybkość działania, dyscyplinę cenową lub pokrycie klientów?',
      },
      {
        id: 'q09',
        category: 'finance',
        questionText:
          'Gdzie dziś ucieka marża komercyjna, na przykład przez rabaty, poprawki, ekspresowe realizacje, reklamacje albo słabą jakość zamówień?',
      },
      {
        id: 'q10',
        category: 'strategy',
        questionText:
          'Gdyby można było przebudować tylko jeden fragment procesu sprzedaży, który obszar wybralibyście jako pierwszy i jaki efekt biznesowy powinien z tego wyniknąć?',
      },
    ],
  },
  {
    id: 'vts_marketing_v1',
    name: 'VTS Marketing',
    description:
      'Pakiet marketingowy dotyczący kampanii, brandu, contentu, jakości leadów, pracy z danymi i możliwości zwiększenia produktywności przez AI.',
    category: 'MARKETING',
    audience: 'Liderzy marketingu, brand, marketing cyfrowy, content, marketing regionalny',
    estimatedTimeMinutes: 20,
    areaTags: ['marketing', 'strategy', 'digital', 'operations', 'data'],
    questions: [
      {
        id: 'q01',
        category: 'strategy',
        questionText:
          'Jakie najważniejsze rezultaty biznesowe marketing ma dostarczyć dla VTS w najbliższych 12 miesiącach?',
      },
      {
        id: 'q02',
        category: 'operations',
        questionText:
          'Które etapy planowania kampanii, uruchamiania działań lub raportowania powodują dziś najwięcej opóźnień i zbędnej koordynacji?',
      },
      {
        id: 'q03',
        category: 'digital',
        questionText:
          'Na ile dobrze połączone są dziś narzędzia marketingowe, CRM, analityka webowa i regionalne źródła danych?',
      },
      {
        id: 'q04',
        category: 'operations',
        questionText:
          'Które zadania związane z tworzeniem treści, adaptacją materiałów lub lokalizacją są najbardziej powtarzalne, manualne albo trudne do skalowania między rynkami?',
      },
      {
        id: 'q05',
        category: 'people',
        questionText:
          'Gdzie akceptacje brandowe, produktowe lub prawne najbardziej spowalniają wykonanie działań marketingowych?',
      },
      {
        id: 'q06',
        category: 'digital',
        questionText:
          'Jak dobra jest obecna widoczność jakości leadów, ROI kampanii oraz konwersji w lejku według segmentu lub regionu?',
      },
      {
        id: 'q07',
        category: 'operations',
        questionText:
          'Które handoffy pomiędzy marketingiem a sprzedażą powodują najwięcej tarcia, brak follow-upu albo sporów o jakość leadów?',
      },
      {
        id: 'q08',
        category: 'strategy',
        questionText:
          'Które use case’y AI mogłyby najbardziej poprawić szybkość kampanii, throughput contentu, personalizację lub generowanie insightów marketingowych?',
      },
      {
        id: 'q09',
        category: 'finance',
        questionText:
          'Które działania marketingowe wydają się dziś kosztowne względem tworzonej wartości i dlaczego?',
      },
      {
        id: 'q10',
        category: 'digital',
        questionText:
          'Jakiej jednej zdolności w obszarze danych, systemów lub workflow najbardziej dziś brakuje, aby marketing był skuteczniejszy?',
      },
    ],
  },
  {
    id: 'vts_logistics_v1',
    name: 'VTS Logistyka i Łańcuch Dostaw',
    description:
      'Pakiet dla logistyki i supply chain z perspektywy HQ: planowanie, widoczność zapasów, wyjątki, koszty oraz potencjał automatyzacji i AI.',
    category: 'LOGISTICS',
    audience: 'Łańcuch dostaw, logistyka, planowanie centralne, koordynacja transportu, funkcje centrali',
    estimatedTimeMinutes: 20,
    areaTags: ['delivery', 'operations', 'digital', 'data', 'finance'],
    questions: [
      {
        id: 'q01',
        category: 'operations',
        questionText:
          'Jakie są główne etapy procesu od planu produkcji do dostawy do klienta i w których miejscach najczęściej pojawiają się opóźnienia?',
      },
      {
        id: 'q02',
        category: 'digital',
        questionText:
          'Na ile wiarygodna jest dziś widoczność zapasów, dostępności, statusu wysyłek i priorytetów zamówień na poziomie HQ?',
      },
      {
        id: 'q03',
        category: 'operations',
        questionText:
          'Które wyjątki powodują dziś najwięcej gaszenia pożarów w logistyce, na przykład braki, zmiany transportowe, problemy celne albo brak dokumentów?',
      },
      {
        id: 'q04',
        category: 'operations',
        questionText:
          'Które działania związane z planowaniem, przeplanowaniem lub koordynacją są nadal obsługiwane głównie przez Excela, e-mail lub telefon?',
      },
      {
        id: 'q05',
        category: 'finance',
        questionText:
          'W których miejscach koszty logistyczne rosną najbardziej, na przykład przez premium freight, niskie wykorzystanie, bufory zapasu albo ekspresowe działania?',
      },
      {
        id: 'q06',
        category: 'digital',
        questionText:
          'Na ile dobrze łączą się dziś ERP, WMS, narzędzia transportowe i dane od przewoźników, i gdzie występują największe przerwy w danych?',
      },
      {
        id: 'q07',
        category: 'people',
        questionText:
          'Które handoffy pomiędzy logistyką a sprzedażą, zakupami, jakością lub obsługą klienta powodują najwięcej poprawek albo niejasności?',
      },
      {
        id: 'q08',
        category: 'strategy',
        questionText:
          'Które procesy logistyczne najlepiej nadają się dziś do workflow automation, AI-assisted planning lub zarządzania wyjątkami?',
      },
      {
        id: 'q09',
        category: 'finance',
        questionText:
          'Które KPI najlepiej opisują dziś efektywność logistyki i gdzie luki względem celu są największe?',
      },
      {
        id: 'q10',
        category: 'digital',
        questionText:
          'Jaka jedna zdolność cyfrowa dałaby dziś największą poprawę szybkości reakcji i przewidywalności w logistyce?',
      },
    ],
  },
  {
    id: 'vts_hr_finance_v1',
    name: 'VTS HR i Finanse',
    description:
      'Połączony pakiet dla HR i finansów skupiony na pracy administracyjnej, raportowaniu, approvals, jakości danych i wykorzystaniu AI w back-office.',
    category: 'HR_FINANCE',
    audience: 'Liderzy HR, liderzy finansów, controlling, usługi wspólne, operacje HR',
    estimatedTimeMinutes: 20,
    areaTags: ['hr', 'people', 'finance', 'digital', 'data'],
    questions: [
      {
        id: 'q01',
        category: 'people',
        questionText:
          'Które procesy HR lub finansowe pochłaniają dziś najwięcej pracy administracyjnej wykonywanej ręcznie?',
      },
      {
        id: 'q02',
        category: 'people',
        questionText:
          'W których miejscach onboarding, rekrutacja, administracja szkoleniami, payroll albo employee service najbardziej zwalniają lub frustrują użytkowników?',
      },
      {
        id: 'q03',
        category: 'finance',
        questionText:
          'Które elementy month-end close, raportowania, budżetowania lub forecastingu są dziś najbardziej czasochłonne i dlaczego?',
      },
      {
        id: 'q04',
        category: 'digital',
        questionText:
          'Na ile dobrze współpracują dziś systemy HR, systemy finansowe, arkusze i lokalne pliki?',
      },
      {
        id: 'q05',
        category: 'finance',
        questionText:
          'Które workflow akceptacyjne dla wydatków, rekrutacji, podróży lub umów są dziś zbyt wolne albo zbyt nieprzejrzyste?',
      },
      {
        id: 'q06',
        category: 'digital',
        questionText:
          'Gdzie praca na dokumentach jest nadal mocno manualna, na przykład dla faktur, umów, polityk, CV albo zgłoszeń pracowników?',
      },
      {
        id: 'q07',
        category: 'people',
        questionText:
          'Jakich danych o ludziach, kompetencjach lub strukturze najbardziej brakuje albo którym danym trudno zaufać przy podejmowaniu decyzji?',
      },
      {
        id: 'q08',
        category: 'finance',
        questionText:
          'Które wskaźniki finansowe lub HR są najważniejsze i gdzie raportowanie jest nadal zbyt wolne, zbyt manualne albo niewystarczająco wiarygodne?',
      },
      {
        id: 'q09',
        category: 'strategy',
        questionText:
          'Które use case’y AI lub automatyzacji mogłyby najbardziej poprawić szybkość działania, compliance, employee experience albo widoczność dla managementu w HR i finansach?',
      },
      {
        id: 'q10',
        category: 'digital',
        questionText:
          'Jeden proces w HR lub finansach, który jako pierwszy powinien zostać przeprojektowany pod cele digitalizacji VTS, to który i dlaczego?',
      },
    ],
  },
  {
    id: 'vts_production_quality_v1',
    name: 'VTS Produkcja i Jakość - centrala',
    description:
      'Pakiet dla funkcji HQ odpowiedzialnych za produkcję i jakość. Dotyczy standardów między zakładami, danych, governance i potencjału automatyzacji oraz AI.',
    category: 'PRODUCTION_QUALITY',
    audience: 'Operacje centralne, manufacturing excellence, centralna jakość, standardy inżynieryjne',
    estimatedTimeMinutes: 20,
    areaTags: ['operations', 'digital', 'data', 'compliance', 'people'],
    questions: [
      {
        id: 'q01',
        category: 'operations',
        questionText:
          'Które problemy produkcyjne lub jakościowe najczęściej wracają między zakładami i mają największy wpływ na terminowość, koszty lub jakość?',
      },
      {
        id: 'q02',
        category: 'operations',
        questionText:
          'W których obszarach standardy operacyjne lub jakościowe są dziś niespójne pomiędzy lokalizacjami VTS?',
      },
      {
        id: 'q03',
        category: 'digital',
        questionText:
          'Jakich danych produkcyjnych lub jakościowych na poziomie grupy dziś brakuje, są opóźnione albo są zbierane w zbyt manualny sposób?',
      },
      {
        id: 'q04',
        category: 'finance',
        questionText:
          'Gdzie koszty złej jakości, poprawek, reklamacji lub niestabilności operacyjnej są dziś największe z perspektywy HQ?',
      },
      {
        id: 'q05',
        category: 'operations',
        questionText:
          'Jak wygląda dziś identyfikacja i zamykanie root cause dla problemów jakościowych lub operacyjnych na poziomie międzyfunkcyjnym i międzyzakładowym?',
      },
      {
        id: 'q06',
        category: 'people',
        questionText:
          'Gdzie najczęściej pojawiają się luki w transferze wiedzy, wdrażaniu standardów lub odpowiedzialności między HQ a zakładami?',
      },
      {
        id: 'q07',
        category: 'digital',
        questionText:
          'Na ile silna jest dziś traceability oraz spójność definicji KPI produkcyjnych i jakościowych między lokalizacjami?',
      },
      {
        id: 'q08',
        category: 'strategy',
        questionText:
          'Które procesy w obszarze produkcji i jakości z perspektywy HQ najlepiej nadają się do automatyzacji, analityki predykcyjnej lub wsparcia AI?',
      },
      {
        id: 'q09',
        category: 'finance',
        questionText:
          'Które KPI najlepiej powinny odzwierciedlać skuteczność funkcji produkcji i jakości na poziomie grupy i gdzie dziś są największe luki?',
      },
      {
        id: 'q10',
        category: 'digital',
        questionText:
          'Jaka jedna zdolność cyfrowa najbardziej poprawiłaby stabilność operacyjną lub zarządzanie jakością na poziomie HQ w najbliższych 12 miesiącach?',
      },
    ],
  },
  {
    id: 'vts_rnd_v1',
    name: 'VTS B+R',
    description:
      'Pakiet dla R&D dotyczący przepływu od pomysłu do wdrożenia, współpracy inżynierskiej, wiedzy, walidacji oraz zastosowań AI w rozwoju produktów.',
    category: 'R_AND_D',
    audience: 'Liderzy B+R, rozwój produktu, menedżerowie inżynieryjni, walidacja, product management',
    estimatedTimeMinutes: 20,
    areaTags: ['strategy', 'operations', 'digital', 'data', 'people'],
    questions: [
      {
        id: 'q01',
        category: 'strategy',
        questionText:
          'Jakie są najważniejsze priorytety R&D na najbliższe 12-24 miesiące i w jaki sposób wspierają strategię biznesową VTS?',
      },
      {
        id: 'q02',
        category: 'operations',
        questionText:
          'Na którym etapie ścieżki od pomysłu, wymagania lub requestu do wdrożonego rozwiązania pojawia się dziś największe opóźnienie?',
      },
      {
        id: 'q03',
        category: 'operations',
        questionText:
          'Jakie typy reworku pojawiają się w R&D najczęściej, na przykład zmiany wymagań, niepełne wejścia, redesign lub nieudana walidacja?',
      },
      {
        id: 'q04',
        category: 'digital',
        questionText:
          'Na ile dobrze współpracują dziś PLM, CAD, ERP, dane testowe, narzędzia projektowe i repozytoria dokumentacji?',
      },
      {
        id: 'q05',
        category: 'digital',
        questionText:
          'Gdzie inżynierowie tracą dziś za dużo czasu na szukanie wymagań, rysunków, norm, lessons learned lub wcześniejszych rozwiązań?',
      },
      {
        id: 'q06',
        category: 'people',
        questionText:
          'Które handoffy pomiędzy R&D a sprzedażą, jakością, produkcją lub product managementem powodują najwięcej tarcia albo nieporozumień?',
      },
      {
        id: 'q07',
        category: 'operations',
        questionText:
          'Które działania związane z testami, walidacją, akceptacjami lub dokumentacją są dziś największym wąskim gardłem cyklu rozwoju?',
      },
      {
        id: 'q08',
        category: 'digital',
        questionText:
          'Jakich danych produktowych, klienckich, fieldowych lub regulacyjnych najbardziej dziś brakuje albo z których trudno korzystać przy decyzjach R&D?',
      },
      {
        id: 'q09',
        category: 'strategy',
        questionText:
          'Które use case’y AI mogłyby najbardziej poprawić produktywność inżynierów, reuse wiedzy, jakość projektu lub speed to market?',
      },
      {
        id: 'q10',
        category: 'finance',
        questionText:
          'Które mierniki powinny pokazywać, że digitalizacja w R&D rzeczywiście dostarcza wartość dla VTS?',
      },
    ],
  },
];

async function upsertVtsInterviewTemplates(
  db: {
    run: (sql: string, params?: unknown[]) => Promise<unknown>;
  },
  targetOrganizationId: string,
  createdByUserId: string
) {
  for (const template of VTS_INTERVIEW_TEMPLATES) {
    const templateRecordId =
      targetOrganizationId === VTS_ORG_ID ? template.id : `${targetOrganizationId}__${template.id}`;

    await db.run(
      `INSERT INTO interview_library_templates
       (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, answer_design_guide, area_tags, is_default, version, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'approved', 'org', 'organization', $6, $7, 'one_question_per_screen', $8, $9, 0, 1, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         status = 'approved',
         visibility = 'org',
         template_scope = 'organization',
         audience = EXCLUDED.audience,
         estimated_time_minutes = EXCLUDED.estimated_time_minutes,
         runtime_mode_default = EXCLUDED.runtime_mode_default,
         answer_design_guide = EXCLUDED.answer_design_guide,
         area_tags = EXCLUDED.area_tags,
         is_default = 0,
         version = 1,
         created_by = EXCLUDED.created_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        templateRecordId,
        targetOrganizationId,
        template.name,
        template.description,
        template.category,
        template.audience,
        template.estimatedTimeMinutes,
        'Skup się na optymalizacji, automatyzacji, digitalizacji i szansach wykorzystania AI. Preferowane są odpowiedzi oparte na faktach, przykładach, KPI, systemach, właścicielach procesu i ograniczeniach.',
        JSON.stringify(template.areaTags),
        createdByUserId,
      ]
    );

    for (const [index, question] of template.questions.entries()) {
      const questionRecordId =
        targetOrganizationId === VTS_ORG_ID
          ? `${template.id}_${question.id}`
          : `${targetOrganizationId}__${template.id}_${question.id}`;

      await db.run(
        `INSERT INTO interview_library_template_questions
         (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', $8, 1, 1, 1, 1, 1, $9, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           template_id = EXCLUDED.template_id,
           category = EXCLUDED.category,
           question_text = EXCLUDED.question_text,
           description = EXCLUDED.description,
           evidence_prompt = EXCLUDED.evidence_prompt,
           answer_type = EXCLUDED.answer_type,
           answer_options = EXCLUDED.answer_options,
           expected_answer_shape = EXCLUDED.expected_answer_shape,
           is_required = EXCLUDED.is_required,
           allow_voice = EXCLUDED.allow_voice,
           allow_file_upload = EXCLUDED.allow_file_upload,
           allow_url = EXCLUDED.allow_url,
           allow_context_note = EXCLUDED.allow_context_note,
           sort_order = EXCLUDED.sort_order`,
        [
          questionRecordId,
          templateRecordId,
          question.category,
          question.questionText,
          question.description || null,
          question.evidencePrompt || null,
          question.answerType || 'long_text',
          question.expectedAnswerShape || DEFAULT_EXPECTED_ANSWER_SHAPE,
          (index + 1) * 10,
        ]
      );
    }
  }
}

async function main() {
  requireProductionConfirmation();
  const target = resolveScriptDatabaseTarget({
    label: 'seed-vts-organization',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('seed-vts-organization', target);
  process.env.DATABASE_URL = target.connectionString;

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  // ── 1. Create VTS Group organization ───────────────────────────
  try {
    await db.run(
      `INSERT INTO organizations (id, name, status, plan, industry, domain, attribution_data)
       VALUES ($1, $2, 'active', $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         status = 'active',
         plan = EXCLUDED.plan,
         industry = EXCLUDED.industry,
         domain = EXCLUDED.domain,
         attribution_data = EXCLUDED.attribution_data`,
      [
        VTS_ORG_ID,
        VTS_ORG_NAME,
        VTS_PLAN,
        VTS_INDUSTRY,
        VTS_DOMAIN,
        JSON.stringify({
          source: 'public_company_profile',
          publicProfile: VTS_PUBLIC_FACTS,
          orgProfileType: 'OPERATING',
          country: 'LU',
        }),
      ]
    );
    logger.info('[seed-vts] Organization created/updated', { id: VTS_ORG_ID, name: VTS_ORG_NAME });
  } catch (e: any) {
    logger.warn('[seed-vts] Org upsert issue (continuing):', e?.message || e);
  }

  try {
    await db.run(
      `INSERT INTO organization_profiles (
         id,
         organization_id,
         industry,
         industry_subsector,
         company_size,
         employee_count,
         founding_year,
         headquarters_country,
         strategic_priorities,
         competitive_position,
         growth_stage,
         mission_statement,
         vision_statement,
         primary_markets,
         customer_segments,
         regulatory_environment,
         risk_appetite,
         preferred_language,
         communication_style,
         industry_jargon_level,
         profile_completeness,
         created_by,
         updated_by
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
         $21, $22, $23
       )
       ON CONFLICT (organization_id) DO UPDATE SET
         industry = EXCLUDED.industry,
         industry_subsector = EXCLUDED.industry_subsector,
         company_size = EXCLUDED.company_size,
         employee_count = EXCLUDED.employee_count,
         founding_year = EXCLUDED.founding_year,
         headquarters_country = EXCLUDED.headquarters_country,
         strategic_priorities = EXCLUDED.strategic_priorities,
         competitive_position = EXCLUDED.competitive_position,
         growth_stage = EXCLUDED.growth_stage,
         mission_statement = EXCLUDED.mission_statement,
         vision_statement = EXCLUDED.vision_statement,
         primary_markets = EXCLUDED.primary_markets,
         customer_segments = EXCLUDED.customer_segments,
         regulatory_environment = EXCLUDED.regulatory_environment,
         risk_appetite = EXCLUDED.risk_appetite,
         preferred_language = EXCLUDED.preferred_language,
         communication_style = EXCLUDED.communication_style,
         industry_jargon_level = EXCLUDED.industry_jargon_level,
         profile_completeness = EXCLUDED.profile_completeness,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        VTS_PROFILE_ID,
        VTS_ORG_ID,
        VTS_PROFILE.industry,
        VTS_PROFILE.industrySubsector,
        VTS_PROFILE.companySize,
        VTS_PROFILE.employeeCount,
        VTS_PROFILE.foundingYear,
        VTS_PROFILE.headquartersCountry,
        JSON.stringify(VTS_PROFILE.strategicPriorities),
        VTS_PROFILE.competitivePosition,
        VTS_PROFILE.growthStage,
        VTS_PROFILE.missionStatement,
        VTS_PROFILE.visionStatement,
        JSON.stringify(VTS_PROFILE.primaryMarkets),
        JSON.stringify(VTS_PROFILE.customerSegments),
        JSON.stringify(VTS_PROFILE.regulatoryEnvironment),
        VTS_PROFILE.riskAppetite,
        VTS_PROFILE.preferredLanguage,
        VTS_PROFILE.communicationStyle,
        VTS_PROFILE.industryJargonLevel,
        VTS_PROFILE.profileCompleteness,
        PIOTR_EMAIL,
        PIOTR_EMAIL,
      ]
    );

    await db.run(
      `INSERT INTO organization_settings (organization_id, setting_key, setting_value, updated_at)
       VALUES ($1, 'branding', $2, CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id, setting_key) DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         updated_at = CURRENT_TIMESTAMP`,
      [VTS_ORG_ID, JSON.stringify(VTS_BRANDING_SETTINGS)]
    );

    logger.info('[seed-vts] Public VTS profile context synced', {
      website: VTS_BRANDING_SETTINGS.website,
      headquartersCountry: VTS_PROFILE.headquartersCountry,
      source: VTS_PUBLIC_SOURCE,
    });
  } catch (e: any) {
    logger.warn('[seed-vts] Public profile sync issue (continuing):', e?.message || e);
  }

  // ── 2. Create Hubert Kowalski as OWNER of VTS ─────────────────
  const hubertPasswordHash = bcrypt.hashSync(HUBERT_TEMP_PASSWORD, 10);
  let hubertId: string;

  const existingHubert = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1`,
    [HUBERT_EMAIL.toLowerCase()]
  );

  if (existingHubert.rows?.[0]?.id) {
    hubertId = existingHubert.rows[0].id;
    await db.run(
      `UPDATE users
       SET organization_id = $1,
           password = $2,
           first_name = $3,
           last_name = $4,
           role = 'OWNER',
           status = 'active'
       WHERE id = $5`,
      [VTS_ORG_ID, hubertPasswordHash, HUBERT_FIRST, HUBERT_LAST, hubertId]
    );
    logger.info('[seed-vts] Hubert updated', { id: hubertId });
  } else {
    hubertId = `vts_owner_${crypto.randomUUID()}`;
    await db.run(
      `INSERT INTO users
       (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'OWNER', 'active', $7)`,
      [hubertId, VTS_ORG_ID, HUBERT_EMAIL, hubertPasswordHash, HUBERT_FIRST, HUBERT_LAST, nowIso()]
    );
    logger.info('[seed-vts] Hubert created', { id: hubertId, email: HUBERT_EMAIL });
  }

  // Ensure organization_members row for Hubert → VTS (OWNER)
  await db.run(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4)
     ON CONFLICT(organization_id, user_id) DO UPDATE SET role = 'OWNER', status = 'ACTIVE'`,
    [crypto.randomUUID(), VTS_ORG_ID, hubertId, nowIso()]
  );
  logger.info('[seed-vts] Hubert → VTS membership: OWNER');

  // ── 3. Add Piotr as ADMIN member of VTS ────────────────────────
  const piotrRow = await db.query<{ id: string; organization_id: string }>(
    `SELECT id, organization_id FROM users WHERE lower(trim(email)) = $1 LIMIT 1`,
    [PIOTR_EMAIL.toLowerCase()]
  );

  if (!piotrRow.rows?.[0]?.id) {
    logger.error('[seed-vts] Piotr not found in users table! Run dev-ensure-admin first.');
    process.exit(1);
  }

  const piotrId = piotrRow.rows[0].id;
  const piotrCurrentOrg = piotrRow.rows[0].organization_id;

  // Ensure Piotr has organization_members for his DBR77 org (backfill)
  if (piotrCurrentOrg && piotrCurrentOrg !== VTS_ORG_ID) {
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4)
       ON CONFLICT(organization_id, user_id) DO NOTHING`,
      [crypto.randomUUID(), piotrCurrentOrg, piotrId, nowIso()]
    );
    logger.info('[seed-vts] Piotr → DBR77 membership ensured: OWNER');
  }

  // Add Piotr as ADMIN member of VTS
  await db.run(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4)
     ON CONFLICT(organization_id, user_id) DO UPDATE SET role = 'ADMIN', status = 'ACTIVE'`,
    [crypto.randomUUID(), VTS_ORG_ID, piotrId, nowIso()]
  );
  logger.info('[seed-vts] Piotr → VTS membership: ADMIN');

  // ── 4. Create access code VTS-2026 ────────────────────────────
  try {
    const existingCode = await db.query<{ id: string }>(
      `SELECT id FROM access_codes WHERE code = $1 LIMIT 1`,
      [ACCESS_CODE]
    );

    if (existingCode.rows?.[0]?.id) {
      await db.run(
        `UPDATE access_codes
         SET organization_id = $1,
             created_by = $2,
             role = 'MEMBER',
             max_uses = $3,
             current_uses = 0,
             expires_at = $4,
             is_active = 1
         WHERE id = $5`,
        [VTS_ORG_ID, hubertId, ACCESS_CODE_MAX_USES, ACCESS_CODE_EXPIRES, existingCode.rows[0].id]
      );
    } else {
      const codeId = `vts_code_${crypto.randomUUID()}`;
      await db.run(
        `INSERT INTO access_codes
         (id, organization_id, code, created_by, role, max_uses, current_uses, expires_at, is_active, created_at)
         VALUES ($1, $2, $3, $4, 'MEMBER', $5, 0, $6, 1, $7)`,
        [codeId, VTS_ORG_ID, ACCESS_CODE, hubertId, ACCESS_CODE_MAX_USES, ACCESS_CODE_EXPIRES, nowIso()]
      );
    }
    logger.info('[seed-vts] Access code created', { code: ACCESS_CODE, maxUses: ACCESS_CODE_MAX_USES });
  } catch (e: any) {
    logger.warn('[seed-vts] Access code issue (continuing):', e?.message || e);
  }

  // ── 5. Create organization-scoped interview templates for VTS ───
  try {
    for (const targetOrganizationId of VTS_TEMPLATE_TARGET_ORGS) {
      await upsertVtsInterviewTemplates(db, targetOrganizationId, piotrId);
    }
    logger.info('[seed-vts] Interview templates synced', {
      organizationIds: VTS_TEMPLATE_TARGET_ORGS,
      templateCountPerOrganization: VTS_INTERVIEW_TEMPLATES.length,
      questionCountPerOrganization: VTS_INTERVIEW_TEMPLATES.reduce(
        (sum, template) => sum + template.questions.length,
        0
      ),
      scope: 'organization',
      visibility: 'org',
    });
  } catch (e: any) {
    logger.warn('[seed-vts] Interview template sync issue (continuing):', e?.message || e);
  }

  // ── Summary ────────────────────────────────────────────────────
  logger.info('[seed-vts] ✅ VTS Group setup complete!', {
    organization: {
      id: VTS_ORG_ID,
      name: VTS_ORG_NAME,
      plan: VTS_PLAN,
      domain: VTS_DOMAIN,
      industry: VTS_INDUSTRY,
    },
    hubert: { email: HUBERT_EMAIL, password: HUBERT_TEMP_PASSWORD, role: 'OWNER' },
    piotr: { email: PIOTR_EMAIL, role: 'ADMIN (VTS) + OWNER (DBR77)' },
    accessCode: { code: ACCESS_CODE, maxUses: ACCESS_CODE_MAX_USES, expires: ACCESS_CODE_EXPIRES },
    publicProfile: {
      website: VTS_BRANDING_SETTINGS.website,
      source: VTS_PUBLIC_SOURCE,
      foundedYear: VTS_PROFILE.foundingYear,
      headquartersCountry: VTS_PROFILE.headquartersCountry,
    },
    interviewTemplates: {
      targetOrganizations: VTS_TEMPLATE_TARGET_ORGS,
      countPerOrganization: VTS_INTERVIEW_TEMPLATES.length,
      questionCountPerOrganization: VTS_INTERVIEW_TEMPLATES.reduce(
        (sum, template) => sum + template.questions.length,
        0
      ),
      scope: 'organization',
      templateNames: VTS_INTERVIEW_TEMPLATES.map((template) => template.name),
    },
  });

  // eslint-disable-next-line no-console
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  // eslint-disable-next-line no-console
  console.log('║              VTS Group – Setup Complete                  ║');
  // eslint-disable-next-line no-console
  console.log('╠══════════════════════════════════════════════════════════╣');
  // eslint-disable-next-line no-console
  console.log(`║  Organization: ${VTS_ORG_NAME} (${VTS_ORG_ID})`);
  // eslint-disable-next-line no-console
  console.log(`║  Plan:         ${VTS_PLAN}`);
  // eslint-disable-next-line no-console
  console.log('║──────────────────────────────────────────────────────────║');
  // eslint-disable-next-line no-console
  console.log(`║  OWNER: ${HUBERT_EMAIL}`);
  // eslint-disable-next-line no-console
  console.log(`║  Pass:  ${HUBERT_TEMP_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log('║──────────────────────────────────────────────────────────║');
  // eslint-disable-next-line no-console
  console.log(`║  ADMIN: ${PIOTR_EMAIL} (also OWNER in DBR77)`);
  // eslint-disable-next-line no-console
  console.log('║──────────────────────────────────────────────────────────║');
  // eslint-disable-next-line no-console
  console.log(`║  Access Code: ${ACCESS_CODE}  (${ACCESS_CODE_MAX_USES} uses, until 30 Apr 2026)`);
  // eslint-disable-next-line no-console
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[seed-vts] ❌ Failed:', e);
  process.exit(1);
});
