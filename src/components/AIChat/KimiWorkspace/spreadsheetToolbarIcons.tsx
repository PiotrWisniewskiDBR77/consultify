/**
 * Excel-typowe ikony paska narzędzi arkusza (171-pojedyncze, uwaga
 * właściciela 2026-09-01: "zamieńmy teraz słowa na typowe dla excela ikony —
 * kazdy chyba juz na swiecie je zna").
 *
 * "Wstaw wiersz"/"Usuń wiersz"/"Wstaw kolumnę"/"Usuń kolumnę" mają identyczny
 * bazowy kształt (Rows3/Columns3) — bez rozróżnienia insert/delete dwie pary
 * przycisków wyglądałyby tak samo. Dokładamy mały odznakowy plus/minus w
 * rogu (ten sam wzorzec co "dodaj plik" w GitHubie/VS Code) — rozpoznawalne
 * przy pierwszym spojrzeniu, zgodnie z intencją właściciela, etykieta i tak
 * zostaje w title/aria-label (ArtifactMenu3 CommandButton).
 */
import { Columns3, Minus, Plus, Rows3 } from 'lucide-react';
import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function withCornerBadge(
  Base: React.ComponentType<{ size?: number; className?: string }>,
  Badge: React.ComponentType<{ size?: number; className?: string }>
): React.FC<IconProps> {
  const Composed: React.FC<IconProps> = ({ size = 17, className }) => {
    const badgeSize = Math.max(9, Math.round(size * 0.62));
    return (
      <span
        className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ''}`}
        style={{ width: size, height: size }}
      >
        <Base size={size} aria-hidden="true" />
        <span
          className="absolute -bottom-[3px] -right-[3px] inline-flex items-center justify-center rounded-full bg-c-surface"
          style={{ width: badgeSize, height: badgeSize }}
        >
          <Badge size={Math.round(badgeSize * 0.82)} aria-hidden="true" />
        </span>
      </span>
    );
  };
  return Composed;
}

export const InsertRowIcon = withCornerBadge(Rows3, Plus);
export const DeleteRowIcon = withCornerBadge(Rows3, Minus);
export const InsertColumnIcon = withCornerBadge(Columns3, Plus);
export const DeleteColumnIcon = withCornerBadge(Columns3, Minus);
