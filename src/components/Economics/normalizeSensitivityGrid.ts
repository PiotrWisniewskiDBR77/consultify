export interface NormalizedSensitivityGrid {
  columnHeaders: Array<string | number>;
  rowHeaders: Array<string | number>;
  values: Array<Array<number | null>>;
}

type SensitivityCell = {
  wacc?: unknown;
  g?: unknown;
  ev?: unknown;
};

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentHeader(value: number): string {
  return `${value}%`;
}

export function normalizeSensitivityGrid(sensitivity: any): NormalizedSensitivityGrid | null {
  if (!sensitivity || typeof sensitivity !== 'object') return null;

  const rawMatrix = sensitivity.matrix ?? sensitivity.grid;
  if (Array.isArray(rawMatrix) && rawMatrix.length > 0 && rawMatrix.every(Array.isArray)) {
    const values = rawMatrix.map((row: unknown[]) => row.map(finiteNumber));
    const width = Math.max(...values.map((row: Array<number | null>) => row.length));
    if (
      width === 0 ||
      values.every((row: Array<number | null>) => row.every((value) => value == null))
    ) {
      return null;
    }
    return {
      columnHeaders: Array.isArray(sensitivity.colHeaders)
        ? sensitivity.colHeaders
        : Array.isArray(sensitivity.waccGrid)
          ? sensitivity.waccGrid
          : [],
      rowHeaders: Array.isArray(sensitivity.rowHeaders)
        ? sensitivity.rowHeaders
        : Array.isArray(sensitivity.gGrid)
          ? sensitivity.gGrid
          : Array.isArray(sensitivity.multipleGrid)
            ? sensitivity.multipleGrid
            : [],
      values,
    };
  }

  const table = Array.isArray(sensitivity.table) ? sensitivity.table : null;
  if (table?.length) {
    const values = table.map((row: any) =>
      Array.isArray(row?.values) ? row.values.map(finiteNumber) : []
    );
    if (values.some((row: Array<number | null>) => row.some((value) => value != null))) {
      return {
        columnHeaders: Array.isArray(sensitivity.colHeaders) ? sensitivity.colHeaders : [],
        rowHeaders: table.map((row: any, index: number) => row?.label ?? index + 1),
        values,
      };
    }
  }

  if (!Array.isArray(rawMatrix) || rawMatrix.length === 0) return null;
  const cells = rawMatrix
    .map((cell: SensitivityCell) => ({
      wacc: finiteNumber(cell?.wacc),
      g: finiteNumber(cell?.g),
      ev: finiteNumber(cell?.ev),
    }))
    .filter(
      (cell: { wacc: number | null; g: number | null; ev: number | null }) =>
        cell.wacc != null && cell.g != null && cell.ev != null
    ) as Array<{ wacc: number; g: number; ev: number }>;
  if (cells.length === 0) return null;

  const waccValues = [...new Set(cells.map((cell) => cell.wacc))].sort((a, b) => a - b);
  const growthValues = [...new Set(cells.map((cell) => cell.g))].sort((a, b) => a - b);
  const lookup = new Map(cells.map((cell) => [`${cell.wacc}:${cell.g}`, cell.ev]));

  return {
    columnHeaders: growthValues.map(percentHeader),
    rowHeaders: waccValues.map(percentHeader),
    values: waccValues.map((wacc) =>
      growthValues.map((growth) => lookup.get(`${wacc}:${growth}`) ?? null)
    ),
  };
}
