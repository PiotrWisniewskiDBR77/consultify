import type { CardBlock } from '../wizard/types';

export type BlockGeometry = NonNullable<CardBlock['geometry']>;
export type HorizontalAlignment = 'left' | 'center' | 'right';
export type VerticalAlignment = 'top' | 'middle' | 'bottom';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function normalizeGeometry(input: Partial<BlockGeometry>): BlockGeometry {
  const width = clamp(Number(input.width ?? 30), 5, 100);
  const height = clamp(Number(input.height ?? 20), 5, 100);
  return {
    x: clamp(Number(input.x ?? 0), 0, 100 - width),
    y: clamp(Number(input.y ?? 0), 0, 100 - height),
    width,
    height,
    rotation: clamp(Number(input.rotation ?? 0), -180, 180),
  };
}

export function patchGeometry(
  geometry: BlockGeometry,
  patch: Partial<BlockGeometry>
): BlockGeometry {
  return normalizeGeometry({ ...geometry, ...patch });
}

export function expandSelectionToGroups(blocks: CardBlock[], selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  const groupIds = new Set(
    blocks.filter((block) => selected.has(block.block_id) && block.group_id).map((b) => b.group_id)
  );
  for (const block of blocks) {
    if (block.group_id && groupIds.has(block.group_id)) selected.add(block.block_id);
  }
  return [...selected];
}

export function groupBlocks(
  blocks: CardBlock[],
  selectedIds: string[],
  groupId: string
): CardBlock[] {
  if (selectedIds.length < 2 || !groupId.trim()) return blocks;
  const selected = new Set(selectedIds);
  return blocks.map((block) =>
    selected.has(block.block_id) ? { ...block, group_id: groupId.trim() } : block
  );
}

export function ungroupBlocks(blocks: CardBlock[], selectedIds: string[]): CardBlock[] {
  const expanded = new Set(expandSelectionToGroups(blocks, selectedIds));
  return blocks.map((block) => {
    if (!expanded.has(block.block_id) || !block.group_id) return block;
    const { group_id: _groupId, ...rest } = block;
    return rest;
  });
}

export function alignBlocks(
  blocks: CardBlock[],
  selectedIds: string[],
  alignment: HorizontalAlignment | VerticalAlignment
): CardBlock[] {
  const selected = new Set(expandSelectionToGroups(blocks, selectedIds));
  const targets = blocks.filter((block) => selected.has(block.block_id) && block.geometry);
  if (targets.length < 2) return blocks;
  const geometries = targets.map((block) => block.geometry!);
  const left = Math.min(...geometries.map((g) => g.x));
  const right = Math.max(...geometries.map((g) => g.x + g.width));
  const top = Math.min(...geometries.map((g) => g.y));
  const bottom = Math.max(...geometries.map((g) => g.y + g.height));
  return blocks.map((block) => {
    if (!selected.has(block.block_id) || !block.geometry) return block;
    const g = block.geometry;
    const patch: Partial<BlockGeometry> = {};
    if (alignment === 'left') patch.x = left;
    if (alignment === 'center') patch.x = (left + right - g.width) / 2;
    if (alignment === 'right') patch.x = right - g.width;
    if (alignment === 'top') patch.y = top;
    if (alignment === 'middle') patch.y = (top + bottom - g.height) / 2;
    if (alignment === 'bottom') patch.y = bottom - g.height;
    return { ...block, geometry: patchGeometry(g, patch) };
  });
}

export function distributeBlocks(
  blocks: CardBlock[],
  selectedIds: string[],
  axis: 'horizontal' | 'vertical'
): CardBlock[] {
  const selected = new Set(expandSelectionToGroups(blocks, selectedIds));
  const targets = blocks
    .filter((block) => selected.has(block.block_id) && block.geometry)
    .sort((a, b) =>
      axis === 'horizontal' ? a.geometry!.x - b.geometry!.x : a.geometry!.y - b.geometry!.y
    );
  if (targets.length < 3) return blocks;
  const first = targets[0].geometry!;
  const last = targets[targets.length - 1].geometry!;
  const start = axis === 'horizontal' ? first.x : first.y;
  const end = axis === 'horizontal' ? last.x : last.y;
  const step = (end - start) / (targets.length - 1);
  const patches = new Map<string, BlockGeometry>();
  targets.forEach((block, index) => {
    patches.set(
      block.block_id,
      patchGeometry(
        block.geometry!,
        axis === 'horizontal' ? { x: start + step * index } : { y: start + step * index }
      )
    );
  });
  return blocks.map((block) =>
    patches.has(block.block_id) ? { ...block, geometry: patches.get(block.block_id)! } : block
  );
}
