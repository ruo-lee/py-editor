import * as monaco from 'monaco-editor';

/**
 * CompletionManager - Manages code completion and snippets
 */
export class CompletionManager {
    constructor(context) {
        this.context = context;
    }

    setupCodeCompletion() {
        // Enhanced Python completions with LSP
        monaco.languages.registerCompletionItemProvider('python', {
            triggerCharacters: ['.', ' '],
            provideCompletionItems: async (model, position) => {
                const result = await this.context.getCompletionItems(model, position);

                // Convert LSP format to Monaco format
                if (result && result.items && Array.isArray(result.items)) {
                    return { suggestions: result.items };
                }

                // If already in Monaco format or invalid, return as is or empty
                if (result && result.suggestions && Array.isArray(result.suggestions)) {
                    return result;
                }

                return { suggestions: [] };
            },
        });

        // Add Python snippets
        monaco.languages.registerCompletionItemProvider('python', {
            triggerCharacters: [' '],
            provideCompletionItems: () => {
                return { suggestions: this.getBasicCompletions() };
            },
        });

        // Enhanced syntax checking
        monaco.languages.registerCodeActionProvider('python', {
            provideCodeActions: (model, range, context) => {
                const actions = [];

                context.markers.forEach((marker) => {
                    if (marker.severity === monaco.MarkerSeverity.Error) {
                        actions.push({
                            title: 'Fix syntax error',
                            kind: 'quickfix',
                            diagnostics: [marker],
                            isPreferred: true,
                        });
                    }
                });

                return { actions, dispose: () => {} };
            },
        });
    }

    getBasicCompletions() {
        const suggestions = [];

        // Add snippet suggestions
        if (this.context.snippets && typeof this.context.snippets === 'object') {
            Object.entries(this.context.snippets).forEach(([_key, snippet]) => {
                suggestions.push({
                    label: snippet.prefix,
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: snippet.body.join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: snippet.description,
                    detail: 'Python Snippet',
                });
            });
        }

        // Add Python keywords
        const keywords = [
            'def',
            'class',
            'import',
            'from',
            'if',
            'elif',
            'else',
            'for',
            'while',
            'try',
            'except',
            'finally',
            'with',
            'as',
            'return',
            'yield',
            'lambda',
            'pass',
            'break',
            'continue',
            'and',
            'or',
            'not',
            'in',
            'is',
            'True',
            'False',
            'None',
        ];

        keywords.forEach((keyword) => {
            suggestions.push({
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                detail: 'Python Keyword',
            });
        });

        // Add built-in functions
        const builtins = [
            'print',
            'len',
            'range',
            'str',
            'int',
            'float',
            'list',
            'dict',
            'set',
            'tuple',
            'open',
            'input',
            'type',
            'isinstance',
            'enumerate',
            'zip',
            'map',
            'filter',
            'sorted',
            'sum',
            'max',
            'min',
        ];

        builtins.forEach((builtin) => {
            suggestions.push({
                label: builtin,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: `${builtin}($0)`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'Built-in Function',
            });
        });

        return suggestions; // Return array directly, not wrapped in object
    }
}
