import { ISettings } from 'ocaml-language-server'
export { DeepPartial } from 'deepmerge'

export type OLSConfig = ISettings['reason']

export interface Config extends OLSConfig {
  path: OLSConfig['path'] & { bsc: string }
}

export type ToolKeys = keyof Config['path'];

export type FileExtension = 're' | 'ml';
