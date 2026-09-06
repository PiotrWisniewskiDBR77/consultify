/**
 * Skrzynka Mojej Pracy — KARTY DZIAŁANIA właściciela (kręgosłup P9/DEC-397,
 * P7K część B). [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 *
 * Skrzynka jest JEDYNYM odbiornikiem zgłoszeń (KRĘGOSŁUP §3.3): każde „coś
 * jest źle → ktoś ma działać" kończy się tutaj. Wpis w kanonicznej tabeli
 * Skrzynki powstaje z tej samej tabeli `action_cards` (materializacja w
 * `inboxService`), a TA sekcja pokazuje pełną kartę z polami §2.4 i daje dwie
 * akcje: „Utwórz zadanie" i „Zamknij kartę".
 *
 * `?actionCardId=<id>` — adres z powiadomienia (`actionUrl` z
 * `actionCardService.createActionCard`). Wskazana karta jest rozwinięta i
 * przewinięta do widoku; pozostałe zostają zwinięte do jednej linii, żeby
 * lista pięciu kart nie zjadła całego ekranu Skrzynki.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { ActionCard } from '@/components/standard/ActionCard';
import type { ActionCardModel } from '@/components/standard/ActionCard.types';
import { closeActionCard, createTaskFromActionCard, listActionCards } from '@/services/actionCards';

export function InboxActionCards() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<ActionCardModel[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const kotwica = useRef<HTMLDivElement | null>(null);

  /* Adres z powiadomienia czytamy z `window.location`, NIE przez
     `useSearchParams`. Powód zmierzony: `InboxContent` jest renderowany w
     testach (i w kilku osadzeniach) BEZ routera, a `useSearchParams` rzuca
     wtedy wyjątkiem i wywraca całe drzewo Skrzynki — regresja złapana przez
     `InboxContent.jedenPanel.test.tsx`. `history.replaceState` zdejmuje
     parametr bez nawigacji, więc router (gdy jest) nie traci stanu. */
  const [zZadresu, setZAdresu] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('actionCardId');
    } catch {
      return null;
    }
  });

  const wczytaj = useCallback(async () => {
    try {
      const lista = await listActionCards({ status: 'OPEN', ownerUserId: 'me' });
      setCards(Array.isArray(lista) ? lista : []);
    } catch {
      setCards([]);
    }
  }, []);

  useEffect(() => {
    void wczytaj();
  }, [wczytaj]);

  useEffect(() => {
    if (zZadresu && cards.some((c) => c.id === zZadresu)) setOpenId(zZadresu);
  }, [zZadresu, cards]);

  useEffect(() => {
    if (openId && kotwica.current) kotwica.current.scrollIntoView({ block: 'nearest' });
  }, [openId]);

  const utworzZadanie = useCallback(
    async (card: ActionCardModel) => {
      setBusyId(card.id);
      try {
        const task = await createTaskFromActionCard(card.id);
        toast.success(t('actionCard.taskCreated', 'Zadanie utworzone: {{title}}', { title: task.title }));
      } catch {
        toast.error(t('actionCard.taskFailed', 'Nie udało się utworzyć zadania.'));
      } finally {
        setBusyId(null);
      }
    },
    [t]
  );

  const zamknij = useCallback(
    async (card: ActionCardModel) => {
      setBusyId(card.id);
      try {
        await closeActionCard(card.id);
        toast.success(t('actionCard.closed', 'Karta zamknięta.'));
        if (openId === card.id) setOpenId(null);
        if (zZadresu === card.id) {
          try {
            const adres = new URL(window.location.href);
            adres.searchParams.delete('actionCardId');
            window.history.replaceState({}, '', `${adres.pathname}${adres.search}${adres.hash}`);
          } catch {
            /* brak History API (środowisko testowe) — parametr zostaje, karta i tak zniknie */
          }
          setZAdresu(null);
        }
        await wczytaj();
      } catch {
        toast.error(t('actionCard.closeFailed', 'Nie udało się zamknąć karty.'));
      } finally {
        setBusyId(null);
      }
    },
    [openId, t, wczytaj, zZadresu]
  );

  const naglowek = useMemo(
    () => t('actionCard.inboxSection', 'Karty działania ({{count}})', { count: cards.length }),
    [cards.length, t]
  );

  if (!cards.length) return null;

  return (
    <section
      aria-label={t('actionCard.inboxSectionAria', 'Karty działania w Skrzynce')}
      data-testid="inbox-action-cards"
      className="space-y-2 px-4 pt-3"
    >
      <h2 className="text-sm font-semibold text-c-text">{naglowek}</h2>
      {cards.map((card) => {
        const rozwinieta = openId === card.id;
        return (
          <div key={card.id} ref={rozwinieta ? kotwica : undefined}>
            <button
              type="button"
              data-testid="inbox-action-card-entry"
              aria-expanded={rozwinieta}
              onClick={() => setOpenId(rozwinieta ? null : card.id)}
              className="flex w-full items-center gap-2 rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <span className="truncate">{card.problem || t('actionCard.title', 'Karta działania')}</span>
            </button>
            {rozwinieta ? (
              <div className="mt-2">
                <ActionCard
                  card={card}
                  onCreateTask={utworzZadanie}
                  onCloseCard={zamknij}
                  busy={busyId === card.id}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
