declare module 'pptxgenjs' {
  interface TextOptions {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    fontSize?: number;
    bold?: boolean;
    color?: string;
    align?: 'left' | 'center' | 'right';
  }

  interface Slide {
    addText(text: string, options?: TextOptions): void;
  }

  class PptxGenJS {
    layout: string;
    addSlide(): Slide;
    writeFile(fileName: string | { fileName: string }): Promise<void>;
  }

  export default PptxGenJS;
}
