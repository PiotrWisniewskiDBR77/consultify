declare module 'pptxgenjs' {
  interface TextOptions {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    fontSize?: number;
    fontFace?: string;
    bold?: boolean;
    color?: string;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    bullet?: boolean;
    paraSpaceAfter?: number;
    // Rozszerzenie 2026-09-06: realne API pptxgenjs 4.0.1 zna te opcje
    // (types/index.d.ts `TextPropsOptions`), a ten ręczny shim ich nie
    // wymieniał — dopisane addytywnie (same pola opcjonalne, więc żaden
    // istniejący wołacz się nie zmienia).
    italic?: boolean;
    charSpacing?: number;
    lineSpacing?: number;
    lineSpacingMultiple?: number;
    breakLine?: boolean;
    fill?: { color: string };
    margin?: number | number[];
    isTextBox?: boolean;
  }

  interface TextProps {
    text: string;
    options?: TextOptions;
  }

  interface SlideMasterOptions {
    title: string;
    background?: { color: string };
    objects?: Array<{
      text?: string;
      options?: TextOptions;
      placeholder?: {
        name: string;
        type: string;
        options?: TextOptions;
        text?: string;
      };
      rect?: {
        x: number;
        y: number;
        w: number;
        h: number;
        fill?: { color: string };
        line?: { color: string };
      };
    }>;
  }

  interface ShapeOptions {
    x: number;
    y: number;
    w: number;
    h: number;
    fill?: { color: string };
    line?: { color: string; width?: number; dashType?: string };
  }

  interface ChartOptions {
    x: number;
    y: number;
    w: number;
    h: number;
    barDir?: 'bar' | 'col';
    barGapWidthPct?: number;
    showValue?: boolean;
    valAxisMaxVal?: number;
    catAxisTitle?: string;
    valAxisTitle?: string;
    chartColors?: string[];
    showLegend?: boolean;
    legendPos?: 'b' | 't' | 'l' | 'r';
    h?: number;
    barGrouping?: 'clustered' | 'stacked' | 'percentStacked' | 'standard';
    legendFontFace?: string;
    legendFontSize?: number;
    catAxisLabelFontFace?: string;
    catAxisLabelFontSize?: number;
    valAxisLabelFontFace?: string;
    valAxisLabelFontSize?: number;
    valAxisMinVal?: number;
    valAxisMajorUnit?: number;
    dataBorder?: { pt?: number; color?: string };
    catGridLine?: { color?: string; style?: string; size?: number };
    valGridLine?: { color?: string; style?: string; size?: number };
  }

  /** Jedna seria wykresu w realnym API pptxgenjs 4.0.1: `addChart` przyjmuje
   * TABLICĘ serii, a nie obiekt `{labels, data}` — shim opisywał kształt,
   * którego biblioteka nie przyjmuje. Stary alias zostaje dla zgodności. */
  interface ChartSeries {
    name: string;
    labels: string[];
    values: number[];
  }

  interface ChartData {
    labels: string[];
    data: Array<{ name: string; values: number[] }>;
  }

  interface Slide {
    addText(text: string | TextProps[], options?: TextOptions): void;
    addShape(shapeType: string, options: ShapeOptions): void;
    addChart(chartType: string, data: ChartData | ChartSeries[], options: ChartOptions): void;
    addTable(rows: Array<Array<TextProps>>, options?: { x?: number; y?: number; w?: number; h?: number; colW?: number[]; border?: { type?: string; pt?: number; color?: string }; fontFace?: string; autoPage?: boolean; valign?: 'top' | 'middle' | 'bottom'; margin?: number | number[] }): void;
    background?: { color: string };
  }

  export type { Slide, TextProps, ChartData, ChartSeries, TextOptions };

  interface WriteOptions {
    outputType?: 'nodebuffer' | 'blob' | 'base64';
  }

  class PptxGenJS {
    layout: string;
    author: string;
    title: string;
    subject: string;
    company: string;
    ShapeType: {
      rect: string;
      ellipse: string;
      triangle: string;
      line: string;
      [key: string]: string;
    };
    ChartType: {
      bar: string;
      line: string;
      pie: string;
      area: string;
      [key: string]: string;
    };
    addSlide(options?: { masterName?: string }): Slide;
    defineSlideMaster(options: SlideMasterOptions): void;
    write(options?: WriteOptions): Promise<Buffer | Blob | string>;
    writeFile(options: { fileName: string }): Promise<void>;
  }

  export default PptxGenJS;
}
