export { DeepPartial } from 'deepmerge'
import { ISettings } from 'ocaml-language-server'

export type Config = ISettings['reason']

export type ToolKeys = keyof Config["path"];
