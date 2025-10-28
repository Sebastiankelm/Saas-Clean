const RULE_NAME = 'enforce-package-exports';

const normalizeOptions = (context) => {
  const [options] = context.options;
  const packages = Array.isArray(options?.packages) ? options.packages : [];
  const allow = Array.isArray(options?.allow) ? new Set(options.allow) : new Set();
  return { packages, allow };
};

const shouldReport = (source, packages, allow) => {
  if (!source || typeof source !== 'string') {
    return { report: false };
  }

  if (allow.has(source)) {
    return { report: false };
  }

  const matched = packages.find((pkg) => source.startsWith(`${pkg}/`));
  if (!matched) {
    return { report: false };
  }

  return {
    report: true,
    pkg: matched,
  };
};

const enforcePackageExportsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Zapobiega importom z głębokich ścieżek w pakietach współdzielonych, wymagając publikacji przez publiczny export.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          packages: {
            type: 'array',
            items: { type: 'string' },
          },
          allow: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDeepImport:
        'Import z "{{actual}}" omija publiczny eksport pakietu "{{pkg}}". Zgłoś eksport lub użyj ścieżki głównej pakietu.',
    },
  },
  create(context) {
    const { packages, allow } = normalizeOptions(context);

    const reportNode = (node, sourceLiteral) => {
      const result = shouldReport(sourceLiteral, packages, allow);
      if (!result.report) {
        return;
      }

      context.report({
        node,
        messageId: 'noDeepImport',
        data: {
          actual: sourceLiteral,
          pkg: result.pkg,
        },
      });
    };

    return {
      ImportDeclaration(node) {
        reportNode(node.source, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          reportNode(node.source, node.source.value);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length > 0
        ) {
          const [arg] = node.arguments;
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            reportNode(arg, arg.value);
          }
        }
      },
      ImportExpression(node) {
        const source = node.source;
        if (source.type === 'Literal' && typeof source.value === 'string') {
          reportNode(source, source.value);
        }
      },
    };
  },
};

export const rules = {
  [RULE_NAME]: enforcePackageExportsRule,
};

export default {
  rules,
};
