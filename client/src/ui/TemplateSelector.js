import * as monaco from 'monaco-editor';

/**
 * TemplateSelector - 새 파일 생성 시 템플릿 선택 UI
 */
export class TemplateSelector {
    constructor(ide) {
        this.ide = ide;
        this.templates = [];
        this.selectedTemplate = null;
        this.previewEditors = {}; // targetEditor별 미리보기 에디터 저장
        this.selectedFileType = 'python'; // 기본값: Python

        // 지원하는 파일 타입 정의
        this.fileTypes = [
            {
                id: 'python',
                label: 'Python',
                extension: '.py',
                language: 'python',
                hasTemplates: true,
            },
            {
                id: 'text',
                label: 'Text',
                extension: '.txt',
                language: 'plaintext',
                hasTemplates: false,
            },
            {
                id: 'json',
                label: 'JSON',
                extension: '.json',
                language: 'json',
                hasTemplates: false,
            },
            {
                id: 'csv',
                label: 'CSV',
                extension: '.csv',
                language: 'plaintext',
                hasTemplates: false,
            },
            {
                id: 'html',
                label: 'HTML',
                extension: '.html',
                language: 'html',
                hasTemplates: false,
            },
            { id: 'css', label: 'CSS', extension: '.css', language: 'css', hasTemplates: false },
            {
                id: 'javascript',
                label: 'JavaScript',
                extension: '.js',
                language: 'javascript',
                hasTemplates: false,
            },
            {
                id: 'markdown',
                label: 'Markdown',
                extension: '.md',
                language: 'markdown',
                hasTemplates: false,
            },
            { id: 'xml', label: 'XML', extension: '.xml', language: 'xml', hasTemplates: false },
            {
                id: 'yaml',
                label: 'YAML',
                extension: '.yaml',
                language: 'yaml',
                hasTemplates: false,
            },
        ];
    }

    /**
     * 템플릿 목록 로드
     */
    async loadTemplates() {
        try {
            const response = await fetch(this.ide.buildUrl('/api/templates'));
            const data = await response.json();
            this.templates = data.templates || [];
            return this.templates;
        } catch (error) {
            console.error('Failed to load templates:', error);
            this.templates = [{ name: '빈파일', content: '' }];
            return this.templates;
        }
    }

    /**
     * 템플릿 선택 패널 표시
     * @param {string} targetEditor - 'left' or 'right'
     */
    async show(targetEditor = 'left') {
        // 파일 타입을 Python으로 초기화
        this.selectedFileType = 'python';

        // 템플릿 로드
        await this.loadTemplates();

        // 대상 에디터 컨테이너 찾기
        const editorContainer = this.getEditorContainer(targetEditor);
        if (!editorContainer) {
            console.error('Editor container not found');
            return;
        }

        // 기존 템플릿 선택기 제거
        this.hide(targetEditor);

        // 뒤에 있는 Monaco Editor를 완전히 비활성화
        const monacoEditor = targetEditor === 'right' ? this.ide.rightEditor : this.ide.editor;
        if (monacoEditor) {
            const domNode = monacoEditor.getDomNode();
            if (domNode) {
                domNode.style.pointerEvents = 'none';
                domNode.style.userSelect = 'none';
            }
        }

        // 템플릿 선택 패널 생성
        const panel = this.createPanel(targetEditor);
        editorContainer.appendChild(panel);

        // 첫 번째 템플릿 자동 선택
        if (this.templates.length > 0) {
            this.selectTemplate(this.templates[0], targetEditor);
        }

        // 파일명 입력 필드에 포커스
        const nameInput = panel.querySelector('.template-filename-input');
        if (nameInput) {
            nameInput.focus();
        }
    }

    /**
     * 템플릿 선택 패널 숨기기
     */
    hide(targetEditor = 'left') {
        const editorContainer = this.getEditorContainer(targetEditor);
        if (!editorContainer) return;

        // Monaco Editor 정리
        if (this.previewEditors[targetEditor]) {
            this.previewEditors[targetEditor].dispose();
            delete this.previewEditors[targetEditor];
        }

        // 뒤에 있는 Monaco Editor 다시 활성화
        const monacoEditor = targetEditor === 'right' ? this.ide.rightEditor : this.ide.editor;
        if (monacoEditor) {
            const domNode = monacoEditor.getDomNode();
            if (domNode) {
                domNode.style.pointerEvents = '';
                domNode.style.userSelect = '';
            }
        }

        const existingPanel = editorContainer.querySelector('.template-selector-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
    }

    /**
     * 에디터 컨테이너 찾기
     */
    getEditorContainer(targetEditor) {
        if (targetEditor === 'right') {
            // Try multiple selectors for right editor
            const rightContainer =
                document.querySelector('#rightEditorGroup .editor-container') ||
                document.querySelector('.editor-group#rightEditorGroup .editor-container') ||
                document.querySelector('.editor-group:last-child .editor-container');

            return rightContainer;
        }
        // Left editor
        const leftContainer =
            document.querySelector('#leftEditorGroup .editor-container') ||
            document.querySelector('.editor-group .editor-container');

        return leftContainer;
    }

    /**
     * 템플릿 선택 패널 생성
     */
    createPanel(targetEditor) {
        const panel = document.createElement('div');
        panel.className = 'template-selector-panel';

        const currentFileType = this.fileTypes.find((ft) => ft.id === this.selectedFileType);
        const defaultFilename = `새파일${currentFileType.extension}`;

        panel.innerHTML = `
            <div class="template-selector-container">
                <button class="template-close-btn" title="닫기 (ESC)">
                    <i class="codicon codicon-close"></i>
                </button>
                <div class="template-selector-header">
                    <div class="template-filetype-section">
                        <label class="template-label">파일 유형</label>
                        <select class="template-filetype-select">
                            ${this.fileTypes
                                .map(
                                    (ft) =>
                                        `<option value="${ft.id}" ${ft.id === this.selectedFileType ? 'selected' : ''}>${ft.label} (${ft.extension})</option>`
                                )
                                .join('')}
                        </select>
                    </div>
                    <div class="template-filename-section">
                        <label class="template-label">파일 이름</label>
                        <div class="template-input-group">
                            <input type="text"
                                   class="template-filename-input"
                                   placeholder="${defaultFilename}"
                                   value="${defaultFilename}">
                            <button class="template-create-btn" title="파일 생성">
                                <i class="codicon codicon-check"></i>
                                생성
                            </button>
                        </div>
                    </div>
                </div>
                <div class="template-selector-body">
                    <div class="template-list-section ${currentFileType.hasTemplates ? '' : 'hidden'}">
                        <div class="template-list-header">템플릿</div>
                        <div class="template-list">
                            ${this.renderTemplateList()}
                        </div>
                    </div>
                    <div class="template-preview-section ${currentFileType.hasTemplates ? '' : 'full-width'}">
                        <div class="template-preview-header">미리보기</div>
                        <div class="template-preview" id="template-preview-${targetEditor}"></div>
                    </div>
                </div>
            </div>
        `;

        // 이벤트 리스너 설정
        this.setupEventListeners(panel, targetEditor);

        return panel;
    }

    /**
     * 템플릿 목록 렌더링
     */
    renderTemplateList() {
        return this.templates
            .map(
                (template, index) => `
            <div class="template-item ${index === 0 ? 'selected' : ''}"
                 data-template-name="${template.name}">
                <i class="codicon codicon-file-code template-item-icon"></i>
                <span class="template-item-name">${template.name}</span>
            </div>
        `
            )
            .join('');
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners(panel, targetEditor) {
        // 패널 내부 클릭 시 이벤트 전파 차단 (Monaco가 포커스 가져가는 것 방지)
        const container = panel.querySelector('.template-selector-container');
        container.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        // 닫기 버튼 클릭
        const closeBtn = panel.querySelector('.template-close-btn');
        closeBtn.addEventListener('click', () => {
            this.hide(targetEditor);
        });

        // 파일 타입 선택 변경
        const fileTypeSelect = panel.querySelector('.template-filetype-select');
        fileTypeSelect.addEventListener('change', (e) => {
            this.handleFileTypeChange(e.target.value, targetEditor);
        });

        // 템플릿 항목 클릭
        panel.querySelectorAll('.template-item').forEach((item) => {
            item.addEventListener('click', () => {
                const templateName = item.dataset.templateName;
                const template = this.templates.find((t) => t.name === templateName);
                if (template) {
                    this.selectTemplate(template, targetEditor);
                }
            });
        });

        // 생성 버튼 클릭
        const createBtn = panel.querySelector('.template-create-btn');
        createBtn.addEventListener('click', () => {
            this.createFile(targetEditor);
        });

        // Enter 키로 파일 생성
        const nameInput = panel.querySelector('.template-filename-input');
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createFile(targetEditor);
            }
        });

        // 입력창 포커스 유지
        nameInput.addEventListener('blur', () => {
            // container 내부 요소로 포커스가 이동하는 경우가 아니면 다시 포커스
            setTimeout(() => {
                if (!container.contains(document.activeElement)) {
                    nameInput.focus();
                }
            }, 0);
        });

        // ESC 키로 취소 (전역)
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.hide(targetEditor);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // 패널 외부 클릭 시 닫기
        panel.addEventListener('click', (e) => {
            if (e.target === panel) {
                this.hide(targetEditor);
            }
        });
    }

    /**
     * 파일 타입 변경 핸들러
     */
    handleFileTypeChange(fileTypeId, targetEditor) {
        this.selectedFileType = fileTypeId;
        const editorContainer = this.getEditorContainer(targetEditor);
        if (!editorContainer) return;

        const panel = editorContainer.querySelector('.template-selector-panel');
        if (!panel) return;

        const currentFileType = this.fileTypes.find((ft) => ft.id === fileTypeId);
        const nameInput = panel.querySelector('.template-filename-input');

        // 파일명 확장자 업데이트
        let currentFilename = nameInput.value.trim();
        // 기존 확장자 제거
        const lastDotIndex = currentFilename.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            currentFilename = currentFilename.substring(0, lastDotIndex);
        }
        // 새 확장자 추가
        nameInput.value = currentFilename + currentFileType.extension;
        nameInput.placeholder = `새파일${currentFileType.extension}`;

        // 템플릿 섹션 표시/숨김
        const templateSection = panel.querySelector('.template-list-section');
        const previewSection = panel.querySelector('.template-preview-section');

        if (currentFileType.hasTemplates) {
            templateSection.classList.remove('hidden');
            previewSection.classList.remove('full-width');
            // 첫 번째 템플릿 선택
            if (this.templates.length > 0) {
                this.selectTemplate(this.templates[0], targetEditor);
            }
        } else {
            templateSection.classList.add('hidden');
            previewSection.classList.add('full-width');
            // 빈 파일 미리보기
            this.updatePreviewForFileType(currentFileType, '', targetEditor);
        }
    }

    /**
     * 템플릿 선택
     */
    selectTemplate(template, targetEditor) {
        this.selectedTemplate = template;

        const editorContainer = this.getEditorContainer(targetEditor);
        if (!editorContainer) return;

        const panel = editorContainer.querySelector('.template-selector-panel');
        if (!panel) return;

        // 선택 상태 업데이트
        panel.querySelectorAll('.template-item').forEach((item) => {
            if (item.dataset.templateName === template.name) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Monaco Editor를 사용한 미리보기 업데이트
        this.updatePreview(template, targetEditor);
    }

    /**
     * Monaco Editor를 사용한 미리보기 업데이트
     */
    updatePreview(template, targetEditor) {
        const currentFileType = this.fileTypes.find((ft) => ft.id === this.selectedFileType);
        this.updatePreviewForFileType(currentFileType, template.content || '', targetEditor);
    }

    /**
     * 파일 타입에 맞는 미리보기 업데이트
     */
    updatePreviewForFileType(fileType, content, targetEditor) {
        const previewContainer = document.getElementById(`template-preview-${targetEditor}`);
        if (!previewContainer) return;

        // 기존 에디터가 있으면 재사용, 없으면 새로 생성
        if (!this.previewEditors[targetEditor]) {
            this.previewEditors[targetEditor] = monaco.editor.create(previewContainer, {
                value: content,
                language: fileType.language,
                theme: document.body.classList.contains('light-theme') ? 'vs' : 'vs-dark',
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                fontSize: 13,
                automaticLayout: true,
                scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    useShadows: false,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                },
                domReadOnly: true,
                cursorStyle: 'line-thin',
                renderValidationDecorations: 'off',
                quickSuggestions: false,
                parameterHints: { enabled: false },
                suggestOnTriggerCharacters: false,
                acceptSuggestionOnEnter: 'off',
                tabCompletion: 'off',
                wordBasedSuggestions: false,
                selectionHighlight: false,
                occurrencesHighlight: false,
                codeLens: false,
                folding: false,
                foldingHighlight: false,
                links: false,
                colorDecorators: false,
            });

            // 커서 완전히 숨기기
            previewContainer.style.cursor = 'default';
            previewContainer.addEventListener('mousedown', (e) => e.preventDefault());
        } else {
            // 기존 에디터 내용 및 언어 업데이트
            const model = this.previewEditors[targetEditor].getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, fileType.language);
            }
            this.previewEditors[targetEditor].setValue(content);
        }
    }

    /**
     * 파일 생성
     */
    async createFile(targetEditor) {
        const editorContainer = this.getEditorContainer(targetEditor);
        if (!editorContainer) return;

        const panel = editorContainer.querySelector('.template-selector-panel');
        if (!panel) return;

        const nameInput = panel.querySelector('.template-filename-input');
        let filename = nameInput.value.trim();

        if (!filename) {
            alert('파일 이름을 입력하세요.');
            nameInput.focus();
            return;
        }

        const currentFileType = this.fileTypes.find((ft) => ft.id === this.selectedFileType);

        // 확장자 자동 추가 (없는 경우에만)
        if (!filename.includes('.')) {
            filename = filename + currentFileType.extension;
        }

        // 현재 선택된 디렉토리 경로 포함
        const fullPath = this.ide.selectedDirectory
            ? `${this.ide.selectedDirectory}/${filename}`
            : filename;

        // 파일 존재 여부 확인
        const exists = await this.ide.checkIfFileExists(fullPath);
        if (exists) {
            if (!confirm(`파일 "${fullPath}"이(가) 이미 존재합니다. 덮어쓰시겠습니까?`)) {
                return;
            }
        }

        try {
            // 선택된 템플릿 내용으로 파일 생성 (Python만 템플릿 사용, 나머지는 빈 파일)
            let content = '';
            if (currentFileType.hasTemplates && this.selectedTemplate) {
                content = this.selectedTemplate.content;
            }

            const response = await fetch(this.ide.buildUrl(`/api/files/${fullPath}`), {
                method: 'POST',
                headers: this.ide.getFetchHeaders(),
                body: JSON.stringify({ content }),
            });

            if (!response.ok) {
                throw new Error('Failed to create file');
            }

            // 파일 탐색기 새로고침
            await this.ide.loadFileExplorer();

            // 템플릿 선택 패널 숨기기
            this.hide(targetEditor);

            // 생성된 파일 열기
            if (targetEditor === 'right' && this.ide.splitViewActive) {
                await this.ide.openFileInSplit(fullPath);
            } else {
                await this.ide.openFile(fullPath);
            }
        } catch (error) {
            console.error('Failed to create file:', error);
            alert('파일 생성에 실패했습니다.');
        }
    }
}
