import { describe, it, expect } from 'vitest';
import {
  buildBdn,
  tracePaths,
  bdnStats,
  type BdnNode,
  type BdnEdge,
} from '../../../server/src/services/results/benefitsDependencyNetworkService.js';

describe('benefitsDependencyNetworkService', () => {
  describe('buildBdn', () => {
    it('buduje graf enabler→benefit→objective z encji M15', () => {
      const { nodes, edges } = buildBdn({
        initiatives: [
          { id: 'i1', name: 'Automatyzacja onboardingu' },
          { id: 'i2', name: 'Nowy CRM' },
        ],
        kpis: [
          { id: 'k1', name: 'Czas wdrożenia' },
          { id: 'k2', name: 'Konwersja leadów' },
        ],
        objectives: [{ id: 'o1', label: 'Wzrost przychodu' }],
        initiativeToKpi: [
          { initiativeId: 'i1', kpiId: 'k1' },
          { initiativeId: 'i2', kpiId: 'k2' },
        ],
        kpiToObjective: [{ kpiId: 'k2', objectiveId: 'o1' }],
      });

      // 2 enablery + 2 benefity + 1 objective = 5 węzłów
      expect(nodes).toHaveLength(5);
      expect(nodes.find((n) => n.id === 'enabler:i1')).toMatchObject({
        type: 'enabler',
        label: 'Automatyzacja onboardingu',
      });
      expect(nodes.find((n) => n.id === 'benefit:k1')?.type).toBe('benefit');
      expect(nodes.find((n) => n.id === 'objective:o1')?.type).toBe('objective');

      // krawędzie: i1→k1, i2→k2 (enabler→benefit), k2→o1 (benefit→objective)
      expect(edges).toEqual(
        expect.arrayContaining([
          { fromId: 'enabler:i1', toId: 'benefit:k1' },
          { fromId: 'enabler:i2', toId: 'benefit:k2' },
          { fromId: 'benefit:k2', toId: 'objective:o1' },
        ]),
      );
      expect(edges).toHaveLength(3);
    });

    it('pomija krawędzie do nieznanych encji i deduplikuje', () => {
      const { edges } = buildBdn({
        initiatives: [{ id: 'i1', name: 'A' }],
        kpis: [{ id: 'k1', name: 'K' }],
        initiativeToKpi: [
          { initiativeId: 'i1', kpiId: 'k1' },
          { initiativeId: 'i1', kpiId: 'k1' }, // duplikat
          { initiativeId: 'i1', kpiId: 'kX' }, // nieznany KPI
          { initiativeId: 'iX', kpiId: 'k1' }, // nieznana inicjatywa
        ],
      });
      expect(edges).toEqual([{ fromId: 'enabler:i1', toId: 'benefit:k1' }]);
    });

    it('domyślnie nie tworzy syntetycznych węzłów change', () => {
      const { nodes } = buildBdn({
        initiatives: [{ id: 'i1', name: 'A' }],
        kpis: [{ id: 'k1', name: 'K' }],
        initiativeToKpi: [{ initiativeId: 'i1', kpiId: 'k1' }],
      });
      expect(nodes.some((n) => n.type === 'change')).toBe(false);
    });
  });

  describe('tracePaths', () => {
    it('zwraca ścieżki od węzła do liści', () => {
      const { nodes, edges } = buildBdn({
        initiatives: [{ id: 'i1', name: 'A' }],
        kpis: [
          { id: 'k1', name: 'K1' },
          { id: 'k2', name: 'K2' },
        ],
        objectives: [{ id: 'o1', label: 'O1' }],
        initiativeToKpi: [
          { initiativeId: 'i1', kpiId: 'k1' },
          { initiativeId: 'i1', kpiId: 'k2' },
        ],
        kpiToObjective: [{ kpiId: 'k1', objectiveId: 'o1' }],
      });

      const paths = tracePaths(nodes, edges, 'enabler:i1');
      expect(paths).toEqual(
        expect.arrayContaining([
          ['enabler:i1', 'benefit:k1', 'objective:o1'],
          ['enabler:i1', 'benefit:k2'],
        ]),
      );
      expect(paths).toHaveLength(2);
    });

    it('zwraca [] dla nieznanego węzła startowego', () => {
      const { nodes, edges } = buildBdn({
        initiatives: [{ id: 'i1', name: 'A' }],
        kpis: [],
        initiativeToKpi: [],
      });
      expect(tracePaths(nodes, edges, 'brak')).toEqual([]);
    });

    it('zwraca pojedynczy węzeł dla liścia bez wyjść', () => {
      const { nodes, edges } = buildBdn({
        initiatives: [{ id: 'i1', name: 'A' }],
        kpis: [],
        initiativeToKpi: [],
      });
      expect(tracePaths(nodes, edges, 'enabler:i1')).toEqual([['enabler:i1']]);
    });

    it('jest bezpieczny na cykle (nie zapętla się)', () => {
      const nodes: BdnNode[] = [
        { id: 'a', type: 'enabler', label: 'A' },
        { id: 'b', type: 'benefit', label: 'B' },
        { id: 'c', type: 'objective', label: 'C' },
      ];
      const edges: BdnEdge[] = [
        { fromId: 'a', toId: 'b' },
        { fromId: 'b', toId: 'c' },
        { fromId: 'c', toId: 'a' }, // cykl c→a
      ];
      const paths = tracePaths(nodes, edges, 'a');
      // ścieżka kończy się gdy krawędź zamyka cykl
      expect(paths).toEqual([['a', 'b', 'c']]);
    });
  });

  describe('bdnStats', () => {
    it('liczy węzły/krawędzie i grupuje po typie', () => {
      const { nodes, edges } = buildBdn({
        initiatives: [
          { id: 'i1', name: 'A' },
          { id: 'i2', name: 'B' },
        ],
        kpis: [{ id: 'k1', name: 'K' }],
        objectives: [{ id: 'o1', label: 'O' }],
        initiativeToKpi: [
          { initiativeId: 'i1', kpiId: 'k1' },
          { initiativeId: 'i2', kpiId: 'k1' },
        ],
        kpiToObjective: [{ kpiId: 'k1', objectiveId: 'o1' }],
      });

      const stats = bdnStats(nodes, edges);
      expect(stats.nodeCount).toBe(4);
      expect(stats.edgeCount).toBe(3);
      expect(stats.byType).toEqual({
        enabler: 2,
        change: 0,
        benefit: 1,
        objective: 1,
      });
      expect(stats.orphanBenefits).toEqual([]);
    });

    it('wykrywa benefity-sieroty bez krawędzi do objective', () => {
      const { nodes, edges } = buildBdn({
        initiatives: [{ id: 'i1', name: 'A' }],
        kpis: [
          { id: 'k1', name: 'powiązany' },
          { id: 'k2', name: 'sierota' },
        ],
        objectives: [{ id: 'o1', label: 'O' }],
        initiativeToKpi: [
          { initiativeId: 'i1', kpiId: 'k1' },
          { initiativeId: 'i1', kpiId: 'k2' },
        ],
        kpiToObjective: [{ kpiId: 'k1', objectiveId: 'o1' }],
      });

      const stats = bdnStats(nodes, edges);
      expect(stats.orphanBenefits).toEqual(['benefit:k2']);
    });
  });
});
