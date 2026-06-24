function openSettingsModal() {
    let modal = document.getElementById('settingsModal');
    if (modal) { modal.style.display = 'flex'; return; }

    modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.style.cssText = `
        position:fixed;
        top:0;
        left:0;
        width:100%;
        height:100%;
        background:rgba(0,0,0,0.5);
        z-index:3000;
        display:flex;
        justify-content:center;
        align-items:center;
        animation:fadeIn 0.2s ease;
    `;

    // Получаем текущий путь с сервера
    let currentPath = '';
    fetch('/api/config')
        .then(res => res.json())
        .then(data => {
            currentPath = data.baseDir || '';
            const input = document.getElementById('umkPathInput');
            if (input) input.value = currentPath;
            updatePathStatus(currentPath);
        })
        .catch(() => {});

    modal.innerHTML = `
        <div style="background:var(--app-bg);color:var(--text);border-radius:24px;width:520px;max-width:95%;overflow:hidden;border:1px solid var(--border);max-height:90vh;overflow-y:auto;">
            <div style="background:#0a2b44;padding:16px;color:white;display:flex;justify-content:space-between;align-items:center;">
                <h3><i class="fas fa-cog"></i> Настройки</h3>
                <button id="closeSetBtn" style="background:none;border:none;color:white;font-size:24px;cursor:pointer">&times;</button>
            </div>
            <div style="padding:20px">
                <!-- Путь к УМК -->
                <div style="margin-bottom:15px">
                    <label style="display:block;font-weight:500;margin-bottom:4px;">
                        📂 Путь к папке УМК:
                    </label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="umkPathInput" 
                               style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:13px;font-family:monospace;"
                               placeholder="Например: /home/user/умк"
                               value="${currentPath}">
                        <button id="browsePathBtn" 
                                style="background:#2c5a8c;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;white-space:nowrap;">
                            <i class="fas fa-folder-open"></i> Выбрать
                        </button>
                    </div>
                    <div style="font-size:12px;margin-top:6px;display:flex;gap:12px;flex-wrap:wrap;">
                        <span id="pathStatus">${currentPath ? '🔍 Проверка...' : '⚠️ Введите путь к папке УМК'}</span>
                        <span id="pathHint" style="color:#94a3b8;font-size:11px;">
                            <i class="fas fa-info-circle"></i> Можно перетащить папку в это поле
                        </span>
                    </div>
                </div>

                <div style="border-top:1px solid var(--border);margin:16px 0;"></div>

                <!-- Тема -->
                <div style="margin-bottom:15px">
                    <label style="display:block;font-weight:500;margin-bottom:4px;">🎨 Тема:</label>
                    <select id="themeSelect" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);">
                        <option value="light">☀️ Светлая</option>
                        <option value="dark">🌙 Тёмная</option>
                        <option value="system">🖥️ Системная</option>
                    </select>
                </div>

                <!-- ===== ДЕЙСТВИЕ ПРИ КЛИКЕ (3 режима) ===== -->
                <div style="margin-bottom:15px">
                    <label style="display:block;font-weight:500;margin-bottom:4px;">👆 Действие при клике:</label>
                    <select id="actionSelect" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);">
                        <option value="view">👁️ Просмотр на сайте</option>
                        <option value="download">⬇️ Скачивание</option>
                        <option value="app">💻 Открыть в приложении</option>
                    </select>
                    <p style="font-size:11px;color:#94a3b8;margin-top:4px;">
                        Для DOCX, PDF, XLSX — открывать в Word/Excel/PDF-ридере
                    </p>
                </div>
                <!-- ===== КОНЕЦ ===== -->

                <!-- Режим -->
                <div style="margin-bottom:15px">
                    <label style="display:block;font-weight:500;margin-bottom:4px;">✏️ Режим:</label>
                    <select id="modeSelect" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);">
                        <option value="read">📖 Чтение</option>
                        <option value="edit">✏️ Редактирование</option>
                    </select>
                </div>

                <div style="border-top:1px solid var(--border);margin:16px 0;"></div>

                <!-- Ссылки -->
                <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:4px 0;">
                    <a href="https://github.com/Andrey3141/umk" 
                       target="_blank" 
                       style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:#24292e;color:white;border-radius:20px;text-decoration:none;font-size:13px;font-weight:500;transition:all 0.2s;"
                       onmouseover="this.style.opacity='0.8'"
                       onmouseout="this.style.opacity='1'">
                        <i class="fab fa-github"></i> GitHub
                    </a>
                    <a href="https://www.mgtk.mogilev.by/" 
                       target="_blank" 
                       style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:#0a2b44;color:white;border-radius:20px;text-decoration:none;font-size:13px;font-weight:500;transition:all 0.2s;"
                       onmouseover="this.style.opacity='0.8'"
                       onmouseout="this.style.opacity='1'">
                        <i class="fas fa-globe"></i> МГТК
                    </a>
                </div>
                <div style="text-align:center;font-size:11px;margin-top:8px;" class="version-text">
                    УМК МГТК v2.2.0
                </div>
            </div>
            <div style="padding:16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
                <button id="saveSetBtn" style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;">
                    <i class="fas fa-save"></i> Сохранить
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const style = document.createElement('style');
    style.textContent = `@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }`;
    document.head.appendChild(style);

    // Загружаем сохранённые значения
    document.getElementById('themeSelect').value = localStorage.getItem('theme') || 'light';
    document.getElementById('actionSelect').value = localStorage.getItem('action') || 'view';
    document.getElementById('modeSelect').value = localStorage.getItem('mode') || 'read';

    const pathInput = document.getElementById('umkPathInput');
    const pathStatus = document.getElementById('pathStatus');

    function updatePathStatus(path) {
        if (!path || path.trim() === '') {
            pathStatus.textContent = '⚠️ Введите путь к папке УМК';
            pathStatus.style.color = '#e65c2e';
            return;
        }
        fetch('/api/config')
            .then(res => res.json())
            .then(data => {
                fetch(`/api/browse?path=`)
                    .then(res => {
                        if (res.ok) {
                            pathStatus.textContent = '✅ Папка доступна';
                            pathStatus.style.color = '#2c5a8c';
                        } else {
                            pathStatus.textContent = '⚠️ Папка не найдена';
                            pathStatus.style.color = '#e65c2e';
                        }
                    })
                    .catch(() => {
                        pathStatus.textContent = '⚠️ Папка не найдена';
                        pathStatus.style.color = '#e65c2e';
                    });
            })
            .catch(() => {
                pathStatus.textContent = '⚠️ Ошибка проверки';
                pathStatus.style.color = '#e65c2e';
            });
    }

    let folderInput = document.getElementById('folderInputHidden');
    if (!folderInput) {
        folderInput = document.createElement('input');
        folderInput.id = 'folderInputHidden';
        folderInput.type = 'file';
        folderInput.webkitdirectory = true;
        folderInput.directory = true;
        folderInput.style.display = 'none';
        document.body.appendChild(folderInput);

        folderInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                const firstFile = files[0];
                const relativePath = firstFile.webkitRelativePath || '';
                const folderName = relativePath.split('/')[0] || '';
                
                if (folderName) {
                    showCustomNotification(`📁 Выбрана папка "${folderName}". Укажите полный путь вручную.`, 'success');
                    const userPath = prompt(`Введите полный путь к папке "${folderName}":`, pathInput.value || '');
                    if (userPath !== null) {
                        pathInput.value = userPath;
                        updatePathStatus(userPath);
                    }
                } else {
                    showCustomNotification('⚠️ Не удалось определить выбранную папку. Введите путь вручную.', 'error');
                }
            }
            folderInput.value = '';
        });
    }

    const dropZone = document.createElement('div');
    dropZone.style.cssText = `
        border: 2px dashed var(--border);
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        margin-top: 8px;
        color: #94a3b8;
        font-size: 13px;
        transition: all 0.2s;
        cursor: default;
        background: var(--card);
    `;
    dropZone.innerHTML = `
        <i class="fas fa-folder-open" style="font-size:24px;display:block;margin-bottom:8px;color:#94a3b8;"></i>
        Перетащите папку сюда или нажмите "Выбрать"
    `;
    dropZone.id = 'dropZone';
    
    const pathContainer = pathInput.parentElement.parentElement;
    pathContainer.appendChild(dropZone);

    let dragCounter = 0;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#2c5a8c';
        dropZone.style.background = 'rgba(44, 90, 140, 0.08)';
        dropZone.innerHTML = `
            <i class="fas fa-folder-open" style="font-size:24px;display:block;margin-bottom:8px;color:#2c5a8c;"></i>
            Отпустите для выбора папки
        `;
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            dropZone.style.borderColor = 'var(--border)';
            dropZone.style.background = 'var(--card)';
            dropZone.innerHTML = `
                <i class="fas fa-folder-open" style="font-size:24px;display:block;margin-bottom:8px;color:#94a3b8;"></i>
                Перетащите папку сюда или нажмите "Выбрать"
            `;
        }
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.background = 'var(--card)';
        dropZone.innerHTML = `
            <i class="fas fa-folder-open" style="font-size:24px;display:block;margin-bottom:8px;color:#94a3b8;"></i>
            Перетащите папку сюда или нажмите "Выбрать"
        `;

        const items = e.dataTransfer.items;
        if (items) {
            for (const item of items) {
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                    if (entry && entry.isDirectory) {
                        const folderName = entry.name || '';
                        if (folderName) {
                            const userPath = prompt(`Введите полный путь к папке "${folderName}":`, pathInput.value || '');
                            if (userPath !== null) {
                                pathInput.value = userPath;
                                updatePathStatus(userPath);
                            }
                        }
                        break;
                    }
                }
            }
        }
        showCustomNotification('📁 Папка выбрана! Укажите полный путь в поле выше.', 'success');
    });

    pathInput.addEventListener('input', () => {
        const val = pathInput.value.trim();
        if (val) {
            updatePathStatus(val);
        } else {
            pathStatus.textContent = '⚠️ Введите путь к папке УМК';
            pathStatus.style.color = '#e65c2e';
        }
    });

    if (currentPath) {
        updatePathStatus(currentPath);
    }

    document.getElementById('browsePathBtn').onclick = (e) => {
        e.preventDefault();
        folderInput.click();
    };

    document.getElementById('closeSetBtn').onclick = () => {
        modal.style.display = 'none';
        if (dropZone && dropZone.parentNode) {
            dropZone.parentNode.removeChild(dropZone);
        }
    };

    document.getElementById('saveSetBtn').onclick = () => {
        const theme = document.getElementById('themeSelect').value;
        const action = document.getElementById('actionSelect').value;
        const mode = document.getElementById('modeSelect').value;
        const newPath = document.getElementById('umkPathInput').value.trim();

        localStorage.setItem('theme', theme);
        localStorage.setItem('action', action);
        localStorage.setItem('mode', mode);

        applyTheme(theme);

        const viewer = document.getElementById('fileViewer');
        if (viewer.style.display === 'flex') {
            const content = document.getElementById('viewerContent');
            const isEditable = mode === 'edit' && (currentFileType === 'text' || currentFileType === 'html');
            content.contentEditable = isEditable ? 'true' : 'false';
            content.classList.toggle('edit-mode', isEditable);
            document.getElementById('editorToolbar').classList.toggle('show', isEditable);
        }

        if (newPath) {
            const saveBtn = document.getElementById('saveSetBtn');
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Сохранение...';
            saveBtn.disabled = true;

            fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseDir: newPath })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showCustomNotification('✅ Путь УМК обновлён!', 'success');
                    loadStats();
                    loadPath('');
                    pathStatus.textContent = '✅ Папка доступна';
                    pathStatus.style.color = '#2c5a8c';
                    modal.style.display = 'none';
                } else {
                    showCustomNotification('❌ ' + data.error, 'error');
                    pathStatus.textContent = '⚠️ ' + data.error;
                    pathStatus.style.color = '#e65c2e';
                }
            })
            .catch(() => {
                showCustomNotification('❌ Ошибка соединения с сервером', 'error');
                pathStatus.textContent = '⚠️ Ошибка соединения';
                pathStatus.style.color = '#e65c2e';
            })
            .finally(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            });
        } else {
            showCustomNotification('✅ Настройки сохранены', 'success');
            modal.style.display = 'none';
        }
    };

    modal.style.display = 'flex';
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('settingsModal');
    if (modal && modal.style.display === 'flex' && e.target === modal) {
        modal.style.display = 'none';
        const dropZone = document.getElementById('dropZone');
        if (dropZone && dropZone.parentNode) {
            dropZone.parentNode.removeChild(dropZone);
        }
    }
});
