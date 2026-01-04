const fs = require('fs');
const path = require('path');

const plPath = path.join(__dirname, '../public/locales/pl/translation.json');
const enPath = path.join(__dirname, '../public/locales/en/translation.json');

const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const translations = {
    "fullAssessment.intro": "Witamy w Pełnej Diagnostyce Gotowości Cyfrowej (DRD). Ocenimy 6 kluczowych osi Twojego biznesu w skali 1-7. To wygeneruje Twoją Mapę Ciepła Dojrzałości.",
    "fullAssessment.axisIntro": "Oceńmy Twój obszar: {axis}. Jak dojrzała jest firma w tym zakresie?",
    "fullAssessment.startAxis": "Rozpocznij Oś",
    "fullAssessment.currentAxis": "Bieżąca Oś",
    "fullAssessment.continue": "Kontynuuj",
    "fullAssessment.completed": "Ukończono",
    "fullAssessment.score": "Wynik",
    "fullAssessment.maturityOverview": "Przegląd Dojrzałości",
    "fullAssessment.nextStep": "Przejdź do Generatora Inicjatyw (Krok 2)",
    "fullAssessment.summary": "Oto Twój profil dojrzałości cyfrowej w 6 osiach. Na podstawie wyników, powinniśmy nadać priorytet {weakest}.",
    "fullAssessment.introMicrocopy": "Ta ocena ewaluuje Twoją organizację w 6 wymiarach modelu DRD. Wyniki są w zakresie od 1 (Nowicjusz) do 7 (Lider).",
    "fullAssessment.descriptions.processes": "Standaryzacja i Efektywność",
    "fullAssessment.descriptions.digitalProducts": "Łączność i UX",
    "fullAssessment.descriptions.businessModels": "Skalowalność i Przychody",
    "fullAssessment.descriptions.dataManagement": "Jakość i Zarządzanie",
    "fullAssessment.descriptions.culture": "Umiejętności i Nastawienie",
    "fullAssessment.descriptions.cybersecurity": "Bezpieczeństwo i Ryzyko",
    "fullAssessment.descriptions.aiMaturity": "Adopcja i Strategia",

    "fullInitiatives.intro": "Na podstawie Twoich wyników dojrzałości, wygenerowałem zestaw inicjatyw transformacyjnych. Możesz je przejrzeć i edytować w tabeli po prawej.",
    "fullInitiatives.tableHeader.initiative": "Nazwa Inicjatywy",
    "fullInitiatives.tableHeader.axis": "Oś",
    "fullInitiatives.tableHeader.priority": "Priorytet",
    "fullInitiatives.tableHeader.complexity": "Złożoność",
    "fullInitiatives.tableHeader.status": "Status",
    "fullInitiatives.tableHeader.notes": "Notatki",
    "fullInitiatives.tableHeader.actions": "Akcje",
    "fullInitiatives.priorities.High": "Wysoki",
    "fullInitiatives.priorities.Medium": "Średni",
    "fullInitiatives.priorities.Low": "Niski",
    "fullInitiatives.complexities.High": "Wysoka",
    "fullInitiatives.complexities.Medium": "Średnia",
    "fullInitiatives.complexities.Low": "Niska",
    "fullInitiatives.statuses.Draft": "Szkic",
    "fullInitiatives.statuses.Ready": "Gotowe",
    "fullInitiatives.statuses.Archived": "Zarchiwizowane",
    "fullInitiatives.nextStep": "Przejdź do Mapy Drogowej (Krok 3)",

    "fullRoadmap.intro": "Przygotowałem projekt mapy drogowej na podstawie priorytetów i złożoności Twoich inicjatyw. Zadania fundamentalne (Dane/Procesy) są zaplanowane wcześniej.",
    "fullRoadmap.tableHeader.quarter": "Kwartał",
    "fullRoadmap.tableHeader.wave": "Fala",
    "fullRoadmap.workload.title": "Dystrybucja Obciążenia",
    "fullRoadmap.workload.initiatives": "inicjatywy",
    "fullRoadmap.workload.overloaded": "Przeciążenie",
    "fullRoadmap.nextStep": "Przejdź do Ekonomii i ROI (Krok 4)",

    "fullROI.intro": "Teraz oszacujmy koszty i korzyści. Nie musisz być precyzyjny – przedziały i najlepsze szacunki są na razie wystarczające.",
    "fullROI.tableHeader.cost": "Szac. Koszt (tys. zł)",
    "fullROI.tableHeader.benefit": "Szac. Korzyść (tys. zł/rok)",
    "fullROI.summary.totalCost": "Całkowity Koszt",
    "fullROI.summary.totalBenefit": "Roczna Korzyść",
    "fullROI.summary.roi": "ROI",
    "fullROI.summary.payback": "Zwrot",
    "fullROI.summary.years": "lat",
    "fullROI.nextStep": "Przejdź do Pulpitu Realizacji (Krok 5)",

    "fullExecution.intro": "Witamy w Trybie Realizacji. Tutaj możesz śledzić postępy, przypisywać właścicieli i zarządzać blokadami. Przeciągaj lub aktualizuj statusy.",
    "fullExecution.columns.todo": "Do Zrobienia",
    "fullExecution.columns.inProgress": "W Trakcie",
    "fullExecution.columns.blocked": "Zablokowane",
    "fullExecution.columns.done": "Gotowe",
    "fullExecution.kpi.total": "Wszystkie Inicjatywy",
    "fullExecution.kpi.completion": "Stopień Ukończenia",
    "fullExecution.fields.owner": "Właściciel",
    "fullExecution.fields.dueDate": "Termin",
    "fullExecution.fields.progress": "Postęp",
    "fullExecution.nextStep": "Przejdź do Raportu Końcowego (Krok 6)",

    "fullReports.header": "Raport Transformacji",
    "fullReports.sections.exec": "Podsumowanie Zarządcze",
    "fullReports.sections.maturity": "Profil Dojrzałości Cyfrowej",
    "fullReports.sections.initiatives": "Kluczowe Inicjatywy",
    "fullReports.sections.roadmap": "Mapa Drogowa Transformacji",
    "fullReports.sections.economics": "Ekonomia i ROI",
    "fullReports.sections.execution": "Status Realizacji",
    "fullReports.cards.maturity": "Dojrzałość i Fokus",
    "fullReports.cards.economics": "Ekonomia Projektu",
    "fullReports.cards.execution": "Migawka Realizacji",
    "fullReports.buttons.export": "Eksportuj Raport",
    "fullReports.buttons.copy": "Kopiuj Tekst",
    "fullReports.labels.strongest": "Najsilniejszy Atut",
    "fullReports.labels.weakest": "Krytyczna Luka",
    "fullReports.labels.totalCost": "Koszt",
    "fullReports.labels.annualBenefit": "Korzyść",
    "fullReports.labels.roi": "ROI",
    "fullReports.labels.payback": "Zwrot",
    "fullReports.labels.completionRate": "Ukończenie",
    "fullReports.labels.initiatives": "Inicjatywy",
    "fullReports.labels.done": "Gotowe",
    "fullReports.labels.inProg": "W Trakcie",
    "fullReports.labels.blocked": "Blok.",
    "fullReports.reportTemplates.execSummary": "{companyName} rozpoczęła strategiczną transformację cyfrową. Na podstawie oceny DRD, organizacja wykazuje silną dojrzałość w {strongest} ({strongestScore}/7), podczas gdy wyzwania występują w {weakest} ({weakestScore}/7).\n\nAby zaadresować te luki, opracowano mapę drogową składającą się z {initCount} inicjatyw. Plan skupia się na budowie fundamentów w pierwsze 12 miesięcy.\n\nProjektowany roczny zysk wynosi ${benefit}k przy inwestycji ${cost}k, co daje ROI {roi}% i zwrot w {payback} lat.",
    "fullReports.reportTemplates.finding1": "{strongest} to Twój najsilniejszy atut.",
    "fullReports.reportTemplates.finding2": "{weakest} wymaga natychmiastowej uwagi.",
    "fullReports.reportTemplates.finding3": "Organizacja jest gotowa na transformację typu {type}.",
    "fullReports.reportTemplates.aggressive": "agresywną",
    "fullReports.reportTemplates.focused": "skoncentrowaną",

    "common.status.saved": "Zapisano auto.",
    "common.status.saving": "Zapisywanie...",
    "common.status.unsaved": "Niezapisane zmiany",
    "common.status.error": "Błąd zapisu",
    "common.impersonation.banner": "IMPERSONACJA: {{email}}",
    "common.impersonation.stop": "Zakończ Impersonację",
    "common.underConstruction": "Komponent w Budowie"
};

function setDeepValue(obj, pathParts, value) {
    let current = obj;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
    }
    current[pathParts[pathParts.length - 1]] = value;
}

// 1. Copy fullAssessment.questions from EN to PL (as they contain languages)
if (en.fullAssessment && en.fullAssessment.questions) {
    if (!pl.fullAssessment) pl.fullAssessment = {};
    if (!pl.fullAssessment.questions) {
        pl.fullAssessment.questions = en.fullAssessment.questions;
        console.log("Copied fullAssessment.questions from EN to PL.");
    }
}

// 2. Apply Translations
for (const key in translations) {
    const parts = key.split('.');
    setDeepValue(pl, parts, translations[key]);
}

fs.writeFileSync(plPath, JSON.stringify(pl, null, 2));
console.log(`Updated PL translations with ${Object.keys(translations).length} keys.`);
