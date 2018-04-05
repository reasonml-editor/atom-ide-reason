export default {
  debounce: {
    type: 'object',
    order: 10,
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

  diagnostics: {
    type: 'object',
    order: 20,
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

  format: {
    type: 'object',
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

  path: {
    type: 'object',
    order: 40,
    properties: {
      bsb: {
        type: 'string',
        title: 'bsb',
        description: 'The path to the `bsb` binary.',
        default: 'bsb',
        order: 20,
      },
      bsc: {
        type: 'string',
        title: 'bsc',
        description: 'The path to the `bsc` binary.',
        default: 'bsc',
        order: 10,
      },
      env: {
        type: 'string',
        title: 'env',
        description:
          'The path to the `env` command which prints ' +
          'the language server environment for debugging editor issues.',
        default: 'env',
        order: 30,
      },
      esy: {
        type: 'string',
        title: 'esy',
        description: 'The path to the `esy` binary.',
        default: 'esy',
        order: 40,
      },
      ocamlfind: {
        type: 'string',
        title: 'ocamlfind',
        description: 'The path to the `ocamlfind` binary.',
        default: 'ocamlfind',
        order: 50,
      },
      ocamlmerlin: {
        type: 'string',
        title: 'ocamlmerlin',
        description: 'The path to the `ocamlmerlin` binary.',
        default: 'ocamlmerlin',
        order: 60,
      },
      opam: {
        type: 'string',
        title: 'opam',
        description: 'The path to the `opam` binary.',
        default: 'opam',
        order: 70,
      },
      rebuild: {
        type: 'string',
        title: 'rebuild',
        description: 'The path to the `rebuild` binary.',
        default: 'rebuild',
        order: 80,
      },
      refmt: {
        type: 'string',
        title: 'refmt',
        description: 'The path to the `refmt` binary.',
        default: 'refmt',
        order: 90,
      },
      refmterr: {
        type: 'string',
        title: 'refmterr',
        description: 'The path to the `refmterr` binary.',
        default: 'refmterr',
        order: 100,
      },
      rtop: {
        type: 'string',
        title: 'rtop',
        description: 'The path to the `rtop` binary.',
        default: 'rtop',
        order: 110,
      },
    },
  },

  server: {
    type: 'object',
    order: 50,
    properties: {
      languages: {
        type: 'array',
        title: 'Server languages',
        description:
          'The list of languages enable support for in the language server.',
        items: {
          type: 'string',
          enum: ['ocaml', 'reason'],
        },
        default: ['ocaml', 'reason'],
        order: 10,
      },
    },
  },
};
