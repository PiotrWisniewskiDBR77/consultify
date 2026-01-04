/**
 * Script to generate report sections for existing reports in the database
 * Creates full report structure with cover page, executive summary, axis details, etc.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, '../server/consultify.db');
const db = new sqlite3.Database(dbPath);

// Axis mappings
const AXIS_MAP = {
  processes: {
    id: 'processes',
    name: 'Procesy Cyfrowe',
    namePL: 'Procesy Cyfrowe',
    nameEN: 'Digital Processes',
    icon: '⚙️'
  },
  digitalProducts: {
    id: 'digitalProducts',
    name: 'Produkty Cyfrowe',
    namePL: 'Produkty Cyfrowe',
    nameEN: 'Digital Products',
    icon: '📦'
  },
  businessModels: {
    id: 'businessModels',
    name: 'Modele Biznesowe',
    namePL: 'Modele Biznesowe',
    nameEN: 'Digital Business Models',
    icon: '💼'
  },
  dataManagement: {
    id: 'dataManagement',
    name: 'Zarządzanie Danymi',
    namePL: 'Zarządzanie Danymi',
    nameEN: 'Data Management',
    icon: '📊'
  },
  culture: {
    id: 'culture',
    name: 'Kultura Transformacji',
    namePL: 'Kultura Transformacji',
    nameEN: 'Transformation Culture',
    icon: '🎯'
  },
  cybersecurity: {
    id: 'cybersecurity',
    name: 'Cyberbezpieczeństwo',
    namePL: 'Cyberbezpieczeństwo',
    nameEN: 'Cybersecurity',
    icon: '🔒'
  },
  aiMaturity: {
    id: 'aiMaturity',
    name: 'Dojrzałość AI',
    namePL: 'Dojrzałość AI',
    nameEN: 'AI Maturity',
    icon: '🤖'
  }
};

// Maturity level descriptions
const MATURITY_LEVELS = {
  1: { name: 'Początkowy', description: 'Brak formalnych procesów, działania ad-hoc' },
  2: { name: 'Rozpoznany', description: 'Podstawowa świadomość, początkowe inicjatywy' },
  3: { name: 'Zdefiniowany', description: 'Udokumentowane procesy, standardy wdrożone' },
  4: { name: 'Zarządzany', description: 'Mierzalne procesy, KPI zdefiniowane' },
  5: { name: 'Zoptymalizowany', description: 'Ciągłe doskonalenie, innowacje' },
  6: { name: 'Zaawansowany', description: 'Lider branżowy, najlepsze praktyki' },
  7: { name: 'Wizjonerski', description: 'Wyznacza trendy, transformacja ciągła' }
};

function generateCoverPageContent(title, company, generatedAt) {
  return `
<div class="cover-page" style="text-align: center; padding: 60px 40px;">
  <h1 style="font-size: 32px; margin-bottom: 20px; color: #1a1a2e;">📊 Raport Diagnozy Gotowości Cyfrowej (DRD)</h1>
  <h2 style="font-size: 24px; color: #4a4a6a; margin-bottom: 40px;">${title}</h2>
  <div style="margin: 60px 0;">
    <p style="font-size: 18px; color: #666;">Organizacja: <strong>${company || 'Organizacja'}</strong></p>
    <p style="font-size: 16px; color: #888;">Data wygenerowania: ${new Date(generatedAt).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
  <div style="margin-top: 80px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
    <p style="font-size: 14px; color: #666;">Metodologia: Digital Readiness Diagnosis (DRD)</p>
    <p style="font-size: 14px; color: #666;">Zgodna ze standardem SIRI (Smart Industry Readiness Index)</p>
  </div>
</div>
`;
}

function generateExecutiveSummary(axisScores, title) {
  const axes = Object.entries(axisScores);
  const avgActual = axes.reduce((sum, [_, s]) => sum + s.actual, 0) / axes.length;
  const avgTarget = axes.reduce((sum, [_, s]) => sum + s.target, 0) / axes.length;
  const totalGap = axes.reduce((sum, [_, s]) => sum + (s.target - s.actual), 0);
  
  // Find strongest and weakest axes
  const sortedByActual = [...axes].sort((a, b) => b[1].actual - a[1].actual);
  const strongest = sortedByActual[0];
  const weakest = sortedByActual[sortedByActual.length - 1];
  
  // Find biggest gaps
  const sortedByGap = [...axes].sort((a, b) => (b[1].target - b[1].actual) - (a[1].target - a[1].actual));
  const biggestGaps = sortedByGap.slice(0, 3);

  return `
<div class="executive-summary">
  <h2>📋 Streszczenie Wykonawcze</h2>
  
  <div class="summary-intro" style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
    <p style="font-size: 16px; margin: 0;">
      Niniejszy raport przedstawia kompleksową diagnozę gotowości cyfrowej organizacji w ramach projektu <strong>${title}</strong>. 
      Analiza obejmuje 7 kluczowych osi transformacji cyfrowej zgodnie z metodologią DRD.
    </p>
  </div>

  <h3>🎯 Kluczowe Wskaźniki</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background: #f8f9fa;">
      <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Średni poziom aktualny</strong></td>
      <td style="padding: 15px; border: 1px solid #e0e0e0; text-align: center; font-size: 24px; color: #3b82f6;">${avgActual.toFixed(1)}/7</td>
    </tr>
    <tr>
      <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Średni poziom docelowy</strong></td>
      <td style="padding: 15px; border: 1px solid #e0e0e0; text-align: center; font-size: 24px; color: #10b981;">${avgTarget.toFixed(1)}/7</td>
    </tr>
    <tr style="background: #f8f9fa;">
      <td style="padding: 15px; border: 1px solid #e0e0e0;"><strong>Całkowita luka transformacyjna</strong></td>
      <td style="padding: 15px; border: 1px solid #e0e0e0; text-align: center; font-size: 24px; color: #ef4444;">${totalGap} pkt</td>
    </tr>
  </table>

  <h3>💪 Mocna strona organizacji</h3>
  <div style="padding: 15px; background: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px; margin: 10px 0;">
    <strong>${AXIS_MAP[strongest[0]].icon} ${AXIS_MAP[strongest[0]].namePL}</strong> - poziom ${strongest[1].actual}/7
    <p style="margin: 10px 0 0 0; color: #666;">${strongest[1].justification}</p>
  </div>

  <h3>⚠️ Obszar wymagający największej uwagi</h3>
  <div style="padding: 15px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; margin: 10px 0;">
    <strong>${AXIS_MAP[weakest[0]].icon} ${AXIS_MAP[weakest[0]].namePL}</strong> - poziom ${weakest[1].actual}/7 (cel: ${weakest[1].target})
    <p style="margin: 10px 0 0 0; color: #666;">${weakest[1].justification}</p>
  </div>

  <h3>📈 Priorytetowe luki do zamknięcia</h3>
  <ol style="margin: 15px 0;">
    ${biggestGaps.map(([key, score]) => `
    <li style="margin: 10px 0;">
      <strong>${AXIS_MAP[key].namePL}</strong>: luka ${score.target - score.actual} pkt (${score.actual} → ${score.target})
    </li>
    `).join('')}
  </ol>
</div>
`;
}

function generateMethodologySection() {
  return `
<div class="methodology-section">
  <h2>📐 Metodologia DRD</h2>
  
  <div style="margin: 20px 0;">
    <p>Diagnoza Gotowości Cyfrowej (DRD) to kompleksowa metodologia oceny dojrzałości cyfrowej organizacji, 
    oparta na najlepszych światowych praktykach, w tym standardzie SIRI (Smart Industry Readiness Index).</p>
  </div>

  <h3>7 Osi Transformacji Cyfrowej</h3>
  <div style="display: grid; gap: 15px; margin: 20px 0;">
    ${Object.entries(AXIS_MAP).map(([key, axis]) => `
    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3b82f6;">
      <strong>${axis.icon} ${axis.namePL}</strong>
      <span style="color: #666; margin-left: 10px;">(${axis.nameEN})</span>
    </div>
    `).join('')}
  </div>

  <h3>Skala Dojrzałości (1-7)</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background: #1a1a2e; color: white;">
      <th style="padding: 12px; text-align: left;">Poziom</th>
      <th style="padding: 12px; text-align: left;">Nazwa</th>
      <th style="padding: 12px; text-align: left;">Opis</th>
    </tr>
    ${Object.entries(MATURITY_LEVELS).map(([level, data]) => `
    <tr style="background: ${level % 2 === 0 ? '#f8f9fa' : 'white'};">
      <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold;">${level}</td>
      <td style="padding: 12px; border: 1px solid #e0e0e0;">${data.name}</td>
      <td style="padding: 12px; border: 1px solid #e0e0e0; color: #666;">${data.description}</td>
    </tr>
    `).join('')}
  </table>

  <h3>Proces Diagnozy</h3>
  <ol style="margin: 15px 0; line-height: 1.8;">
    <li><strong>Zbieranie danych</strong> - wywiady, ankiety, analiza dokumentacji</li>
    <li><strong>Ocena ekspercka</strong> - scoring każdego obszaru przez zespół ekspertów</li>
    <li><strong>Analiza porównawcza</strong> - benchmark względem standardów branżowych</li>
    <li><strong>Identyfikacja luk</strong> - porównanie stanu aktualnego z celami</li>
    <li><strong>Rekomendacje</strong> - ścieżki transformacji i priorytety działań</li>
  </ol>
</div>
`;
}

function generateAxisDetailSection(axisKey, axisScore) {
  const axis = AXIS_MAP[axisKey];
  const gap = axisScore.target - axisScore.actual;
  const gapColor = gap > 2 ? '#ef4444' : gap > 1 ? '#f59e0b' : '#10b981';
  
  const currentLevel = MATURITY_LEVELS[axisScore.actual] || MATURITY_LEVELS[Math.round(axisScore.actual)];
  const targetLevel = MATURITY_LEVELS[axisScore.target] || MATURITY_LEVELS[Math.round(axisScore.target)];

  return `
<div class="axis-detail-section">
  <h2>${axis.icon} ${axis.namePL}</h2>
  <p style="color: #666; font-style: italic; margin-bottom: 20px;">${axis.nameEN}</p>

  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0;">
    <div style="padding: 20px; background: #eff6ff; border-radius: 12px; text-align: center;">
      <div style="font-size: 36px; font-weight: bold; color: #3b82f6;">${axisScore.actual}</div>
      <div style="color: #666; margin-top: 5px;">Stan aktualny</div>
      <div style="font-size: 12px; color: #888; margin-top: 5px;">${currentLevel?.name || 'N/A'}</div>
    </div>
    <div style="padding: 20px; background: #ecfdf5; border-radius: 12px; text-align: center;">
      <div style="font-size: 36px; font-weight: bold; color: #10b981;">${axisScore.target}</div>
      <div style="color: #666; margin-top: 5px;">Cel</div>
      <div style="font-size: 12px; color: #888; margin-top: 5px;">${targetLevel?.name || 'N/A'}</div>
    </div>
    <div style="padding: 20px; background: ${gap > 0 ? '#fef2f2' : '#ecfdf5'}; border-radius: 12px; text-align: center;">
      <div style="font-size: 36px; font-weight: bold; color: ${gapColor};">${gap > 0 ? '+' : ''}${gap}</div>
      <div style="color: #666; margin-top: 5px;">Luka</div>
      <div style="font-size: 12px; color: #888; margin-top: 5px;">${gap > 2 ? 'Wysoki priorytet' : gap > 1 ? 'Średni priorytet' : 'Niski priorytet'}</div>
    </div>
  </div>

  <h3>📝 Ocena eksperta</h3>
  <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 15px 0; border-left: 4px solid #3b82f6;">
    <p style="margin: 0; line-height: 1.6;">${axisScore.justification}</p>
  </div>

  <h3>📊 Wizualizacja postępu</h3>
  <div style="margin: 20px 0;">
    <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
      <span style="width: 80px; color: #666;">Aktualny:</span>
      <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 24px;">
        <div style="width: ${(axisScore.actual / 7) * 100}%; background: #3b82f6; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px;">
          <span style="color: white; font-size: 12px; font-weight: bold;">${axisScore.actual}/7</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
      <span style="width: 80px; color: #666;">Cel:</span>
      <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 24px;">
        <div style="width: ${(axisScore.target / 7) * 100}%; background: #10b981; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px;">
          <span style="color: white; font-size: 12px; font-weight: bold;">${axisScore.target}/7</span>
        </div>
      </div>
    </div>
  </div>

  ${gap > 0 ? `
  <h3>🎯 Rekomendowane działania</h3>
  <ul style="margin: 15px 0; line-height: 1.8;">
    <li>Przeprowadzenie szczegółowej analizy obecnych praktyk w obszarze ${axis.namePL.toLowerCase()}</li>
    <li>Zdefiniowanie konkretnych inicjatyw transformacyjnych z przypisanymi właścicielami</li>
    <li>Ustalenie kamieni milowych i KPI dla monitorowania postępu</li>
    <li>Alokacja odpowiednich zasobów (ludzie, budżet, technologia)</li>
    ${gap > 2 ? `<li><strong>Priorytet wysoki:</strong> Rozważenie zaangażowania zewnętrznych ekspertów lub partnerów technologicznych</li>` : ''}
  </ul>
  ` : `
  <div style="padding: 15px; background: #ecfdf5; border-radius: 8px; margin: 15px 0;">
    <strong>✅ Cel osiągnięty!</strong>
    <p style="margin: 10px 0 0 0; color: #666;">Organizacja osiągnęła założony poziom dojrzałości w tym obszarze. Rekomendowane jest utrzymanie obecnych praktyk i ciągłe monitorowanie.</p>
  </div>
  `}
</div>
`;
}

function generateGapAnalysisSection(axisScores) {
  const axes = Object.entries(axisScores);
  const sortedByGap = [...axes].sort((a, b) => (b[1].target - b[1].actual) - (a[1].target - a[1].actual));
  
  return `
<div class="gap-analysis-section">
  <h2>🔍 Analiza Luk</h2>
  
  <p style="margin: 20px 0;">
    Poniższa analiza przedstawia szczegółowe zestawienie luk między stanem aktualnym a celami transformacji cyfrowej 
    we wszystkich 7 osiach DRD.
  </p>

  <h3>📊 Macierz Luk</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background: #1a1a2e; color: white;">
      <th style="padding: 12px; text-align: left;">Oś</th>
      <th style="padding: 12px; text-align: center;">Aktualny</th>
      <th style="padding: 12px; text-align: center;">Cel</th>
      <th style="padding: 12px; text-align: center;">Luka</th>
      <th style="padding: 12px; text-align: center;">Priorytet</th>
    </tr>
    ${sortedByGap.map(([key, score], idx) => {
      const gap = score.target - score.actual;
      const priority = gap > 2 ? '🔴 Wysoki' : gap > 1 ? '🟡 Średni' : gap > 0 ? '🟢 Niski' : '✅ OK';
      const bgColor = idx % 2 === 0 ? '#f8f9fa' : 'white';
      return `
    <tr style="background: ${bgColor};">
      <td style="padding: 12px; border: 1px solid #e0e0e0;">${AXIS_MAP[key].icon} ${AXIS_MAP[key].namePL}</td>
      <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold; color: #3b82f6;">${score.actual}</td>
      <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold; color: #10b981;">${score.target}</td>
      <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold; color: ${gap > 2 ? '#ef4444' : gap > 1 ? '#f59e0b' : '#10b981'};">${gap}</td>
      <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">${priority}</td>
    </tr>
      `;
    }).join('')}
  </table>

  <h3>📈 Rozkład Priorytetów</h3>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0;">
    <div style="padding: 20px; background: #fef2f2; border-radius: 12px; text-align: center;">
      <div style="font-size: 36px; font-weight: bold; color: #ef4444;">${sortedByGap.filter(([_, s]) => (s.target - s.actual) > 2).length}</div>
      <div style="color: #666; margin-top: 5px;">Wysoki priorytet</div>
    </div>
    <div style="padding: 20px; background: #fffbeb; border-radius: 12px; text-align: center;">
      <div style="font-size: 36px; font-weight: bold; color: #f59e0b;">${sortedByGap.filter(([_, s]) => { const g = s.target - s.actual; return g > 1 && g <= 2; }).length}</div>
      <div style="color: #666; margin-top: 5px;">Średni priorytet</div>
    </div>
    <div style="padding: 20px; background: #ecfdf5; border-radius: 12px; text-align: center;">
      <div style="font-size: 36px; font-weight: bold; color: #10b981;">${sortedByGap.filter(([_, s]) => { const g = s.target - s.actual; return g <= 1; }).length}</div>
      <div style="color: #666; margin-top: 5px;">Niski priorytet / OK</div>
    </div>
  </div>
</div>
`;
}

function generateRecommendationsSection(axisScores) {
  const axes = Object.entries(axisScores);
  const sortedByGap = [...axes].sort((a, b) => (b[1].target - b[1].actual) - (a[1].target - a[1].actual));
  const topPriorities = sortedByGap.filter(([_, s]) => (s.target - s.actual) > 1).slice(0, 3);
  
  return `
<div class="recommendations-section">
  <h2>💡 Rekomendacje Strategiczne</h2>
  
  <div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
    <p style="margin: 0; font-size: 16px;">
      Na podstawie przeprowadzonej diagnozy, przedstawiamy kluczowe rekomendacje strategiczne 
      dla dalszej transformacji cyfrowej organizacji.
    </p>
  </div>

  <h3>🎯 Priorytety krótkoterminowe (0-6 miesięcy)</h3>
  ${topPriorities.length > 0 ? `
  <ol style="margin: 15px 0; line-height: 1.8;">
    ${topPriorities.map(([key, score]) => `
    <li style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #ef4444;">
      <strong>${AXIS_MAP[key].icon} ${AXIS_MAP[key].namePL}</strong> (luka: ${score.target - score.actual} pkt)
      <ul style="margin-top: 10px; color: #666;">
        <li>Przeprowadzenie szczegółowego assessment'u obecnych możliwości</li>
        <li>Zdefiniowanie quick-wins możliwych do realizacji w ciągu 90 dni</li>
        <li>Powołanie zespołu odpowiedzialnego za transformację w tym obszarze</li>
      </ul>
    </li>
    `).join('')}
  </ol>
  ` : `
  <p style="padding: 15px; background: #ecfdf5; border-radius: 8px;">
    ✅ Organizacja nie ma krytycznych luk wymagających natychmiastowej interwencji.
  </p>
  `}

  <h3>🚀 Priorytety średnioterminowe (6-18 miesięcy)</h3>
  <ul style="margin: 15px 0; line-height: 1.8;">
    <li>Wdrożenie zintegrowanego programu transformacji cyfrowej obejmującego wszystkie 7 osi DRD</li>
    <li>Budowa wewnętrznych kompetencji i centrum doskonałości (CoE) dla transformacji cyfrowej</li>
    <li>Implementacja systemu ciągłego monitorowania dojrzałości cyfrowej</li>
    <li>Rozwój partnerstw strategicznych z dostawcami technologii i firmami konsultingowymi</li>
  </ul>

  <h3>🔭 Wizja długoterminowa (18+ miesięcy)</h3>
  <ul style="margin: 15px 0; line-height: 1.8;">
    <li>Osiągnięcie pozycji lidera cyfrowego w branży</li>
    <li>Pełna integracja technologii AI/ML w kluczowych procesach biznesowych</li>
    <li>Rozwój innowacyjnych produktów i usług cyfrowych</li>
    <li>Kultura organizacyjna w pełni zorientowana na ciągłą transformację</li>
  </ul>

  <h3>💰 Szacunkowy budżet transformacji</h3>
  <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 0; color: #666;">
      <strong>Uwaga:</strong> Szczegółowy budżet powinien zostać opracowany po zdefiniowaniu konkretnych inicjatyw 
      i zatwierdzeniu planu transformacji. Typowe nakłady na kompleksową transformację cyfrową wynoszą 
      3-7% rocznych przychodów organizacji.
    </p>
  </div>
</div>
`;
}

function generateNextStepsSection() {
  return `
<div class="next-steps-section">
  <h2>📋 Następne Kroki</h2>
  
  <div style="margin: 20px 0;">
    <p>Aby skutecznie wykorzystać wyniki niniejszej diagnozy, rekomendujemy podjęcie następujących kroków:</p>
  </div>

  <div style="margin: 20px 0;">
    <div style="display: flex; gap: 15px; margin: 15px 0; align-items: flex-start;">
      <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0;">1</div>
      <div>
        <h4 style="margin: 0 0 10px 0;">Prezentacja wyników zarządowi</h4>
        <p style="margin: 0; color: #666;">Przedstawienie kluczowych wniosków i rekomendacji zespołowi zarządzającemu. Uzyskanie buy-in dla dalszych działań transformacyjnych.</p>
      </div>
    </div>
    
    <div style="display: flex; gap: 15px; margin: 15px 0; align-items: flex-start;">
      <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0;">2</div>
      <div>
        <h4 style="margin: 0 0 10px 0;">Warsztaty priorytetyzacji</h4>
        <p style="margin: 0; color: #666;">Przeprowadzenie warsztatów z kluczowymi interesariuszami w celu ustalenia priorytetów i sekwencji działań transformacyjnych.</p>
      </div>
    </div>
    
    <div style="display: flex; gap: 15px; margin: 15px 0; align-items: flex-start;">
      <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0;">3</div>
      <div>
        <h4 style="margin: 0 0 10px 0;">Opracowanie roadmapy</h4>
        <p style="margin: 0; color: #666;">Stworzenie szczegółowej mapy drogowej transformacji z konkretnymi inicjatywami, kamieniami milowymi i KPI.</p>
      </div>
    </div>
    
    <div style="display: flex; gap: 15px; margin: 15px 0; align-items: flex-start;">
      <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0;">4</div>
      <div>
        <h4 style="margin: 0 0 10px 0;">Quick wins</h4>
        <p style="margin: 0; color: #666;">Identyfikacja i realizacja szybkich zwycięstw (90 dni), które zbudują momentum i wiarę w sukces transformacji.</p>
      </div>
    </div>
    
    <div style="display: flex; gap: 15px; margin: 15px 0; align-items: flex-start;">
      <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0;">5</div>
      <div>
        <h4 style="margin: 0 0 10px 0;">Governance i monitoring</h4>
        <p style="margin: 0; color: #666;">Ustanowienie struktury zarządzania transformacją i systemu regularnego monitorowania postępów.</p>
      </div>
    </div>
  </div>

  <div style="margin-top: 30px; padding: 20px; background: #f0f9ff; border-radius: 12px; border: 1px solid #bae6fd;">
    <h4 style="margin: 0 0 10px 0;">📞 Wsparcie ekspertów DRD</h4>
    <p style="margin: 0; color: #666;">
      Nasz zespół ekspertów jest dostępny, aby wspierać organizację na każdym etapie transformacji cyfrowej. 
      Skontaktuj się z nami, aby omówić szczegóły wdrożenia rekomendacji z niniejszego raportu.
    </p>
  </div>
</div>
`;
}

function generateAppendixSection(axisScores) {
  return `
<div class="appendix-section">
  <h2>📎 Załączniki</h2>
  
  <h3>A. Szczegółowe dane oceny</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
    <tr style="background: #1a1a2e; color: white;">
      <th style="padding: 10px; text-align: left;">Oś</th>
      <th style="padding: 10px; text-align: center;">Aktualny</th>
      <th style="padding: 10px; text-align: center;">Cel</th>
      <th style="padding: 10px; text-align: left;">Uzasadnienie</th>
    </tr>
    ${Object.entries(axisScores).map(([key, score], idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#f8f9fa' : 'white'};">
      <td style="padding: 10px; border: 1px solid #e0e0e0;">${AXIS_MAP[key].icon} ${AXIS_MAP[key].namePL}</td>
      <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center;">${score.actual}</td>
      <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center;">${score.target}</td>
      <td style="padding: 10px; border: 1px solid #e0e0e0; font-size: 12px; color: #666;">${score.justification}</td>
    </tr>
    `).join('')}
  </table>

  <h3>B. Definicje poziomów dojrzałości</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
    <tr style="background: #1a1a2e; color: white;">
      <th style="padding: 10px; text-align: center;">Poziom</th>
      <th style="padding: 10px; text-align: left;">Nazwa</th>
      <th style="padding: 10px; text-align: left;">Charakterystyka</th>
    </tr>
    ${Object.entries(MATURITY_LEVELS).map(([level, data], idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#f8f9fa' : 'white'};">
      <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold;">${level}</td>
      <td style="padding: 10px; border: 1px solid #e0e0e0;">${data.name}</td>
      <td style="padding: 10px; border: 1px solid #e0e0e0; color: #666;">${data.description}</td>
    </tr>
    `).join('')}
  </table>

  <h3>C. Informacje o metodologii DRD</h3>
  <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 0 0 10px 0;"><strong>Digital Readiness Diagnosis (DRD)</strong></p>
    <p style="margin: 0; color: #666; font-size: 14px;">
      Metodologia DRD została opracowana w oparciu o wieloletnie doświadczenie w realizacji projektów transformacji cyfrowej 
      oraz najlepsze światowe praktyki, w tym standard SIRI (Smart Industry Readiness Index) opracowany przez 
      Singapore Economic Development Board. DRD dostosowuje te globalne standardy do specyfiki polskiego i europejskiego rynku.
    </p>
  </div>
</div>
`;
}

// Main function to generate sections for a report
function generateReportSections(report) {
  const sections = [];
  let orderIndex = 0;
  
  const assessmentData = JSON.parse(report.assessment_snapshot);
  const axisScores = assessmentData.axisScores;
  const generatedAt = assessmentData.generatedAt || report.generated_at;
  
  // 1. Cover Page
  sections.push({
    id: uuidv4(),
    report_id: report.id,
    section_type: 'cover_page',
    axis_id: null,
    area_id: null,
    title: 'Strona Tytułowa',
    content: generateCoverPageContent(report.title, 'Organizacja', generatedAt),
    data_snapshot: JSON.stringify({ title: report.title, generatedAt }),
    order_index: orderIndex++,
    is_ai_generated: 0,
    last_edited_by: report.created_by
  });
  
  // 2. Executive Summary
  sections.push({
    id: uuidv4(),
    report_id: report.id,
    section_type: 'executive_summary',
    axis_id: null,
    area_id: null,
    title: 'Streszczenie Wykonawcze',
    content: generateExecutiveSummary(axisScores, report.title),
    data_snapshot: JSON.stringify({ axisScores, title: report.title }),
    order_index: orderIndex++,
    is_ai_generated: 0,
    last_edited_by: report.created_by
  });
  
  // 3. Methodology
  sections.push({
    id: uuidv4(),
    report_id: report.id,
    section_type: 'methodology',
    axis_id: null,
    area_id: null,
    title: 'Metodologia DRD',
    content: generateMethodologySection(),
    data_snapshot: JSON.stringify({}),
    order_index: orderIndex++,
    is_ai_generated: 0,
    last_edited_by: report.created_by
  });
  
  // 4. Axis Detail Sections (7 axes)
  for (const [axisKey, axisScore] of Object.entries(axisScores)) {
    const axis = AXIS_MAP[axisKey];
    sections.push({
      id: uuidv4(),
      report_id: report.id,
      section_type: 'axis_detail',
      axis_id: axisKey,
      area_id: null,
      title: `${axis.icon} ${axis.namePL}`,
      content: generateAxisDetailSection(axisKey, axisScore),
      data_snapshot: JSON.stringify({ axisKey, axisScore, axis }),
      order_index: orderIndex++,
      is_ai_generated: 0,
      last_edited_by: report.created_by
    });
  }
  
  // 5. Gap Analysis
  sections.push({
    id: uuidv4(),
    report_id: report.id,
    section_type: 'gap_analysis',
    axis_id: null,
    area_id: null,
    title: 'Analiza Luk',
    content: generateGapAnalysisSection(axisScores),
    data_snapshot: JSON.stringify({ axisScores }),
    order_index: orderIndex++,
    is_ai_generated: 0,
    last_edited_by: report.created_by
  });
  
  // 6. Recommendations
  sections.push({
    id: uuidv4(),
    report_id: report.id,
    section_type: 'recommendations',
    axis_id: null,
    area_id: null,
    title: 'Rekomendacje Strategiczne',
    content: generateRecommendationsSection(axisScores),
    data_snapshot: JSON.stringify({ axisScores }),
    order_index: orderIndex++,
    is_ai_generated: 0,
    last_edited_by: report.created_by
  });
  
  // 7. Next Steps
  sections.push({
    id: uuidv4(),
    report_id: report.id,
    section_type: 'next_steps',
    axis_id: null,
    area_id: null,
    title: 'Następne Kroki',
    content: generateNextStepsSection(),
    data_snapshot: JSON.stringify({}),
    order_index: orderIndex++,
    is_ai_generated: 0,
    last_edited_by: report.created_by
  });
  
  // 8. Appendix
  sections.push({
    id: uuidv4(),
    report_id: report.id,
    section_type: 'appendix',
    axis_id: null,
    area_id: null,
    title: 'Załączniki',
    content: generateAppendixSection(axisScores),
    data_snapshot: JSON.stringify({ axisScores }),
    order_index: orderIndex++,
    is_ai_generated: 0,
    last_edited_by: report.created_by
  });
  
  return sections;
}

// Promisified db functions
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting report sections generation...\n');
    
    // Get all reports
    const reports = await dbAll(`
      SELECT id, title, assessment_snapshot, generated_at, created_by, organization_id 
      FROM assessment_reports 
      WHERE organization_id = '5adb0b59-3130-4f50-bae5-77a9bbc84d5d'
    `);
    
    console.log(`📊 Found ${reports.length} reports to process\n`);
    
    // Delete existing sections first
    await dbRun('DELETE FROM report_sections WHERE report_id IN (SELECT id FROM assessment_reports WHERE organization_id = ?)', ['5adb0b59-3130-4f50-bae5-77a9bbc84d5d']);
    console.log('🗑️  Cleared existing sections\n');
    
    let totalSections = 0;
    
    for (const report of reports) {
      console.log(`📝 Processing: ${report.title}`);
      
      const sections = generateReportSections(report);
      
      for (const section of sections) {
        await dbRun(`
          INSERT INTO report_sections (id, report_id, section_type, axis_id, area_id, title, content, data_snapshot, order_index, is_ai_generated, last_edited_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          section.id,
          section.report_id,
          section.section_type,
          section.axis_id,
          section.area_id,
          section.title,
          section.content,
          section.data_snapshot,
          section.order_index,
          section.is_ai_generated,
          section.last_edited_by
        ]);
      }
      
      totalSections += sections.length;
      console.log(`   ✅ Created ${sections.length} sections\n`);
    }
    
    console.log(`\n🎉 Done! Created ${totalSections} sections for ${reports.length} reports.`);
    
    // Verify
    const countResult = await dbAll('SELECT COUNT(*) as count FROM report_sections');
    console.log(`📊 Total sections in database: ${countResult[0].count}`);
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    db.close();
    process.exit(1);
  }
}

main();
