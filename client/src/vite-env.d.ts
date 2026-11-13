/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface HCaptchaApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string | number;
  reset(id?: string | number): void;
}
interface Window { hcaptcha?: HCaptchaApi; }
