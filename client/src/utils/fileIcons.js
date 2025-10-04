/**
 * fileIcons.js
 * Utility functions for file icons
 */

/**
 * Get icon HTML for a file based on its extension
 * @param {string} filename - File name with extension
 * @returns {string} HTML string for the icon
 */
export function getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();

    // Use Codicon font icons (VSCode icons)
    const icon = (glyph, iconColor = '#c5c5c5') => {
        return `<i class="codicon codicon-${glyph}" style="color: ${iconColor}; font-size: 16px;"></i>`;
    };

    // Python logo SVG icon
    const pythonIcon = () => {
        return `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align: middle;">
            <defs>
                <linearGradient id="pyBlue" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#387eb8;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#366994;stop-opacity:1" />
                </linearGradient>
                <linearGradient id="pyYellow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#ffe873;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#ffd43b;stop-opacity:1" />
                </linearGradient>
            </defs>
            <path fill="url(#pyBlue)" d="M7.5 1C5.5 1 5 2 5 2.5V4h2.5v.3H3.8C3 4.3 2 5 2 7s.8 2.7 1.8 2.7H5V8.3c0-.8.7-1.5 1.5-1.5h4c.7 0 1.3-.6 1.3-1.3v-3C11.8 1.7 10.5 1 7.5 1zm-1 1.5c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5z"/>
            <path fill="url(#pyYellow)" d="M8.5 15c2 0 2.5-1 2.5-1.5V12H8.5v-.3h3.7c.8 0 1.8-.7 1.8-2.7s-.8-2.7-1.8-2.7H11v1.4c0 .8-.7 1.5-1.5 1.5h-4c-.7 0-1.3.6-1.3 1.3v3c0 .8 1.3 1.5 4.3 1.5zm1-1.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5z"/>
        </svg>`;
    };

    switch (ext) {
        case 'py':
        case 'pyi': // Python stub files
            return pythonIcon();
        case 'js':
            return icon('symbol-method', '#f0db4f');
        case 'jsx':
            return icon('react', '#61dafb');
        case 'ts':
            return icon('symbol-method', '#3178c6');
        case 'tsx':
            return icon('react', '#3178c6');
        case 'json':
            return icon('json', '#f0db4f');
        case 'html':
        case 'htm':
            return icon('code', '#e34c26');
        case 'css':
        case 'scss':
        case 'sass':
            return icon('symbol-color', '#5d8fdb');
        case 'md':
        case 'markdown':
            return icon('markdown', '#c5c5c5');
        case 'txt':
            return icon('file', '#c5c5c5');
        case 'yml':
        case 'yaml':
        case 'config':
        case 'conf':
            return icon('settings-gear', '#e65c5c');
        case 'xml':
            return icon('code', '#c5c5c5');
        case 'csv':
            return icon('table', '#4db380');
        case 'log':
            return icon('output', '#c5c5c5');
        case 'sql':
            return icon('database', '#c5c5c5');
        case 'sh':
        case 'bash':
            return icon('terminal-bash', '#6bc267');
        case 'php':
            return icon('symbol-method', '#9b7cc4');
        case 'java':
            return icon('symbol-method', '#5d9bd6');
        case 'c':
        case 'cpp':
        case 'h':
            return icon('file-code', '#5d9bd6');
        case 'go':
            return icon('symbol-method', '#5dc9e2');
        case 'rs':
            return icon('file-code', '#e6b8a2');
        case 'swift':
            return icon('symbol-method', '#f27b5b');
        case 'kt':
        case 'kts':
            return icon('file-code', '#a87dff');
        case 'rb':
            return icon('ruby', '#e65c5c');
        case 'env':
            return icon('symbol-key', '#ffd966');
        case 'dockerfile':
            return icon('file-code', '#4db3e8');
        case 'gitignore':
            return icon('diff-ignored', '#c5c5c5');
        case 'lock':
            return icon('lock', '#c5c5c5');
        case 'zip':
        case 'tar':
        case 'gz':
            return icon('file-zip', '#c5c5c5');
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
            return icon('file-media', '#c58ae0');
        case 'pdf':
            return icon('file-pdf', '#f46060');
        default:
            return icon('file', '#c5c5c5');
    }
}

/**
 * Get color for file type
 * @param {string} ext - File extension
 * @returns {string} Color hex code
 */
export function getFileIconColor(ext) {
    const colors = {
        py: '#3776ab',
        js: '#f0db4f',
        jsx: '#f0db4f',
        ts: '#3178c6',
        tsx: '#3178c6',
        json: '#f0db4f',
        html: '#e34c26',
        htm: '#e34c26',
        css: '#5d8fdb',
        scss: '#5d8fdb',
        sass: '#5d8fdb',
        md: '#c5c5c5',
        markdown: '#c5c5c5',
        txt: '#c5c5c5',
        yml: '#e65c5c',
        yaml: '#e65c5c',
        xml: '#c5c5c5',
        csv: '#4db380',
        log: '#c5c5c5',
        sql: '#c5c5c5',
        sh: '#6bc267',
        bash: '#6bc267',
        php: '#9b7cc4',
        java: '#5d9bd6',
        c: '#5d9bd6',
        cpp: '#5d9bd6',
        h: '#5d9bd6',
        go: '#5dc9e2',
        rs: '#e6b8a2',
        swift: '#f27b5b',
        kt: '#a87dff',
        kts: '#a87dff',
        rb: '#e65c5c',
    };
    return colors[ext] || '#c5c5c5';
}

/**
 * Get language from file path
 * @param {string} filepath - File path
 * @returns {string} Language identifier for Monaco Editor
 */
export function getLanguageFromFile(filepath) {
    const ext = filepath.split('.').pop()?.toLowerCase();

    const languageMap = {
        py: 'python',
        pyi: 'python', // Python stub files
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        json: 'json',
        html: 'html',
        htm: 'html',
        css: 'css',
        scss: 'scss',
        sass: 'scss',
        less: 'less',
        md: 'markdown',
        markdown: 'markdown',
        xml: 'xml',
        yml: 'yaml',
        yaml: 'yaml',
        sh: 'shell',
        bash: 'shell',
        sql: 'sql',
        php: 'php',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        h: 'c',
        go: 'go',
        rs: 'rust',
        swift: 'swift',
        kt: 'kotlin',
        kts: 'kotlin',
        rb: 'ruby',
        dockerfile: 'dockerfile',
    };

    return languageMap[ext] || 'plaintext';
}
