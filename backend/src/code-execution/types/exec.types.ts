export type ExecLanguage = 'python' | 'sql';

export interface ExecFileInput {
  name: string;
  kind: 'csv' | 'json';
  ref: string;
}

export interface ExecRequest {
  language: ExecLanguage;
  code: string;
  inputs: {
    files?: ExecFileInput[];
    params?: Record<string, unknown>;
  };
  expected?: {
    resultKeys: string[];
  };
}

export interface ExecArtifact {
  kind: 'plot' | 'table' | 'file';
  name: string;
  ref: string;
}

export interface ExecResponse {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  results?: Record<string, unknown>;
  artifacts?: ExecArtifact[];
  metrics: {
    durationMs: number;
    cpuMs?: number;
    memoryMb?: number;
  };
  engine: 'python-subprocess' | 'local-fallback' | 'docker' | 'docker-disabled' | 'validation';
}

export interface ExecutionLimits {
  timeoutMs?: number;
  maxOutputBytes?: number;
  maxResultRows?: number;
}
