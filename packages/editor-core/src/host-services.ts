export type EditorHostMaybePromise<T> = T | Promise<T>;

export interface EditorHostCapabilities {
  editorHostStorage?: boolean;
  [key: string]: unknown;
}

export interface EditorHostBootState {
  apiVersion: string;
  sandboxId?: string;
  capabilities?: EditorHostCapabilities;
  metadata?: Record<string, unknown>;
}

export interface EditorHostStorageProvider {
  get<TValue = unknown>(key: string): EditorHostMaybePromise<TValue | null>;
  set(key: string, value: unknown): EditorHostMaybePromise<void>;
  delete(key: string): EditorHostMaybePromise<void>;
}

export interface EditorHostBootStateProvider {
  read(): EditorHostMaybePromise<EditorHostBootState | null>;
}

export interface EditorHostServices {
  storage?: EditorHostStorageProvider;
  bootState?: EditorHostBootStateProvider;
}
