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
    line?: { color: string };
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
  }

  interface ChartData {
    labels: string[];
    data: Array<{ name: string; values: number[] }>;
  }

  interface Slide {
    addText(text: string | TextProps[], options?: TextOptions): void;
    addShape(shapeType: string, options: ShapeOptions): void;
    addChart(chartType: string, data: ChartData, options: ChartOptions): void;
    addTable(rows: Array<Array<TextProps>>, options?: { x?: number; y?: number; w?: number; h?: number; colW?: number[]; border?: { pt?: number; color?: string }; fontFace?: string }): void;
  }

  export type { Slide, TextProps, ChartData };

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
