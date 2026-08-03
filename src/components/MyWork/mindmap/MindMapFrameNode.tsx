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

import { canvasObjectTextStyle, readCanvasObjectStyle } from '../canvas/canvasObjectStyle';
import { MindMapNodeResizer, MM_MIN_FRAME_HEIGHT, MM_MIN_FRAME_WIDTH } from './MindMapNodeResizer';

export const MindMapFrameNode: React.FC<NodeProps> = React.memo(({ data, selected }) => {
  const { t } = useTranslation();
  const label = String(data?.label || t('mindmap.frameNode.defaultLabel', 'Ramka'));
  // PUŁAPKA (opisana w audycie): pudełko ramki rysuje `node.style` na wrapperze
  // reactflow, a NIE `node.data` — dlatego tło i ramkę wybrane w pasku
  // przepisuje handler zapisu (`applyFrameStyleToNode` w IdeaRecommendationMap)
  // prosto na `node.style`. Tu zostaje tylko typografia etykiety, która żyje
  // wewnątrz komponentu i z `node.style` by nie dojechała.
  const frameText = canvasObjectTextStyle(readCanvasObjectStyle(data));

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
        <div
          style={frameText}
          className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-c-text-secondary truncate max-w-full"
        >
          {label}
        </div>
      </div>
    </>
  );
});
MindMapFrameNode.displayName = 'MindMapFrameNode';
