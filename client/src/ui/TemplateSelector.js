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

        panel.innerHTML = `
            <div class="template-selector-container">
                <button class="template-close-btn" title="닫기 (ESC)">
                    <i class="codicon codicon-close"></i>
                </button>
                <div class="template-selector-header">
                    <div class="template-filename-section">
                        <label class="template-filename-label">파일 이름</label>
                        <div class="template-input-group">
                            <input type="text"
                                   class="template-filename-input"
                                   placeholder="새파일.py"
                                   value="새파일.py">
                            <button class="template-create-btn" title="파일 생성">
                                <i class="codicon codicon-check"></i>
                                생성
                            </button>
                        </div>
                    </div>
                </div>
                <div class="template-selector-body">
                    <div class="template-list-section">
                        <div class="template-list-header">템플릿</div>
                        <div class="template-list">
                            ${this.renderTemplateList()}
                        </div>
                    </div>
                    <div class="template-preview-section">
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
        // 닫기 버튼 클릭
        const closeBtn = panel.querySelector('.template-close-btn');
        closeBtn.addEventListener('click', () => {
            this.hide(targetEditor);
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
        const previewContainer = document.getElementById(`template-preview-${targetEditor}`);
        if (!previewContainer) return;

        // 기존 에디터가 있으면 재사용, 없으면 새로 생성
        if (!this.previewEditors[targetEditor]) {
            this.previewEditors[targetEditor] = monaco.editor.create(previewContainer, {
                value: template.content || '',
                language: 'python',
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
            // 기존 에디터 내용만 업데이트
            this.previewEditors[targetEditor].setValue(template.content || '');
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

        // .py 확장자 자동 추가
        if (!filename.endsWith('.py')) {
            filename = filename + '.py';
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
            // 선택된 템플릿 내용으로 파일 생성
            const content = this.selectedTemplate ? this.selectedTemplate.content : '';

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
