/**
 * MindMapFrameNode — ramka (typ `group`) na płótnie Mapy Myśli.
 *
 * PRZED (2026-07-27): typ `group` NIE BYŁ zarejestrowany w `nodeTypes` Mapy
 * Myśli, więc reactflow rysował go wbudowanym węzłem `group` — gołym
 * prostokątem BEZ etykiety i BEZ jakiejkolwiek możliwości zmiany rozmiaru.
 * Ramkę tworzą `mm_add_frame` i `mm_group` (Ctrl+G) w useMindMapQuickActions.
 *
 * PO: własny komponent = ten sam wzorzec co `whiteboard/nodes/FrameNode`:
 * `NodeResizer` widoczny przy zaznaczeniu + nagłówek z etykietą. Pudełko
 * ramki (kreskowana obwódka, tło, promień) nadal rysuje `node.style` nadany
 * przy tworzeniu — reactflow wkłada je na sam wrapper węzła, więc komponent
 * ma tylko wypełnić je treścią, a nie rysować drugą obwódkę.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeProps } from 'reactflow';

import { MM_MIN_FRAME_HEIGHT, MM_MIN_FRAME_WIDTH, MindMapNodeResizer } from './MindMapNodeResizer';

export const MindMapFrameNode: React.FC<NodeProps> = React.memo(({ data, selected }) => {
  const { t } = useTranslation();
  const label = String(data?.label || t('mindmap.frameNode.defaultLabel', 'Ramka'));

  return (
    <>
      <MindMapNodeResizer
        selected={selected}
        locked={Boolean(data?.locked)}
        minWidth={MM_MIN_FRAME_WIDTH}
        minHeight={MM_MIN_FRAME_HEIGHT}
      />
      <div
        className={`w-full h-full flex flex-col items-start rounded-[inherit] ${
          selected ? 'ring-2 ring-c-focus-solid' : ''
        }`}
      >
        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-c-text-secondary truncate max-w-full">
          {label}
        </div>
      </div>
    </>
  );
});
MindMapFrameNode.displayName = 'MindMapFrameNode';
