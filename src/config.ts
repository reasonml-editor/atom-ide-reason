export default {
  server: {
    type: 'object',
    title: 'Language Server',
    order: 10,
    properties: {
      tool: {
        type: 'string',
        title: 'Tool',
        description: 'Requires restart to take effect.',
        order: 10,
        default: 'rls',
        enum: [
          {
            value: 'rls',
            description: 'reason-language-server: recommended.',
          },
          {
            value: 'ols',
            description: 'ocaml-language-server: use it if for some reason `rls` doesn\'t work for you.',
          },
        ],
      },
    },
  },

  rls: {
    type: 'object',
    title: 'Reason Language Server',
    order: 20,
    properties: {
      refmt: {
        type: ['null', 'string'],
        title: 'refmt',
        description: 'Provide a custom location for the `refmt` binary',
        order: 10,
        default: 'refmt',
      },
      lispRefmt: {
        type: ['null', 'string'],
        title: 'lispRefmt',
        description: 'Provide a location for the reason-lisp `lispRefmt` binary',
        order: 20,
        default: 'lispRefmt',
      },
      formatWidth: {
        type: ['null', 'integer'],
        title: 'Format width',
        description: 'Format width',
        order: 30,
        default: 80,
      },
      autoRebuild: {
        type: 'boolean',
        title: 'Auto rebuild on save',
        description: 'Auto-run bsb / done on file save',
        order: 40,
        default: true,
      },
    },
  },

  ols: {
    type: 'object',
    title: 'OCaml Language Server',
    order: 30,
    properties: {
      diagnostics: {
        type: 'object',
        title: 'Diagnostics',
        order: 10,
        properties: {
          tools: {
            type: 'array',
            title: 'Diagnostic tools',
            description:
              'Specifies which tool or tools will be used ' +
              'to get diagnostics. Possible values are `merlin` and `bsb`. ' +
              'If you choose both "merlin" and "bsb", merlin will be used ' +
              'while editing and bsb when saving.',
            items: {
              type: 'string',
              enum: ['merlin', 'bsb'],
            },
            default: ['merlin'],
            order: 10,
          },
        },
      },

      debounce: {
        type: 'object',
        title: 'Debounce',
        order: 20,
        properties: {
          linter: {
            type: 'integer',
            title: 'Linter',
            description:
              'How long to idle (in milliseconds) after keypresses ' +
              'before refreshing linter diagnostics. Smaller values refresh ' +
              'diagnostics more quickly.',
            default: 500,
            order: 10,
          },
        },
      },

      format: {
        type: 'object',
        title: 'Format',
        order: 30,
        properties: {
          width: {
            type: ['null', 'integer'],
            title: 'Line width',
            description:
              'Set the width of lines when formatting code with `refmt`. ' +
              'Leave blank for default.',
            default: null,
            order: 10,
          },
        },
      },

      server: {
        type: 'object',
        title: 'Server',
        order: 40,
        properties: {
          languages: {
            type: 'array',
            title: 'Server languages',
            order: 20,
            description:
              'The list of languages enable support for in the language server.',
            items: {
              type: 'string',
              enum: ['ocaml', 'reason'],
            },
            default: ['ocaml', 'reason'],
          },
        }
      },

      path: {
        type: 'object',
        title: 'Path',
        order: 50,
        properties: {
          bsb: {
            type: 'string',
            title: 'bsb',
            description: 'The path to the `bsb` binary.',
            default: 'bsb',
            order: 10,
          },
          env: {
            type: 'string',
            title: 'env',
            description:
              'The path to the `env` command which prints ' +
              'the language server environment for debugging editor issues.',
            default: 'env',
            order: 20,
          },
          esy: {
            type: 'string',
            title: 'esy',
            description: 'The path to the `esy` binary.',
            default: 'esy',
            order: 30,
          },
          ocamlfind: {
            type: 'string',
            title: 'ocamlfind',
            description: 'The path to the `ocamlfind` binary.',
            default: 'ocamlfind',
            order: 40,
          },
          ocamlmerlin: {
            type: 'string',
            title: 'ocamlmerlin',
            description: 'The path to the `ocamlmerlin` binary.',
            default: 'ocamlmerlin',
            order: 50,
          },
          opam: {
            type: 'string',
            title: 'opam',
            description: 'The path to the `opam` binary.',
            default: 'opam',
            order: 60,
          },
          rebuild: {
            type: 'string',
            title: 'rebuild',
            description: 'The path to the `rebuild` binary.',
            default: 'rebuild',
            order: 70,
          },
          refmt: {
            type: 'string',
            title: 'refmt',
            description: 'The path to the `refmt` binary.',
            default: 'refmt',
            order: 80,
          },
          refmterr: {
            type: 'string',
            title: 'refmterr',
            description: 'The path to the `refmterr` binary.',
            default: 'refmterr',
            order: 90,
          },
          rtop: {
            type: 'string',
            title: 'rtop',
            description: 'The path to the `rtop` binary.',
            default: 'rtop',
            order: 100,
          },
        },
      },
    },
  },

  autocompleteResultsFirst: {
    type: 'boolean',
    title: 'Show Language Server autocomplete results first',
    description:
      'If checked, Language Server suggestions will be placed before ' +
      'the rest of autocomplete results (e.g. snippets etc.). ' +
      'Requires restart to take effect.',
    default: true,
    order: 40,
  },
};
