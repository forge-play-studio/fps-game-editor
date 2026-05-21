/// <reference types="vite/client" />

// 声明静态资源模块类型

declare module '*.glb?url' {
  const src: string;
  export default src;
}

declare module '*.png?url' {
  const src: string;
  export default src;
}

declare module '*.jpg?url' {
  const src: string;
  export default src;
}

declare module '*.svg?url' {
  const src: string;
  export default src;
}

declare module '*.wav?url' {
  const src: string;
  export default src;
}

declare module '*.mp3?url' {
  const src: string;
  export default src;
}

declare module '*.env' {
  const src: string;
  export default src;
}

declare const __LITE_BUILD__: boolean;
declare const __PROD_BUILD__: boolean;

// 在某些环境下（例如仅跑 tsc 且未安装完整 Vite 类型）
// 这里补充最小的 import.meta.env 类型，避免 TS2339。
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  // 自定义环境变量可按需补充
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
