/**
 * blockOps — pure helpers for manual, per-block editing (Fala 1, manual mode).
 *
 * ★ Model danych NIE jest ruszany: wszystkie operacje czytają/piszą wyłącznie
 * istniejące pola `CardBlock.position.{area,order}` (patrz
 * `Harvard/wdrozenie-100/_SPEC_PRACA_NA_SLAJDACH_2026-07-28.md` §2.1). „Przenieś
 * w górę/w dół" zmienia TYLKO `order` w obrębie tego samego `area` — żadnego
 * x/y, żadnej nowej kolumny.
 */

import type { CardBlock } from '../wizard/types';

/** Usuń blok z listy. Nie renumeruje sąsiadów — sortowanie po `order` działa z lukami. */
export function deleteBlockFromList(blocks: CardBlock[], blockId: string): CardBlock[] {
  return blocks.filter((b) => b.block_id !== blockId);
}

/**
 * Zduplikuj blok — kopia dostaje nowy `block_id` i ląduje bezpośrednio po
 * oryginale w tym samym regionie (renumerujemy TYLKO `order` bloków tego
 * regionu, żeby kolejność renderowania była jednoznaczna).
 */
export function duplicateBlockInList(blocks: CardBlock[], blockId: string): CardBlock[] {
  const idx = blocks.findIndex((b) => b.block_id === blockId);
  if (idx === -1) return blocks;
  const original = blocks[idx];
  const clone: CardBlock = {
    ...(JSON.parse(JSON.stringify(original)) as CardBlock),
    block_id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const next = [...blocks];
  next.splice(idx + 1, 0, clone);
  return renumberArea(next, original.position.area);
}

/** Czy blok da się przesunąć w danym kierunku w obrębie swojego regionu? */
export function canMoveBlock(
  blocks: CardBlock[],
  blockId: string,
  direction: 'up' | 'down'
): boolean {
  const target = blocks.find((b) => b.block_id === blockId);
  if (!target) return false;
  const sameArea = sortedByOrder(blocks.filter((b) => b.position.area === target.position.area));
  const idx = sameArea.findIndex((b) => b.block_id === blockId);
  if (idx === -1) return false;
  return direction === 'up' ? idx > 0 : idx < sameArea.length - 1;
}

/**
 * Przesuń blok w górę/w dół — zamienia `position.order` z sąsiadem w tym samym
 * regionie (`position.area`). To jest „przesuwanie w obrębie slajdu" z
 * minimalnego zestawu (SPEC §3.1.1) — bez zmiany modelu danych.
 */
export function moveBlockInList(
  blocks: CardBlock[],
  blockId: string,
  direction: 'up' | 'down'
): CardBlock[] {
  const target = blocks.find((b) => b.block_id === blockId);
  if (!target) return blocks;
  const sameArea = sortedByOrder(blocks.filter((b) => b.position.area === target.position.area));
  const idx = sameArea.findIndex((b) => b.block_id === blockId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= sameArea.length) return blocks;

  const a = sameArea[idx];
  const b = sameArea[swapIdx];
  const aOrder = a.position.order;
  const bOrder = b.position.order;
  return blocks.map((blk) => {
    if (blk.block_id === a.block_id)
      return { ...blk, position: { ...blk.position, order: bOrder } };
    if (blk.block_id === b.block_id)
      return { ...blk, position: { ...blk.position, order: aOrder } };
    return blk;
  });
}

function sortedByOrder(blocks: CardBlock[]): CardBlock[] {
  return [...blocks].sort((a, b) => a.position.order - b.position.order);
}

/** Renumeruje `order` (0..n-1) bloków jednego regionu, zachowując ich kolejność w tablicy. */
function renumberArea(blocks: CardBlock[], area: CardBlock['position']['area']): CardBlock[] {
  const sameAreaIndexed = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.position.area === area)
    .sort((x, y) => x.b.position.order - y.b.position.order || x.i - y.i);
  const orderMap = new Map<string, number>();
  sameAreaIndexed.forEach(({ b }, idx) => orderMap.set(b.block_id, idx));
  return blocks.map((b) =>
    orderMap.has(b.block_id)
      ? { ...b, position: { ...b.position, order: orderMap.get(b.block_id)! } }
      : b
  );
}
