import { Check } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { NModeToolbar, useCardAIAnalysis } from '@/components/shared/NModeLayout';
import { NCardAIAnalysisPanel } from '@/components/shared/NModeLayout/NCardAIAnalysisPanel';
import type { OpenDocument } from '@/components/shared/ModuleHub/types';
import { closeActionCard, getActionCard, updateActionCard } from '@/services/actionCards';

import { ArtifactPropertiesTable } from './ArtifactPropertiesTable';
import { PracujZAI } from './PracujZAI';
import { StandardArtifactShell } from './StandardArtifactShell';
import { StandardModuleBar } from './StandardModuleBar';
import type { ActionCardModel, ActionCardSourceKind } from './ActionCard.types';
import { ACTION_CARD_SECTION_CONTRACT, type ActionCardSection } from './actionCardContract';

const box = 'rounded-xl border border-c-border-subtle bg-c-surface p-4 text-sm text-c-text-secondary';
const value = (text?: string | null) => text?.trim() || '—';

/**
 * K28 (odbiór P13-A): `card.sourceKind.replaceAll('_', ' ')` wypisywał nazwę
 * enuma w DOM. Etykieta idzie teraz przez `t()` z domyślną wartością EN —
 * PL leży w `public/locales/pl/translation.json` pod `karta.akcja.sourceKind.*`.
 */
const SOURCE_KIND_LABEL_EN: Record<ActionCardSourceKind, string> = {
  kpi_deviation: 'KPI deviation',
  execution_delay: 'Execution delay',
  audit_finding: 'Audit finding',
  finance_variance: 'Finance variance',
  meeting_action: 'Meeting action',
};

export function ActionCardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  // K3c (odbiór P13-A): `isPolish: true` na sztywno → język realny z UI.
  const isPolish = i18n.language === 'pl';
  /** DEC-461: klucz PL + domyślna wartość EN, zero polskiego na sztywno. */
  const tr = useCallback(
    (key: string, en: string, opts?: Record<string, unknown>) => t(`karta.akcja.${key}`, en, opts),
    [t]
  );

  const [card, setCard] = useState<ActionCardModel | null>(null);
  const [active, setActive] = useState('description');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    void getActionCard(id)
      .then(setCard)
      .finally(() => setLoading(false));
  }, [id]);

  const apply = useCallback(
    (fieldId: string, next: string) => {
      if (!card || !['problem', 'rootCause', 'actionText', 'dueDate', 'comment'].includes(fieldId)) return false;
      void updateActionCard(card.id, { [fieldId]: next }).then(setCard);
      return true;
    },
    [card]
  );

  const analysis = useCardAIAnalysis({
    activeCardId: card ? active : null,
    buildInput: () => ({
      artifactType: 'action',
      cardId: active,
      artifactTitle: card?.problem || tr('domyslnyTytul', 'Action card'),
      artifactContext: `${tr('status', 'Status')}: ${card?.status || ''}`,
      fields: [
        { id: 'problem', label: tr('problem', 'Problem'), value: card?.problem || '', writable: true },
        { id: 'rootCause', label: tr('glownaPrzyczyna', 'Root cause'), value: card?.rootCause || '', writable: true },
        { id: 'actionText', label: tr('dzialanie', 'Action'), value: card?.actionText || '', writable: true },
      ],
      isPolish,
    }),
    applyChange: (change) => apply(change.fieldId, String(change.proposedValue || '')),
  });

  const aiSource = useMemo(
    () => ({
      rodzaj: 'pola' as const,
      pola: ({ sekcjaId, caly }: { sekcjaId: string | null; caly: boolean }) => {
        const fields = [
          {
            id: 'problem',
            etykieta: tr('problem', 'Problem'),
            wartosc: card?.problem || '',
            sekcjaId: 'description',
            sekcjaEtykieta: tr('sekcjaOpis', 'Description'),
          },
          {
            id: 'rootCause',
            etykieta: tr('glownaPrzyczyna', 'Root cause'),
            wartosc: card?.rootCause || '',
            sekcjaId: 'description',
            sekcjaEtykieta: tr('sekcjaOpis', 'Description'),
          },
          {
            id: 'actionText',
            etykieta: tr('dzialanie', 'Action'),
            wartosc: card?.actionText || '',
            sekcjaId: 'description',
            sekcjaEtykieta: tr('sekcjaOpis', 'Description'),
          },
          {
            id: 'dueDate',
            etykieta: tr('termin', 'Due date'),
            wartosc: card?.dueDate || '',
            sekcjaId: 'owner',
            sekcjaEtykieta: tr('sekcjaWlascicielTermin', 'Owner and due date'),
            format: 'paragraph' as const,
          },
        ];
        return caly ? fields : fields.filter((field) => field.sekcjaId === sekcjaId);
      },
      zastosuj: apply,
    }),
    [apply, card, tr]
  );

  /**
   * F5 (odbiór P13-A) — ATRAPA usunięta: `primaryAction: intentionallyNone`
   * obiecywał zmianę stanu „w sekcji Akcje", a sekcja miała tylko „Wróć do
   * listy". Trasa `POST /api/action-cards/:id/close` istnieje i działa
   * (`closeActionCard` w `services/actionCards.ts`) — to jedyne realne
   * przejście stanu (OPEN → CLOSED; serwer nie ma trasy powrotnej). Zamiast
   * kontrolki-atrapy: realny primary w Menu 1, dopóki karta jest otwarta.
   */
  const handleClose = useCallback(() => {
    if (!card || card.status !== 'OPEN') return;
    setClosing(true);
    void closeActionCard(card.id)
      .then(setCard)
      .finally(() => setClosing(false));
  }, [card]);

  // K3b: wołany z `StandardModuleBar` (Menu 2/3). Musi żyć NAD wczesnym
  // `return` niżej — hook zadeklarowany po warunkowym return renderuje się
  // tylko na CZĘŚCI przebiegów i wywala „Rendered more hooks than during the
  // previous render" (złapane na żywym ekranie, nie przez tsc — zmierzone
  // `evidence/n2-karty-b/03-karta-dzialania-*.bledy.json` PRZED naprawą).
  const goToInbox = useCallback(() => navigate('/my-work?tab=inbox'), [navigate]);

  if (!card) {
    return (
      <div className="p-8 text-c-text-secondary">
        {loading ? tr('wczytywanie', 'Loading action card…') : tr('nieZnaleziono', 'Action card not found.')}
      </div>
    );
  }

  const statusLabel = card.status === 'OPEN' ? tr('statusOtwarta', 'Open') : tr('statusZamknieta', 'Closed');
  const sourceKindLabel = t(
    `karta.akcja.sourceKind.${card.sourceKind}`,
    SOURCE_KIND_LABEL_EN[card.sourceKind] ?? card.sourceKind
  );

  const content: Record<string, React.ReactNode> = {
    description: (
      <div className={box}>
        <p>
          <b>{tr('problem', 'Problem')}:</b> {value(card.problem)}
        </p>
        <p>
          <b>{tr('glownaPrzyczyna', 'Root cause')}:</b> {value(card.rootCause)}
        </p>
        <p>
          <b>{tr('dzialanie', 'Action')}:</b> {value(card.actionText)}
        </p>
      </div>
    ),
    source: (
      <div className={box}>
        {tr('zrodlo', 'Source')}: {sourceKindLabel}
      </div>
    ),
    owner: (
      <div className={box}>
        <p>
          {tr('wlasciciel', 'Owner')}: {value(card.ownerName)}
        </p>
        <p>
          {tr('termin', 'Due date')}: {value(card.dueDate)}
        </p>
        <p>
          {tr('okres', 'Period')}: {value(card.periodStart)} – {value(card.periodEnd)}
        </p>
      </div>
    ),
    actions: (
      <div className={box}>
        <p>
          {tr('status', 'Status')}: {statusLabel}
        </p>
        {card.comment ? (
          <p>
            {tr('komentarz', 'Comment')}: {card.comment}
          </p>
        ) : null}
      </div>
    ),
  };

  const sections: ActionCardSection[] = ACTION_CARD_SECTION_CONTRACT.map((section) => ({
    ...section,
    component: content[section.id],
    aiContract: { none: true, reason: 'AI jest sterowane wspólnie przez Menu 5 tej karty.' },
  }));

  const rightPanel = {
    actions: {
      label: tr('akcje', 'Actions'),
      children: (
        <button
          type="button"
          className="rounded-lg border border-c-border px-3 py-2 text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          onClick={() => navigate(-1)}
        >
          {tr('wrocDoListy', 'Back to list')}
        </button>
      ),
      actionIds: ['back'],
    },
    properties: {
      label: tr('wlasciwosci', 'Properties'),
      children: (
        <ArtifactPropertiesTable
          propertyLabel={tr('wlasciwosc', 'Property')}
          valueLabel={tr('wartosc', 'Value')}
          rows={[
            { id: 'status', label: tr('status', 'Status'), value: statusLabel },
            { id: 'owner', label: tr('wlasciciel', 'Owner'), value: value(card.ownerName) },
            { id: 'due', label: tr('termin', 'Due date'), value: value(card.dueDate) },
          ]}
        />
      ),
    },
    relations: {
      label: tr('powiazania', 'Relations'),
      children: <div className="text-sm">{tr('powiazanieZrodlem', 'Linked to the source record.')}</div>,
    },
    evidence: {
      label: tr('zrodlaZalozenia', 'Sources & assumptions'),
      children: (
        <div className="text-sm">
          {tr('pomiarZeZrodla', 'The measurement and threshold come from the source record.')}
        </div>
      ),
    },
    comments: card.comment
      ? { label: tr('komentarze', 'Comments'), children: <div className="text-sm">{card.comment}</div> }
      : { pominieta: true as const, reason: 'Karta nie zawiera komentarza.' },
    history: {
      label: tr('historia', 'History'),
      children: (
        <div className="text-sm">
          {tr('biezacyStan', 'Current state: {{status}}.', { status: statusLabel })}
        </div>
      ),
    },
  };

  const activeSectionLabel = sections.find((section) => section.id === active)?.label;

  // K3b (odbiór P13-A): karta jest osobną trasą (`/action-cards/:id`), więc
  // bez tego opakowania traci CAŁY pasek modułu (Menu 2/3) — dokładnie ten
  // sam defekt, co karty Wyników przed `KartaWynikowChrome`
  // (`src/components/ResultsVNext/shared/kartaWynikow.tsx`). Ten sam,
  // kanoniczny mechanizm (`StandardModuleBar` + `OpenDocument`), nie nowy
  // komponent paska: „Skrzynka" to jedyne dzisiejsze wejście do kart działania
  // (Moja praca → Skrzynka), więc to jest cel „Lista"/„×". (`goToInbox` samo
  // wywołanie useCallback żyje wyżej, nad early returnem — patrz komentarz tam.)
  const openItems: OpenDocument[] = [
    {
      id: card.id,
      type: 'task',
      subType: sourceKindLabel,
      name: card.problem || tr('domyslnyTytul', 'Action card'),
      status: card.status === 'OPEN' ? 'EXECUTING' : 'DONE',
    },
  ];

  return (
    <StandardModuleBar
      tabs={[{ id: 'inbox', label: tr('paskModulu', 'Inbox') }]}
      activeTab="inbox"
      onTabChange={goToInbox}
      viewModes={['table']}
      openItems={openItems}
      activeItemId={card.id}
      onSelectItem={() => {}}
      onCloseItem={goToInbox}
      onShowList={goToInbox}
    >
      <StandardArtifactShell
        karta="action"
        klasa="S"
        header={{
          title: card.problem || tr('domyslnyTytul', 'Action card'),
          onTitleChange: () => undefined,
          titleReadOnly: true,
          artifactType: 'task',
          artifactId: card.id,
          onSave: () => undefined,
          saveState: 'saved',
          onClose: () => navigate(-1),
          statusLabel,
          statusTone: card.status === 'OPEN' ? 'review' : 'approved',
        }}
        primaryAction={
          card.status === 'OPEN'
            ? {
                id: 'close-action-card',
                label: { pl: 'Zamknij kartę', en: 'Close card' },
                icon: Check,
                onClick: handleClose,
                disabled: closing,
              }
            : {
                intentionallyNone: true,
                reason: 'Karta jest zamknięta — nie ma dalszej akcji cyklu życia (brak trasy ponownego otwarcia).',
              }
        }
        sections={sections}
        rightPanel={rightPanel}
        activeSection={active}
        onSectionChange={setActive}
        densityMode="n"
        onDensityModeChange={() => undefined}
        toolbar={
          <NModeToolbar
            activeSectionLabel={
              activeSectionLabel ? (isPolish ? activeSectionLabel.pl : activeSectionLabel.en) : undefined
            }
            isPolish={isPolish}
            aiArtifactButton={
              <PracujZAI
                isPolish={isPolish}
                onAnalizuj={analysis.run}
                analizaWToku={analysis.loading}
                analizaOtwarta={analysis.open}
                aktywnaSekcja={active}
                kontekstArtefaktu={{ title: card.problem, status: card.status, type: 'action' }}
                moznaEdytowac={card.status === 'OPEN'}
                powodTylkoOdczyt={tr('tylkoOdczytZamknieta', 'Card is closed.')}
                uzupelnijSekcje={aiSource}
                uzupelnijDokument={aiSource}
              />
            }
          />
        }
        panelAriaLabel={tr('panelAriaLabel', 'Action card details')}
      />
    </StandardModuleBar>
  );
}

export default ActionCardPage;
