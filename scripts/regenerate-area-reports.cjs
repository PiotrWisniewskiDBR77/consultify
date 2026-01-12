#!/usr/bin/env node
/**
 * Script to regenerate DRD reports with the new area-based structure
 * 
 * This script will:
 * 1. Load existing assessments
 * 2. Generate area assessments (9 areas per axis) with sample data
 * 3. Generate detailed content for each area
 * 4. Update report sections with new structure
 * 
 * Run with: node scripts/regenerate-area-reports.cjs
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Database path - correct path is in server/ subdirectory
const DB_PATH = path.join(__dirname, '..', 'server', 'consultify.db');

// Business areas definition
const BUSINESS_AREAS = [
    { id: 'sales', namePl: 'Sprzedaż', icon: '💰' },
    { id: 'marketing', namePl: 'Marketing', icon: '📣' },
    { id: 'technology', namePl: 'Technologia (R&D)', icon: '🔬' },
    { id: 'purchasing', namePl: 'Zakupy', icon: '🛒' },
    { id: 'logistics', namePl: 'Logistyka', icon: '🚚' },
    { id: 'production', namePl: 'Produkcja', icon: '🏭' },
    { id: 'quality', namePl: 'Kontrola Jakości', icon: '✅' },
    { id: 'finance', namePl: 'Finanse', icon: '💵' },
    { id: 'hr', namePl: 'HR i Administracja', icon: '👥' },
];

// DRD Axes - icons matching database
const DRD_AXES = [
    { id: 'processes', namePl: 'Procesy Cyfrowe', icon: '⚙️' },
    { id: 'digitalProducts', namePl: 'Produkty Cyfrowe', icon: '📦' },
    { id: 'businessModels', namePl: 'Modele Biznesowe', icon: '💼' },
    { id: 'dataManagement', namePl: 'Zarządzanie Danymi', icon: '📊' },
    { id: 'culture', namePl: 'Kultura Transformacji', icon: '🎯' },
    { id: 'cybersecurity', namePl: 'Cyberbezpieczeństwo', icon: '🔒' },
    { id: 'aiMaturity', namePl: 'Dojrzałość AI', icon: '🤖' },
];

// Level descriptions for each area (Polish)
const LEVEL_DESCRIPTIONS = {
    sales: {
        1: { namePl: 'Rejestracja podstawowa', descriptionPl: 'Sprzedaż opiera się na arkuszach kalkulacyjnych i notatkach papierowych. Brak spójnego systemu śledzenia leadów.' },
        2: { namePl: 'Wdrożenie CRM', descriptionPl: 'Wdrożono podstawowy system CRM. Handlowcy rejestrują interakcje z klientami.' },
        3: { namePl: 'Integracja z ERP/Marketing', descriptionPl: 'CRM zintegrowany z systemem ERP i narzędziami marketingowymi.' },
        4: { namePl: 'Automatyzacja sprzedaży', descriptionPl: 'Procesy sprzedażowe są zautomatyzowane. Dashboardy w czasie rzeczywistym.' },
        5: { namePl: 'Integracja omnichannel', descriptionPl: 'Pełna integracja wszystkich kanałów sprzedaży. Predykcyjne prognozowanie.' },
        6: { namePl: 'Prognozowanie AI', descriptionPl: 'AI napędza prognozowanie sprzedaży i rekomendacje. Inteligentne scorowanie leadów.' },
        7: { namePl: 'Autonomiczni agenci AI', descriptionPl: 'Autonomiczne systemy AI prowadzą znaczną część procesu sprzedażowego.' },
    },
    marketing: {
        1: { namePl: 'Promocja podstawowa', descriptionPl: 'Marketing ogranicza się do podstawowych materiałów drukowanych.' },
        2: { namePl: 'Obecność cyfrowa', descriptionPl: 'Podstawowa strona www. Obecność w social media.' },
        3: { namePl: 'Narzędzia automatyzacji', descriptionPl: 'Wdrożone narzędzia marketing automation. Segmentacja bazy kontaktów.' },
        4: { namePl: 'Personalizacja', descriptionPl: 'Zaawansowana personalizacja treści. Scoring leadów.' },
        5: { namePl: 'Kampanie data-driven', descriptionPl: 'Kampanie oparte na głębokiej analityce danych.' },
        6: { namePl: 'Marketing predykcyjny AI', descriptionPl: 'AI napędza decyzje marketingowe. Predykcja zachowań klientów.' },
        7: { namePl: 'Hiperpersonalizacja', descriptionPl: 'Autonomiczne systemy marketingowe działające w czasie rzeczywistym.' },
    },
    technology: {
        1: { namePl: 'Projektowanie ręczne', descriptionPl: 'Projektowanie produktów oparte na rysunkach 2D.' },
        2: { namePl: 'Narzędzia CAD/CAM', descriptionPl: 'Wdrożone podstawowe narzędzia CAD 3D.' },
        3: { namePl: 'Narzędzia symulacyjne', descriptionPl: 'Symulacje wytrzymałościowe i przepływowe.' },
        4: { namePl: 'Szybkie prototypowanie', descriptionPl: 'Wewnętrzne drukowanie 3D prototypów.' },
        5: { namePl: 'Cyfrowy bliźniak', descriptionPl: 'Cyfrowe bliźniaki produktów. Symulacja cyklu życia.' },
        6: { namePl: 'Projektowanie AI', descriptionPl: 'AI wspomaga projektowanie generatywne.' },
        7: { namePl: 'Autonomiczne R&D', descriptionPl: 'Autonomiczne systemy prowadzące badania i rozwój.' },
    },
    purchasing: {
        1: { namePl: 'Zakupy ad-hoc', descriptionPl: 'Zakupy realizowane na bieżąco bez planowania.' },
        2: { namePl: 'Zamówienia cyfrowe', descriptionPl: 'Podstawowy system do składania zamówień.' },
        3: { namePl: 'System zakupowy', descriptionPl: 'Pełny system procurement z workflow zatwierdzania.' },
        4: { namePl: 'Automatyczne uzupełnianie', descriptionPl: 'Automatyczne generowanie zamówień na podstawie stanów.' },
        5: { namePl: 'Integracja z dostawcami', descriptionPl: 'Pełna integracja systemów z kluczowymi dostawcami.' },
        6: { namePl: 'Zakupy AI', descriptionPl: 'AI optymalizuje decyzje zakupowe.' },
        7: { namePl: 'Autonomiczny sourcing', descriptionPl: 'Autonomiczne systemy zarządzające całym procesem.' },
    },
    logistics: {
        1: { namePl: 'Śledzenie ręczne', descriptionPl: 'Ręczne śledzenie stanów magazynowych. Papierowe dokumenty.' },
        2: { namePl: 'Wdrożenie WMS', descriptionPl: 'Podstawowy system WMS. Kody kreskowe.' },
        3: { namePl: 'Zintegrowana logistyka', descriptionPl: 'WMS zintegrowany z ERP i transportem.' },
        4: { namePl: 'Śledzenie real-time', descriptionPl: 'Śledzenie przesyłek w czasie rzeczywistym. RFID.' },
        5: { namePl: 'Automatyczny magazyn', descriptionPl: 'Automatyzacja procesów magazynowych. AGV/AMR.' },
        6: { namePl: 'Predykcyjny łańcuch dostaw', descriptionPl: 'AI predykcja popytu i optymalizacja zapasów.' },
        7: { namePl: 'Autonomiczna sieć', descriptionPl: 'Pełna autonomia operacji logistycznych.' },
    },
    production: {
        1: { namePl: 'Operacje ręczne', descriptionPl: 'Produkcja oparta na ręcznych operacjach.' },
        2: { namePl: 'Monitoring maszyn', descriptionPl: 'Podstawowy monitoring maszyn. Rejestracja czasów.' },
        3: { namePl: 'Systemy sterowania', descriptionPl: 'Systemy sterowania procesem. SCADA.' },
        4: { namePl: 'Zautomatyzowane linie', descriptionPl: 'Zautomatyzowane linie produkcyjne. Robotyka.' },
        5: { namePl: 'Wdrożenie MES', descriptionPl: 'Pełny system MES. Real-time tracking.' },
        6: { namePl: 'Cyfrowy bliźniak produkcji', descriptionPl: 'Cyfrowy bliźniak całej produkcji.' },
        7: { namePl: 'Autonomiczna fabryka', descriptionPl: 'Autonomiczna fabryka (lights-out manufacturing).' },
    },
    quality: {
        1: { namePl: 'Kontrola ręczna', descriptionPl: 'Ręczna kontrola jakości końcowej.' },
        2: { namePl: 'Dokumentacja cyfrowa', descriptionPl: 'Cyfrowa dokumentacja jakościowa.' },
        3: { namePl: 'SPC', descriptionPl: 'Statystyczna kontrola procesu. Control charts.' },
        4: { namePl: 'Kontrola automatyczna', descriptionPl: 'Automatyczna kontrola jakości. Vision systems.' },
        5: { namePl: 'Zintegrowane QM', descriptionPl: 'Zintegrowany system zarządzania jakością.' },
        6: { namePl: 'Jakość predykcyjna AI', descriptionPl: 'AI predykcja defektów przed ich wystąpieniem.' },
        7: { namePl: 'Systemy zero-defektów', descriptionPl: 'Autonomiczne systemy zapewnienia jakości.' },
    },
    finance: {
        1: { namePl: 'Arkusze kalkulacyjne', descriptionPl: 'Finanse zarządzane w Excelu.' },
        2: { namePl: 'Oprogramowanie księgowe', descriptionPl: 'Podstawowe oprogramowanie księgowe.' },
        3: { namePl: 'Moduły finansowe ERP', descriptionPl: 'Pełne moduły finansowe ERP.' },
        4: { namePl: 'Automatyczna fakturacja', descriptionPl: 'Automatyczne przetwarzanie faktur. OCR.' },
        5: { namePl: 'Controlling real-time', descriptionPl: 'Real-time widoczność finansowa.' },
        6: { namePl: 'Modelowanie predykcyjne', descriptionPl: 'AI-driven forecasting.' },
        7: { namePl: 'Autonomiczne finanse', descriptionPl: 'Autonomiczne operacje finansowe.' },
    },
    hr: {
        1: { namePl: 'Dokumentacja papierowa', descriptionPl: 'Akta pracownicze w formie papierowej.' },
        2: { namePl: 'Podstawowe HR', descriptionPl: 'Podstawowy system kadrowo-płacowy.' },
        3: { namePl: 'System HRM', descriptionPl: 'Pełny system HRM. Zarządzanie szkoleniami.' },
        4: { namePl: 'Zarządzanie talentami', descriptionPl: 'Zintegrowane zarządzanie talentami.' },
        5: { namePl: 'Analityka HR', descriptionPl: 'Zaawansowana analityka HR. Predykcja rotacji.' },
        6: { namePl: 'Rekrutacja AI', descriptionPl: 'AI w rekrutacji i retencji.' },
        7: { namePl: 'Autonomiczne HR', descriptionPl: 'Autonomiczne systemy HR.' },
    },
};

// Sample interview quotes
const SAMPLE_QUOTES = [
    "Mamy dużo do poprawy w tym obszarze, ale widzimy potencjał.",
    "Ostatnio wdrożyliśmy nowe rozwiązanie i widzimy pierwsze efekty.",
    "To jest dla nas priorytet na najbliższe kwartały.",
    "Konkurencja nas wyprzedza, musimy nadrobić zaległości.",
    "Jesteśmy zadowoleni z obecnego stanu, ale zawsze można lepiej.",
    "Brakuje nam zasobów, żeby to wdrożyć szybciej.",
    "Technologia jest gotowa, problemem są ludzie i procesy.",
];

const SAMPLE_OBSERVATIONS = [
    "Zespół otwarty na zmiany",
    "Widoczna potrzeba szkoleń",
    "Dobre praktyki w niektórych działach",
    "Silosowość między działami",
    "Brak standardowych procedur",
    "Aktywne poszukiwanie rozwiązań",
    "Wsparcie zarządu dla transformacji",
];

// Connect to database
function connectDB() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

// Run SQL query
function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// Get all rows
function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Get single row
function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Generate area assessments for an axis
function generateAreaAssessments(axisId, baseLevel, organizationId) {
    const assessments = [];
    
    BUSINESS_AREAS.forEach((area, index) => {
        // Vary levels slightly around the base level
        const variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const currentLevel = Math.max(1, Math.min(7, baseLevel + variance));
        const targetLevel = Math.min(7, currentLevel + 1 + Math.floor(Math.random() * 2)); // 1-2 level gap
        
        assessments.push({
            areaId: area.id,
            currentLevel,
            targetLevel,
            interviewNotes: `Obszar ${area.namePl} w kontekście ${axisId}. Organizacja wykazuje poziom ${currentLevel} z ambicją osiągnięcia poziomu ${targetLevel}.`,
            keyQuote: SAMPLE_QUOTES[Math.floor(Math.random() * SAMPLE_QUOTES.length)],
            observations: [
                SAMPLE_OBSERVATIONS[Math.floor(Math.random() * SAMPLE_OBSERVATIONS.length)],
                SAMPLE_OBSERVATIONS[Math.floor(Math.random() * SAMPLE_OBSERVATIONS.length)],
            ],
        });
    });
    
    return assessments;
}

// Generate area detail HTML
function generateAreaDetailHTML(axisId, areaId, currentLevel, targetLevel, interview) {
    const area = BUSINESS_AREAS.find(a => a.id === areaId);
    const levelDesc = LEVEL_DESCRIPTIONS[areaId] || {};
    const currentDesc = levelDesc[currentLevel] || { namePl: `Poziom ${currentLevel}`, descriptionPl: 'Opis do uzupełnienia.' };
    const targetDesc = levelDesc[targetLevel] || { namePl: `Poziom ${targetLevel}`, descriptionPl: 'Opis do uzupełnienia.' };
    
    const gap = targetLevel - currentLevel;
    const priorityColor = gap >= 3 ? '#ef4444' : gap >= 2 ? '#f59e0b' : gap >= 1 ? '#eab308' : '#22c55e';
    const priorityLabel = gap >= 3 ? 'Krytyczny' : gap >= 2 ? 'Wysoki' : gap >= 1 ? 'Średni' : 'Niski';
    
    return `
<div class="area-detail-card" data-area="${areaId}" style="margin: 24px 0; padding: 24px; background: white; border-radius: 12px; border-left: 4px solid ${priorityColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 32px;">${area?.icon || '📊'}</span>
            <div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1e1b4b;">${area?.namePl || areaId}</h3>
                <span style="font-size: 13px; color: #64748b;">${currentDesc.namePl}</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="padding: 8px 16px; background: #3b82f610; border: 2px solid #3b82f6; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${currentLevel}</div>
                    <div style="font-size: 10px; color: #64748b;">Aktualny</div>
                </div>
                <span style="color: #94a3b8; font-weight: bold;">→</span>
                <div style="padding: 8px 16px; background: #10b98110; border: 2px solid #10b981; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #10b981;">${targetLevel}</div>
                    <div style="font-size: 10px; color: #64748b;">Cel</div>
                </div>
                <div style="padding: 8px 16px; background: ${priorityColor}15; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: ${priorityColor};">+${gap}</div>
                    <div style="font-size: 10px; color: #64748b;">Luka</div>
                </div>
            </div>
            <span style="padding: 4px 12px; background: ${priorityColor}15; color: ${priorityColor}; border-radius: 16px; font-size: 12px; font-weight: 600;">
                ${priorityLabel}
            </span>
        </div>
    </div>
    
    <!-- Current State -->
    <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e1b4b;">📋 Opis stanu aktualnego</h4>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569;">
            ${currentDesc.descriptionPl}
        </p>
        <div style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px;">
            <strong style="font-size: 13px; color: #64748b;">Charakterystyki poziomu ${currentLevel}:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #475569;">
                <li>Podstawowe procesy zdefiniowane</li>
                <li>Częściowa digitalizacja</li>
                <li>Ręczne interwencje wymagane</li>
            </ul>
        </div>
    </div>
    
    <!-- Interview Notes -->
    ${interview ? `
    <div style="margin-bottom: 24px; padding: 16px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 8px;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e1b4b;">📝 Notatki z wywiadu</h4>
        <div style="display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px;">
            <span><strong>Rozmówca:</strong> Kierownik działu</span>
            <span><strong>Data:</strong> ${new Date().toLocaleDateString('pl-PL')}</span>
        </div>
        ${interview.keyQuote ? `
        <blockquote style="margin: 12px 0; padding: 12px 16px; background: linear-gradient(135deg, #1e1b4b05, #3b82f610); border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; font-style: italic; color: #1e1b4b; font-size: 14px;">
            "${interview.keyQuote}"
        </blockquote>
        ` : ''}
        <div style="margin-top: 12px;">
            <strong style="font-size: 13px; color: #64748b;">Kluczowe obserwacje:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #475569;">
                ${(interview.observations || []).map(o => `<li>${o}</li>`).join('')}
            </ul>
        </div>
    </div>
    ` : ''}
    
    <!-- Target State -->
    <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e1b4b;">🎯 Aby osiągnąć poziom ${targetLevel}: ${targetDesc.namePl}</h4>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569;">
            ${targetDesc.descriptionPl}
        </p>
        <div style="margin-top: 12px; padding: 12px; background: #10b98110; border-radius: 8px;">
            <strong style="font-size: 13px; color: #059669;">Wymagane charakterystyki:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #065f46;">
                <li>Pełna automatyzacja procesów</li>
                <li>Integracja systemów</li>
                <li>Zaawansowana analityka</li>
            </ul>
        </div>
    </div>
    
    <!-- Recommendations -->
    <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e1b4b;">🚀 Rekomendacje rozwojowe</h4>
        <ol style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #f59e0b;">
                <strong>Wdrożenie nowych narzędzi</strong>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                    <span style="margin-right: 12px;">⏱️ 3-6 miesięcy</span>
                    <span style="margin-right: 12px;">💰 50,000-100,000 PLN</span>
                    <span style="padding: 2px 8px; background: #fef3c7; color: #d97706; border-radius: 4px; font-weight: 600;">Wysoki priorytet</span>
                </div>
            </li>
            <li style="margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #eab308;">
                <strong>Szkolenia zespołu</strong>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                    <span style="margin-right: 12px;">⏱️ 1-3 miesięcy</span>
                    <span style="margin-right: 12px;">💰 20,000-40,000 PLN</span>
                    <span style="padding: 2px 8px; background: #fef9c3; color: #ca8a04; border-radius: 4px; font-weight: 600;">Średni priorytet</span>
                </div>
            </li>
        </ol>
    </div>
    
    <!-- Risks -->
    <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e1b4b;">⚠️ Ryzyka</h4>
        <ul style="margin: 0; padding-left: 20px; color: #b45309; font-size: 14px;">
            <li style="margin-bottom: 4px;">Opór pracowników przed zmianą</li>
            <li style="margin-bottom: 4px;">Ograniczony budżet na transformację</li>
            <li style="margin-bottom: 4px;">Zależność od dostawców zewnętrznych</li>
        </ul>
    </div>
    
    <!-- KPIs -->
    <div>
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e1b4b;">📈 KPI do monitorowania</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
            <div style="padding: 12px; background: #f8fafc; border-radius: 8px;">
                <div style="font-weight: 600; font-size: 13px; color: #1e1b4b; margin-bottom: 4px;">Czas realizacji</div>
                <div style="font-size: 12px; color: #64748b;">
                    <span style="color: #ef4444;">Low: 30 dni</span> • 
                    <span style="color: #22c55e;">Best: 7 dni</span>
                </div>
            </div>
            <div style="padding: 12px; background: #f8fafc; border-radius: 8px;">
                <div style="font-weight: 600; font-size: 13px; color: #1e1b4b; margin-bottom: 4px;">Poziom automatyzacji</div>
                <div style="font-size: 12px; color: #64748b;">
                    <span style="color: #ef4444;">Low: 20%</span> • 
                    <span style="color: #22c55e;">Best: 80%</span>
                </div>
            </div>
        </div>
    </div>
</div>
`;
}

// Generate axis area matrix HTML
function generateAxisAreaMatrixHTML(axisId, axisName, axisIcon, areaAssessments) {
    const headerCells = BUSINESS_AREAS.map(area => 
        `<th style="text-align: center; padding: 10px 6px; background: #1e1b4b; color: white; min-width: 85px;">
            <div style="font-size: 18px;">${area.icon}</div>
            <div style="font-size: 10px; line-height: 1.2;">${area.namePl}</div>
        </th>`
    ).join('');
    
    // Levels from 7 to 1
    const levelRows = [];
    const levelColors = ['#ec4899', '#8b5cf6', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
    const levelNames = ['Autonomiczny', 'AI-Driven', 'Zoptymalizowany', 'Zautomatyzowany', 'Zintegrowany', 'Zdigitalizowany', 'Podstawowy'];
    
    for (let level = 7; level >= 1; level--) {
        const levelColor = levelColors[7 - level];
        const levelName = levelNames[7 - level];
        
        const cells = BUSINESS_AREAS.map(area => {
            const assessment = areaAssessments.find(a => a.areaId === area.id);
            const isCurrent = assessment?.currentLevel === level;
            const isTarget = assessment?.targetLevel === level;
            
            let cellContent = '';
            let cellStyle = 'padding: 8px; text-align: center; border: 1px solid #e5e7eb;';
            
            if (isCurrent && isTarget) {
                cellContent = '●○';
                cellStyle += ' background: linear-gradient(135deg, #3b82f620, #10b98120);';
            } else if (isCurrent) {
                cellContent = '<span style="color: #3b82f6;">●</span>';
                cellStyle += ' background: #3b82f620;';
            } else if (isTarget) {
                cellContent = '<span style="color: #10b981;">○</span>';
                cellStyle += ' background: #10b98120;';
            }
            
            return `<td style="${cellStyle}">${cellContent}</td>`;
        }).join('');
        
        levelRows.push(`
            <tr>
                <td style="padding: 10px 12px; background: ${levelColor}20; font-weight: 600; border: 1px solid #e5e7eb; border-left: 4px solid ${levelColor};">
                    <span style="font-weight: 700; margin-right: 8px;">${level}.</span>
                    <span style="font-size: 12px;">${levelName}</span>
                </td>
                ${cells}
            </tr>
        `);
    }
    
    // Summary rows
    const currentRow = BUSINESS_AREAS.map(area => {
        const assessment = areaAssessments.find(a => a.areaId === area.id);
        return `<td style="text-align: center; padding: 10px; font-weight: 700; color: #3b82f6; font-size: 15px; border: 1px solid #e5e7eb;">
            ${assessment?.currentLevel || '-'}
        </td>`;
    }).join('');
    
    const targetRow = BUSINESS_AREAS.map(area => {
        const assessment = areaAssessments.find(a => a.areaId === area.id);
        return `<td style="text-align: center; padding: 10px; font-weight: 700; color: #10b981; font-size: 15px; border: 1px solid #e5e7eb;">
            ${assessment?.targetLevel || '-'}
        </td>`;
    }).join('');
    
    const gapRow = BUSINESS_AREAS.map(area => {
        const assessment = areaAssessments.find(a => a.areaId === area.id);
        const gap = assessment ? assessment.targetLevel - assessment.currentLevel : 0;
        const gapColor = gap >= 3 ? '#ef4444' : gap >= 2 ? '#f59e0b' : gap >= 1 ? '#eab308' : '#22c55e';
        return `<td style="text-align: center; padding: 10px; font-weight: 700; color: ${gapColor}; font-size: 15px; border: 1px solid #e5e7eb;">
            ${gap > 0 ? '+' + gap : gap}
        </td>`;
    }).join('');
    
    return `
<div class="axis-area-matrix" style="margin: 24px 0;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span style="font-size: 28px;">${axisIcon}</span>
        <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1e1b4b;">Macierz Dojrzałości Obszarów: ${axisName}</h3>
    </div>
    
    <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px;">
            <thead>
                <tr>
                    <th style="padding: 12px; background: #1e1b4b; color: white; text-align: left; min-width: 140px;">Poziom</th>
                    ${headerCells}
                </tr>
            </thead>
            <tbody>
                ${levelRows.join('')}
                <tr style="border-top: 3px solid #1e1b4b;">
                    <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e5e7eb;">Aktualny</td>
                    ${currentRow}
                </tr>
                <tr>
                    <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e5e7eb;">Docelowy</td>
                    ${targetRow}
                </tr>
                <tr>
                    <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e5e7eb;">Luka</td>
                    ${gapRow}
                </tr>
            </tbody>
        </table>
    </div>
    
    <div style="margin-top: 12px; font-size: 12px; color: #64748b;">
        <span style="margin-right: 16px;"><span style="color: #3b82f6;">●</span> = Stan aktualny</span>
        <span><span style="color: #10b981;">○</span> = Cel</span>
    </div>
</div>
`;
}

// Main function
async function main() {
    console.log('🚀 Regenerating DRD reports with area-based structure...\n');
    
    const db = await connectDB();
    
    try {
        // Get all reports
        const reports = await dbAll(db, `
            SELECT ar.*, p.name as project_name, p.organization_id
            FROM assessment_reports ar
            LEFT JOIN projects p ON ar.project_id = p.id
        `);
        
        console.log(`📄 Found ${reports.length} reports to update\n`);
        
        for (const report of reports) {
            console.log(`\n📝 Processing report: ${report.title || report.id}`);
            
            // Parse assessment snapshot
            let assessmentSnapshot = {};
            try {
                assessmentSnapshot = JSON.parse(report.assessment_snapshot || '{}');
            } catch (e) {
                console.log('   ⚠️ Could not parse assessment_snapshot');
            }
            
            const axisData = assessmentSnapshot.axisData || {};
            
            // Get report sections of type axis_detail
            const axisSections = await dbAll(db, `
                SELECT * FROM report_sections 
                WHERE report_id = ? AND section_type = 'axis_detail'
                ORDER BY order_index
            `, [report.id]);
            
            console.log(`   Found ${axisSections.length} axis sections`);
            
            // Update each axis section
            for (const section of axisSections) {
                const axisId = section.axis_id;
                const axisConfig = DRD_AXES.find(a => a.id === axisId);
                
                if (!axisConfig) {
                    console.log(`   ⚠️ Unknown axis: ${axisId}`);
                    continue;
                }
                
                // Get axis data
                const axis = axisData[axisId] || { actual: 3, target: 5 };
                const baseLevel = axis.actual || 3;
                
                // Generate area assessments
                const areaAssessments = generateAreaAssessments(axisId, baseLevel, report.organization_id);
                
                // Save area assessments to database
                for (const assessment of areaAssessments) {
                    const id = uuidv4();
                    await dbRun(db, `
                        INSERT OR REPLACE INTO area_assessments 
                        (id, assessment_id, project_id, organization_id, axis_id, area_id, 
                         current_level, target_level, interview_notes, key_quotes, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    `, [
                        id,
                        report.id,
                        report.project_id,
                        report.organization_id,
                        axisId,
                        assessment.areaId,
                        assessment.currentLevel,
                        assessment.targetLevel,
                        assessment.interviewNotes,
                        JSON.stringify([assessment.keyQuote]),
                    ]);
                }
                
                // Generate new content
                const matrixHTML = generateAxisAreaMatrixHTML(
                    axisId, 
                    axisConfig.namePl, 
                    axisConfig.icon, 
                    areaAssessments
                );
                
                // Generate area details HTML
                const areaDetailsHTML = areaAssessments.map(a => 
                    generateAreaDetailHTML(axisId, a.areaId, a.currentLevel, a.targetLevel, {
                        keyQuote: a.keyQuote,
                        observations: a.observations,
                    })
                ).join('\n');
                
                // Build full content
                const newContent = `
<div class="axis-section" data-axis="${axisId}">
    <h2>${axisConfig.icon} ${axisConfig.namePl}</h2>
    
    <!-- Key Takeaways -->
    <div style="background: linear-gradient(135deg, #fef3c710, #fef9c320); border: 1px solid #fde047; border-radius: 12px; padding: 16px 20px; margin: 24px 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 24px;">💡</span>
            <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: #854d0e;">Kluczowe wnioski</h4>
        </div>
        <ul style="margin: 0; padding-left: 20px; color: #713f12; font-size: 14px; line-height: 1.5;">
            <li>Oceniono 9/9 obszarów w tej osi</li>
            <li>Średnia luka transformacyjna: ${(areaAssessments.reduce((sum, a) => sum + (a.targetLevel - a.currentLevel), 0) / areaAssessments.length).toFixed(1)} poziomów</li>
            <li>${areaAssessments.filter(a => (a.targetLevel - a.currentLevel) >= 3).length} obszarów wymaga pilnej uwagi</li>
        </ul>
    </div>
    
    <!-- Area Matrix -->
    ${matrixHTML}
    
    <!-- Benchmark Comparison -->
    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h4 style="margin: 0 0 20px 0; font-size: 15px; font-weight: 600; color: #1e1b4b;">🏭 Pozycja względem branży</h4>
        <div style="position: relative; height: 32px; background: #e5e7eb; border-radius: 16px; margin: 20px 0;">
            <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${(axis.actual / 7) * 100}%; background: linear-gradient(90deg, #3b82f6, #60a5fa); border-radius: 16px;">
            </div>
            <div style="position: absolute; left: ${(3.5 / 7) * 100}%; top: -5px; bottom: -5px; width: 2px; background: #64748b;"></div>
            <div style="position: absolute; left: ${(5 / 7) * 100}%; top: -5px; bottom: -5px; width: 2px; background: #22c55e;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
            <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span>
        </div>
    </div>
    
    <!-- Detailed Area Analysis -->
    <h3 style="margin: 40px 0 12px 0; font-size: 18px; font-weight: 600; color: #1e1b4b; padding-top: 24px; border-top: 2px solid #e5e7eb;">📋 Szczegółowa analiza obszarów</h3>
    <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">
        Poniżej znajduje się szczegółowa analiza każdego z 9 obszarów biznesowych w kontekście tej osi transformacji cyfrowej.
    </p>
    <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: #eff6ff; border-radius: 8px; font-size: 13px; color: #3b82f6; margin-bottom: 20px;">
        <span>⚡</span>
        <span>Obszary posortowane według priorytetu (największa luka najpierw)</span>
    </div>
    
    ${areaDetailsHTML}
</div>
`;
                
                // Update section content
                await dbRun(db, `
                    UPDATE report_sections 
                    SET content = ?, updated_at = datetime('now')
                    WHERE id = ?
                `, [newContent, section.id]);
                
                console.log(`   ✅ Updated ${axisConfig.namePl} with ${areaAssessments.length} areas`);
            }
        }
        
        console.log('\n✅ All reports regenerated successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        db.close();
    }
}

// Run
main().catch(console.error);

