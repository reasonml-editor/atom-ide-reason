# ide-reason package

ReasonML/OCaml language support for Atom-IDE.

Using [ocaml-language-server](https://github.com/freebroccolo/ocaml-language-server) under the hood, the same as [vscode-reasonml](https://github.com/reasonml-editor/vscode-reasonml/).

Thanks for [@freebroccolo](https://github.com/freebroccolo) and all of [ocaml-language-server](https://github.com/freebroccolo/ocaml-language-server)'s contributors!

![](https://cdn.rawgit.com/zaaack/atom-ide-reason/aa8791e1/docs/capture.gif)

## Requirements

* ocaml
* [merlin](https://github.com/ocaml/merlin)
* [atom-ide-ui](https://atom.io/packages/atom-ide-ui) or [nuclide](https://atom.io/packages/nuclide)
* language syntax package
  * [language-ocaml](https://atom.io/packages/language-ocaml) for ocaml
  * [language-reason](https://atom.io/packages/language-reason) for reason

## Custom toolchain path per project

Add one line in your `package.json`, multi path can be separated by comma (",").

```json
{
  "name": "My Awesome Project",
  "version": "0.1.0",
  //...
  "reasonToolchainPath": "/path/to/your/toolchain",
}
```

Or, a separated config file for `ide-reason`, `ide-reason.json`. Currently only support one field:

```js
{
  "toolchainPath": "/path/to/your/toolchain"
}
```
