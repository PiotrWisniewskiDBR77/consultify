/**
 * Mock host for <StandardQuestion> — SPEC-Q, the 4th artifact format.
 *
 * Reuses the REAL component (no re-implementation) and mounts TWO cards side
 * by side so the supervisor can screenshot both archetypes at once
 * (CLAUDE.md rule #7 — clean self-rendered harness before Piotr sees it):
 *   (a) Q-Text  — Interview-style open answer with pulsing-lightbulb guidance
 *                 (hint + example + evidence) + AI deep-dive.
 *   (b) Q-Level — DRD "Gotowość do zmiany" (readiness for change), 6-rung
 *                 maturity ladder with full definition + example + boundary on
 *                 every rung (the cure for "za mało info żeby wybrać poziom").
 *
 * All copy is Polish (isPolish=true). Handlers are no-ops except onChange,
 * which keeps local state so the interactions stay live under the pointer.
 */
import React, { useState } from 'react';

import StandardQuestion, {
  type StandardQuestionModel,
} from '../../src/components/standard/StandardQuestion';

// (a) Q-Text — Interview style.
const Q_TEXT: StandardQuestionModel = {
  id: 'demo_q_text',
  text: 'Jak dziś podejmujecie kluczowe decyzje operacyjne w firmie?',
  context:
    'Chcemy zrozumieć realny proces decyzyjny — kto decyduje, na jakich danych i jak szybko — zanim zaproponujemy zmiany.',
  hint: 'Opisz konkretną, niedawną decyzję: kto ją podjął, co było wejściem (dane, opinie), ile trwała i co było wynikiem. Unikaj ogólników typu „decydujemy wspólnie”.',
  exampleAnswer:
    'Decyzję o wstrzymaniu linii produkcyjnej podejmuje kierownik zmiany na podstawie odczytów z czujników i telefonu do utrzymania ruchu. Trwa to zwykle 15–30 minut, bez formalnej analizy kosztu przestoju.',
  evidencePrompt:
    'Podłącz zrzut z systemu, procedurę decyzyjną lub e-mail dokumentujący ostatnią taką decyzję.',
  inputType: 'text',
  aiDeepDiveEnabled: true,
};

// (b) Q-Level — DRD readiness-for-change maturity ladder (6 rungs, full context).
const Q_LEVEL: StandardQuestionModel = {
  id: 'demo_q_level',
  text: 'Na ile organizacja jest gotowa do przeprowadzenia zmiany?',
  context:
    'Oceniamy zdolność firmy do wdrażania zmian — od pojedynczych, chaotycznych prób po powtarzalną, zarządzaną transformację. To wyznacza tempo i ryzyko całego programu.',
  hint: 'Wybierz poziom, który najlepiej opisuje POWTARZALNE zachowanie organizacji w ostatnich 12 miesiącach — nie jednorazowy sukces ani ambicję zarządu.',
  exampleAnswer:
    'Jeśli firma raz przeprowadziła udany projekt, ale nie ma metody, która by to powtórzyła — to poziom 2, nie 4.',
  evidencePrompt:
    'Podłącz historię 2–3 ostatnich inicjatyw zmiany: zakres, właściciel, wynik i to, czy proces był powtarzalny.',
  inputType: 'level',
  levels: [
    {
      n: 1,
      label: 'Bierność',
      definition:
        'Organizacja nie inicjuje zmian samodzielnie. Reaguje dopiero pod presją zewnętrzną (klient, regulator, kryzys). Brak właścicieli zmian.',
      example:
        'Nowy system wdrażany tylko dlatego, że stary przestał być wspierany przez dostawcę.',
      boundaryVsPrev: 'Poziom bazowy — brak niższego.',
    },
    {
      n: 2,
      label: 'Pojedyncze próby',
      definition:
        'Zdarzają się oddolne inicjatywy zmian, ale są chaotyczne, zależne od zapału jednej osoby i rzadko dokończone. Sukces bywa, ale nie jest powtarzalny.',
      example:
        'Kierownik wprowadza tablicę Kanban w swoim zespole; po jego odejściu praktyka zanika.',
      boundaryVsPrev:
        'W przeciwieństwie do „Bierności” zmiana bywa inicjowana wewnątrz — ale bez metody i trwałości.',
    },
    {
      n: 3,
      label: 'Świadomość i intencja',
      definition:
        'Zarząd nazywa potrzebę zmiany i komunikuje ją, powstają pierwsze plany. Wykonanie wciąż jest nierówne, a odpowiedzialność rozmyta.',
      example:
        'Ogłoszono „strategię cyfryzacji”, powołano zespół, ale bez budżetu i mierzalnych celów.',
      boundaryVsPrev:
        'Różni się od „Pojedynczych prób” tym, że zmiana jest ŚWIADOMA i zakomunikowana z góry, nie tylko oddolna.',
    },
    {
      n: 4,
      label: 'Zarządzana zmiana',
      definition:
        'Zmiany prowadzone są jako projekty z właścicielem, celami i harmonogramem. Istnieje podstawowy proces, część inicjatyw kończy się mierzalnym efektem.',
      example:
        'Wdrożenie MES prowadzone z kartą projektu, kamieniami milowymi i przeglądami statusu co dwa tygodnie.',
      boundaryVsPrev:
        'W przeciwieństwie do „Świadomości i intencji” istnieje realne WYKONANIE z odpowiedzialnością i harmonogramem, nie tylko deklaracja.',
    },
    {
      n: 5,
      label: 'Powtarzalna metoda',
      definition:
        'Organizacja ma ustandaryzowany sposób prowadzenia zmian, stosowany w wielu obszarach. Uczy się na danych, a wyniki są przewidywalne.',
      example:
        'Każda inicjatywa przechodzi ten sam cykl: diagnoza → pilotaż → skalowanie → przegląd korzyści.',
      boundaryVsPrev:
        'Różni się od „Zarządzanej zmiany” tym, że metoda jest POWTARZALNA i wspólna dla całej firmy, nie ad hoc per projekt.',
    },
    {
      n: 6,
      label: 'Kultura ciągłej transformacji',
      definition:
        'Zmiana jest wpisana w codzienne działanie. Pracownicy sami identyfikują i wdrażają usprawnienia; organizacja adaptuje się szybciej niż otoczenie.',
      example:
        'Zespoły uruchamiają eksperymenty tygodniowo, a nieudane szybko wygaszają — bez formalnej zgody z góry.',
      boundaryVsPrev:
        'W przeciwieństwie do „Powtarzalnej metody” zmiana nie wymaga już odgórnego programu — jest oddolnym nawykiem całej organizacji.',
    },
  ],
  rubric: [
    { criterion: 'Powtarzalność procesu zmiany', maxPoints: 4, descriptor: 'Czy istnieje metoda stosowana wielokrotnie?' },
    { criterion: 'Własność i odpowiedzialność', maxPoints: 3, descriptor: 'Czy zmiany mają jasnych właścicieli?' },
    { criterion: 'Uczenie na danych', maxPoints: 3, descriptor: 'Czy wyniki są mierzone i wykorzystywane?' },
  ],
  aiDeepDiveEnabled: true,
};

export function StandardQuestionScreen(): React.ReactElement {
  const [textValue, setTextValue] = useState<string | number | undefined>(undefined);
  const [levelValue, setLevelValue] = useState<string | number | undefined>(4);
  const noop = () => {};
  return (
    <div className="min-h-screen bg-c-bg px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-c-text-muted">
          SPEC-Q · StandardQuestion — 4. format artefaktu
        </h1>
        <p className="mb-6 text-sm text-c-text-secondary">
          (a) Q-Text (wywiad) · (b) Q-Level (drabinka dojrzałości DRD „Gotowość do zmiany”)
        </p>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <StandardQuestion
            question={Q_TEXT}
            isPolish
            value={textValue}
            onChange={setTextValue}
            index={3}
            total={18}
            onAttach={noop}
            onAddLink={noop}
            onAskTeresa={noop}
            onDeepDive={noop}
            onPrev={noop}
            onNext={noop}
            onSkip={noop}
            saved
          />
          <StandardQuestion
            question={Q_LEVEL}
            isPolish
            value={levelValue}
            onChange={setLevelValue}
            index={7}
            total={39}
            onAttach={noop}
            onAddLink={noop}
            onAskTeresa={noop}
            onDeepDive={noop}
            onPrev={noop}
            onNext={noop}
            onSkip={noop}
          />
        </div>
      </div>
    </div>
  );
}

export default StandardQuestionScreen;
