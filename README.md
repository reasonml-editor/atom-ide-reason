# ide-reason package

ReasonML/OCaml language support for Atom-IDE.

Using [ocaml-language-server](https://github.com/freebroccolo/ocaml-language-server) under the hood, the same as [vscode-reasonml](https://github.com/reasonml-editor/vscode-reasonml/).

Thanks for [@freebroccolo](https://github.com/freebroccolo) and all of [ocaml-language-server](https://github.com/freebroccolo/ocaml-language-server)'s contributors!

![](https://github.com/reasonml-editor/atom-ide-reason/blob/master/docs/capture.gif?raw=true)

## Installation
Search for `ide-reason` package or via `apm`:

```
apm install ide-reason
```

## Requirements
* ocaml
* [merlin](https://github.com/ocaml/merlin)
* [atom-ide-ui](https://atom.io/packages/atom-ide-ui) or [nuclide](https://atom.io/packages/nuclide)
* language syntax package
  * [language-ocaml](https://atom.io/packages/language-ocaml) for ocaml
  * [language-reason](https://atom.io/packages/language-reason) for reason
* [BuckleScript](https://bucklescript.github.io/docs/en/installation.html) to use `bsb` as diagnostic tool & to generate interface files<br>
_If you use global installation, everything should work out of the box. Otherwise, configure path to your `bsb` & `bsc` binaries via package settings or project config._

## Custom configuration per project
You can add configuration per project by adding `.atom/ide-reason.json`, which can be generated via command `ide-reason:generate-config`. Custom configuration will be merged with global one.

## Interface files generator
You can generate interface files (`rei` & `mli`) right from your editor.

### Via context menu
* right click in buffer with `.re`/`.ml` file -> `Generate Reason/OCaml interface`
* right click on `.re`/`.ml` file in tree view -> `Generate Reason/OCaml interface`<br>
  _You must click exactly on filename, not on the file's row._

### Via command
```
ide-reason:generate-interface
```

No default keybinding is set, but it can be configured in your keymap.

```cson
'atom-workspace atom-text-editor:not([mini])':
  'ctrl-alt-g': 'ide-reason:generate-interface'
```
