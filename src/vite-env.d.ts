/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_I18N_DEBUG: string;
  readonly VITE_NAV_DEBUG: string;
  readonly VITE_GA_MEASUREMENT_ID: string;
  readonly VITE_ANALYTICS_DEBUG: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly glob: any;
  readonly hot: {
    accept: (cb?: (mod: any) => void) => void;
    dispose: (cb: (data: any) => void) => void;
  };
}
