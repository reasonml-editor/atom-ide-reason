## 1.1.4
* Add `formatOnSave` option to settings.
* Fix cursor position after format on save.

## 1.1.3
* Bump `reason-language-server` to `1.4.1`.
* Add `autoRebuild` option to settings.
* Add `autocompleteResultsFirst` option to settings.

## 1.1.2
* Bump `reason-language-server` to `1.3.0`.

## 1.1.1
* Bump `reason-language-server` to `1.2.4`.

## 1.1.0
* Bump `reason-language-server` to `1.1.0`.
* Reduce number of dispatched files on change.

## 1.0.1
* Bump `reason-language-server` to `1.0.4`.
* Fix interfaces files generator for Lerna / Yarn Workspaces users.

## 1.0.0
* Add `reason-language-server` support (`ocaml-language-server` is still supported).

This is a breaking change. Update you Atom configuration by scoping `ocaml-language-server` settings under `ols` key, e.g.:

```diff
- "ide-reason":
-   diagnostics:
-     tools: ["bsb"]

+ "ide-reason":
+   ols:
+     diagnostics:
+       tools: ["bsb"]
```


## 0.1.13
* Add interfaces files generator (`rei` & `mli`).
* Auto dismiss error messages related to `Broken pipe`.

## 0.1.12
* Add `ocaml-language-server` configuration interface.
* Add custom configuration per project.
