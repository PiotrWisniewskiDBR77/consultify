export const CREATOR_SHELL_GEOMETRY = {
  stepped: {
    width: 1040,
    height: 840,
    panelClassName:
      'h-[min(840px,calc(100vh-48px))] w-[min(1040px,calc(100vw-64px))] max-[1023px]:h-screen max-[1023px]:max-h-screen max-[1023px]:w-screen max-[1023px]:max-w-none max-[1023px]:rounded-none',
  },
  compact: { width: 840, height: 680 },
  legacy: {
    width: 720,
    height: 560,
    panelClassName: 'h-[560px] w-[720px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]',
    initiativePanelClassName:
      'h-[640px] w-[1080px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]',
  },
} as const;

export type WizardGeometry = 'legacy' | 'creator';
