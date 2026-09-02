/**
 * PreviewWhatsNextCard — ramka bloku „Co dalej" (create-strip) w podglądzie.
 *
 * ── PO CO ──────────────────────────────────────────────────────────────────
 *
 * `TABLE_AND_PREVIEW_CANON.md` §7.0 / §7.3 pkt 4.4: „Co dalej" stoi POZA
 * numeracją sześciu bloków TRIADY i renderuje się **ZAWSZE NA KOŃCU, po bloku
 * 6 (Akcje)** — dokładnie tak, jak robi to `StandardPreview` (`whatsNext` po
 * `actionRows`).
 *
 * `StandardPreview` miał tę ramkę u siebie, ale ekrany, które komponują stopkę
 * podglądu z prymitywów przez `TableWithPreviewLayout.renderPreviewFooter`
 * (Ideas: `IdeasTableContent.tsx`, `MyIdeasListContent.tsx`), nie miały czego
 * osadzić — więc każdy kleił własny nagłówek `<div className="mb-1.5
 * text-[11px] uppercase …">` i stawiał go PRZED paskiem akcji. Dwie kopie,
 * obie z tą samą pomyłką w kolejności, obie z inną typografią niż
 * `StandardPreview`. To ten sam wzorzec, który raz już złamał kanon tabel:
 * powłoka kleiła własną siatkę zamiast osadzić komponent.
 *
 * Ten komponent jest tym, co się osadza. Ramka, overline i rytm są tu jeden
 * raz i są bajt-w-bajt tym, co renderuje `StandardPreview` w bloku `whatsNext`.
 *
 * @module components/shared/PreviewPane/PreviewWhatsNextCard
 */

import React from 'react';

export interface PreviewWhatsNextCardProps {
  /** Nagłówek sekcji — domyślnie „Co dalej" / „What's next" wg `isPolish`. */
  label?: string;
  isPolish?: boolean;
  /** Dopisek dla CAŁEJ grupy, pokazany RAZ pod paskiem (nigdy per-pozycja). */
  note?: string;
  children: React.ReactNode;
}

export const PreviewWhatsNextCard: React.FC<PreviewWhatsNextCardProps> = ({
  label,
  isPolish = true,
  note,
  children,
}) => (
  <div
    data-preview-block="whatsnext"
    className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5"
  >
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
      {label ?? (isPolish ? 'Co dalej' : "What's next")}
    </div>
    {children}
    {note ? <div className="mt-1.5 text-[10px] text-c-text-muted">{note}</div> : null}
  </div>
);

export default PreviewWhatsNextCard;
