/**
 * Okno wymaganego powodu (DEC-424: „wymagany powód" przy zwrocie, odrzuceniu,
 * anulowaniu i wstrzymaniu).
 *
 * P16/R3 (DEC-453): treść okna przeniesiona do WSPÓLNEGO
 * `src/components/standard/ReasonDialog.tsx` — dokładnie ten sam DOM, te same
 * klasy i te same `data-testid` (`initiative-reason-dialog` / `-input` /
 * `-confirm`), bo to samo okno jest teraz potrzebne przy rozstrzyganiu decyzji
 * w Realizacji. Ten plik zostaje jako nazwana powłoka domenowa: trzyma etykiety
 * i18n Inicjatyw, a wygląd i regułę „bez powodu nie zapiszesz" narzuca standard.
 *
 * Powodu NIE DA SIĘ pominąć: przycisk potwierdzenia jest nieaktywny do czasu
 * wpisania niepustego tekstu, a `Enter` w polu nie zatwierdza formularza.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReasonDialog } from '@/components/standard/ReasonDialog';

export interface InitiativeReasonDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  /** `true` dla odrzucenia/anulowania — jedyny przypadek czerwieni. */
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export const InitiativeReasonDialog: React.FC<InitiativeReasonDialogProps> = ({
  open,
  title,
  confirmLabel,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  return (
    <ReasonDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel}
      destructive={destructive}
      busy={busy}
      testIdPrefix="initiative-reason"
      label={t('initiatives.lifecycle.reasonLabel', 'Reason (required)')}
      placeholder={t(
        'initiatives.lifecycle.reasonPlaceholder',
        'Explain why you are making this decision — it goes into the initiative history.'
      )}
      hint={t('initiatives.lifecycle.reasonHint', 'Without a reason this operation will not be saved.')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

export default InitiativeReasonDialog;
