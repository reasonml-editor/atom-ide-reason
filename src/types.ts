import { ISettings } from 'ocaml-language-server'
export { DeepPartial } from 'deepmerge'

export type OLSConfig = ISettings['reason']

export interface RLSConfig {
  refmt: string | null,
  lispRefmt: string | null,
  formatWidth: number | null,
}

export interface Config {
  server: { tool: 'rls' | 'ols' },
  rls: RLSConfig,
  ols: OLSConfig,
  interfaceGenerator: { bsc: string },
}

export type OLSToolKeys = keyof OLSConfig['path'];

export type FileExtension = 're' | 'ml';
