/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_OPENAI_API_KEY: string
    readonly VITE_MODEL_INSTRUCTIONS: string
    readonly VITE_API_URL:string
    // more env variables...
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }