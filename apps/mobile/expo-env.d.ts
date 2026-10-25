/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SITE_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
}