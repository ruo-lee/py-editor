/**
 * LocalModuleResolver.js
 * Resolves local module imports when LSP fails to find definitions
 * Handles relative imports like "from .utils import something"
 */

export class LocalModuleResolver {
    constructor(context) {
        this.context = context;

        // Common external packages that should NOT be resolved as local modules
        this.externalPackages = new Set([
            'fastapi',
            'pydantic',
            'uvicorn',
            'starlette',
            'django',
            'flask',
            'requests',
            'numpy',
            'pandas',
            'sqlalchemy',
            'alembic',
            'celery',
            'redis',
            'boto3',
            'botocore',
            'pytest',
            'unittest',
            'asyncio',
            'aiohttp',
            'httpx',
            'websockets',
            'jinja2',
            'jwt',
            'cryptography',
            'bcrypt',
            'pillow',
            'opencv',
            'matplotlib',
            'scipy',
            'sklearn',
            'tensorflow',
            'torch',
            'keras',
        ]);
    }

    /**
     * Check if a file exists on the server
     */
    async fileExists(filepath) {
        try {
            const workspaceFolder = this.context.workspaceFolder;
            const url = `/api/files/${filepath}${workspaceFolder ? `?folder=${workspaceFolder}` : ''}`;
            const response = await fetch(this.context.buildUrl(url), {
                method: 'HEAD',
                headers: this.context.getFetchHeaders(),
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Find which file a symbol is imported from by analyzing all imports in current file
     * This is used when LSP fails to find definition for a symbol usage (not import line)
     */
    async findSymbolSource(model, symbolName, activeFile) {
        const lineCount = model.getLineCount();

        // Scan all lines for import statements
        for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
            const lineContent = model.getLineContent(lineNum);
            const importMatch = this.parseImportStatement(lineContent);

            if (!importMatch) continue;

            // Check if this import includes our symbol
            if (importMatch.symbols.includes(symbolName)) {
                // Resolve the module path
                const modulePath = await this.resolveModulePath(
                    activeFile,
                    importMatch.module,
                    importMatch.isRelative
                );

                if (modulePath) {
                    // Check if file actually exists before returning
                    const exists = await this.fileExists(modulePath);
                    if (exists) {
                        return {
                            filePath: modulePath,
                            symbol: symbolName,
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Try to resolve a local module import
     */
    async resolveLocalImport(model, position, activeFile) {
        // Get the line content
        const lineContent = model.getLineContent(position.lineNumber);

        // Check if it's an import statement
        const importMatch = this.parseImportStatement(lineContent);
        if (!importMatch) {
            return null;
        }

        // Get the word at cursor position
        const word = model.getWordAtPosition(position);
        if (!word) {
            return null;
        }

        // Resolve the module path
        const modulePath = await this.resolveModulePath(
            activeFile,
            importMatch.module,
            importMatch.isRelative
        );

        if (!modulePath) {
            return null;
        }

        // Check if file actually exists before returning
        const exists = await this.fileExists(modulePath);
        if (!exists) {
            return null;
        }

        // For "from module import name" - try to find the symbol in the module
        if (importMatch.type === 'from-import' && importMatch.symbols.includes(word.word)) {
            return {
                filePath: modulePath,
                symbol: word.word,
            };
        }

        // For "import module" - just open the module file
        if (importMatch.type === 'import' && importMatch.module === word.word) {
            return {
                filePath: modulePath,
                symbol: null,
            };
        }

        return null;
    }

    /**
     * Parse import statement
     */
    parseImportStatement(line) {
        // from .module import symbol1, symbol2
        // from ..module import symbol
        // from module import symbol
        // import module
        // import module as alias

        // Match: from <module> import <symbols>
        const fromImportMatch = line.match(/^\s*from\s+(\.{0,2}[\w.]*)\s+import\s+([\w,\s*]+)/);
        if (fromImportMatch) {
            const module = fromImportMatch[1];
            const symbolsStr = fromImportMatch[2];
            const symbols = symbolsStr.split(',').map((s) => s.trim().split(' as ')[0].trim());
            const isRelative = module.startsWith('.');

            return {
                type: 'from-import',
                module,
                symbols,
                isRelative,
            };
        }

        // Match: import <module>
        const importMatch = line.match(/^\s*import\s+(\.{0,2}[\w.]+)(?:\s+as\s+\w+)?/);
        if (importMatch) {
            const module = importMatch[1];
            const isRelative = module.startsWith('.');

            return {
                type: 'import',
                module,
                symbols: [module],
                isRelative,
            };
        }

        return null;
    }

    /**
     * Resolve module path to file path
     */
    async resolveModulePath(currentFile, moduleName, isRelative) {
        if (isRelative) {
            return this.resolveRelativePath(currentFile, moduleName);
        } else {
            return this.resolveAbsolutePath(moduleName);
        }
    }

    /**
     * Resolve relative import path
     * e.g., from .utils import sse -> sandboxes/utils/sse.py
     */
    resolveRelativePath(currentFile, moduleName) {
        // Get current file directory
        const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));

        // Count leading dots
        let dotCount = 0;
        while (moduleName[dotCount] === '.') {
            dotCount++;
        }

        // Remove leading dots from module name
        const cleanModuleName = moduleName.substring(dotCount);

        // Go up directories based on dot count
        let targetDir = currentDir;
        for (let i = 1; i < dotCount; i++) {
            const lastSlash = targetDir.lastIndexOf('/');
            if (lastSlash > 0) {
                targetDir = targetDir.substring(0, lastSlash);
            }
        }

        // Convert module name to path
        const modulePath = cleanModuleName.replace(/\./g, '/');

        // Try different extensions
        const possiblePaths = [
            `${targetDir}/${modulePath}.py`,
            `${targetDir}/${modulePath}/__init__.py`,
            `${targetDir}/${modulePath}.pyi`,
        ];

        // Return the first path that might exist
        // We can't easily check existence from client, so return the most likely
        return possiblePaths[0];
    }

    /**
     * Check if module is a known external package
     */
    isExternalPackage(moduleName) {
        // Get the root package name (e.g., 'fastapi.routing' -> 'fastapi')
        const rootPackage = moduleName.split('.')[0];
        return this.externalPackages.has(rootPackage);
    }

    /**
     * Resolve absolute import path (for workspace modules)
     */
    resolveAbsolutePath(moduleName) {
        // Skip known external packages
        if (this.isExternalPackage(moduleName)) {
            return null;
        }

        // Convert module name to path
        const modulePath = moduleName.replace(/\./g, '/');

        // Try different extensions
        const possiblePaths = [
            `${modulePath}.py`,
            `${modulePath}/__init__.py`,
            `${modulePath}.pyi`,
        ];

        return possiblePaths[0];
    }

    /**
     * Find symbol definition in a file
     */
    async findSymbolInFile(filePath, symbolName) {
        try {
            // Check if file is already open in either editor
            let openTab = this.context.openTabs.get(filePath);
            if (!openTab && this.context.rightOpenTabs) {
                openTab = this.context.rightOpenTabs.get(filePath);
            }

            if (openTab && openTab.model) {
                return this.searchSymbolInModel(openTab.model, symbolName);
            }

            // File not open - need to open it temporarily to search
            await this.context.fileLoader.openFile(filePath, 'left');

            // Wait a bit for file to load
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Try again after opening
            openTab = this.context.openTabs.get(filePath);
            if (openTab && openTab.model) {
                return this.searchSymbolInModel(openTab.model, symbolName);
            }

            // Still failed, return line 1
            console.warn(`Could not find symbol '${symbolName}' in ${filePath}`);
            return {
                lineNumber: 1,
                column: 1,
            };
        } catch (error) {
            console.warn('Failed to find symbol in file:', error);
            return {
                lineNumber: 1,
                column: 1,
            };
        }
    }

    /**
     * Search for symbol definition in model
     */
    searchSymbolInModel(model, symbolName) {
        const lineCount = model.getLineCount();

        // Look for function or class definitions
        const patterns = [
            { regex: new RegExp(`^\\s*def\\s+${symbolName}\\s*\\(`), name: 'function def' },
            { regex: new RegExp(`^\\s*async\\s+def\\s+${symbolName}\\s*\\(`), name: 'async def' },
            { regex: new RegExp(`^\\s*class\\s+${symbolName}\\s*[:(]`), name: 'class def' },
            { regex: new RegExp(`^\\s*${symbolName}\\s*=`), name: 'assignment' },
        ];

        for (let i = 1; i <= lineCount; i++) {
            const lineContent = model.getLineContent(i);

            for (const pattern of patterns) {
                if (pattern.regex.test(lineContent)) {
                    const column = lineContent.indexOf(symbolName) + 1;
                    return {
                        lineNumber: i,
                        column: column,
                    };
                }
            }
        }

        return {
            lineNumber: 1,
            column: 1,
        };
    }
}
