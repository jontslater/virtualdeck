/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BATTLE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
