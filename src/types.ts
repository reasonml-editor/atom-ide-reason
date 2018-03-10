import { ISettings } from 'ocaml-language-server'
export { DeepPartial } from 'deepmerge'

export type OLSConfig = ISettings['reason']

export type Config = {
  codelens: OLSConfig['codelens'];
  debounce: OLSConfig['debounce'];
  diagnostics: OLSConfig['diagnostics'];
  path: OLSConfig['path'] & { bsc: string; };
  format: OLSConfig['format'];
  server: OLSConfig['server'];
}

export type ToolKeys = keyof Config['path'];

export type FileExtension = 're' | 'ml';
