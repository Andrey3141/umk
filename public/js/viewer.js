let currentFilePath = '';
let currentFileName = '';
let currentFileType = '';

function setViewerEditable(isEditable) {
    const content = document.getElementById('viewerContent');
    const toolbar = document.getElementById('editorToolbar');
    content.contentEditable = isEditable ? 'true' : 'false';
    content.classList.toggle('edit-mode', isEditable);
    toolbar.classList.toggle('show', isEditable);
}

function openFileViewer(filePath, fileName) {
    const action = localStorage.getItem('action') || 'view';
    const mode = localStorage.getItem('mode') || 'read';

    if (action === 'download') {
        window.downloadFile(filePath);
        return;
    }

    currentFilePath = filePath;
    currentFileName = fileName;

    const viewer = document.getElementById('fileViewer');
    const viewerContent = document.getElementById('viewerContent');
    const viewerFileName = document.getElementById('viewerFileName');
    const editorToolbar = document.getElementById('editorToolbar');

    viewerFileName.innerText = fileName;
    viewerContent.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-pulse"></i> Загрузка...</div>';
    viewer.style.display = 'flex';
    editorToolbar.classList.remove('show');

    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop().toLowerCase() : '';
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico', '.tiff', '.tif'];
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];

    // Изображения
    if (imageExts.includes(ext)) {
        const imgUrl = `/api/image?path=${encodeURIComponent(filePath)}`;
        viewerContent.innerHTML = `
            <div style="max-width:1000px;margin:0 auto;padding:20px;text-align:center;">
                <div class="image-container">
                    <img src="${imgUrl}" 
                         alt="${escapeHtml(fileName)}" 
                         style="max-width:100%;max-height:85vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);"
                         onerror="this.parentElement.innerHTML='<div style=\\'padding:40px;color:#94a3b8;\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'font-size:32px;display:block;margin-bottom:12px;\\'></i>Не удалось загрузить изображение</div>'">
                    ${ext === '.gif' ? `<span style="display:inline-block;margin-top:12px;font-size:12px;color:#94a3b8;background:#e2e8f0;padding:4px 12px;border-radius:12px;">GIF анимация</span>` : ''}
                </div>
                <div style="padding:16px 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div>
                        <h3 style="margin:0;font-size:16px;">🖼️ ${escapeHtml(fileName)}</h3>
                    </div>
                    <button onclick="window.downloadFile('${filePath}')" 
                            style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;">
                        <i class="fas fa-download"></i> Скачать
                    </button>
                </div>
            </div>
        `;
        setViewerEditable(false);
        return;
    }

    // Видео
    if (videoExts.includes(ext)) {
        const videoUrl = `/api/video-stream?path=${encodeURIComponent(filePath)}`;
        const mimeTypes = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska'
        };
        const mimeType = mimeTypes[ext] || 'video/mp4';
        
        viewerContent.innerHTML = `
            <div style="max-width:1000px;margin:0 auto;padding:20px;">
                <div style="background:#0f172a;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
                    <video controls style="width:100%;display:block;background:#000;max-height:80vh;" preload="metadata">
                        <source src="${videoUrl}" type="${mimeType}">
                        Ваш браузер не поддерживает видео.
                    </video>
                </div>
                <div style="padding:16px 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div>
                        <h3 style="margin:0;font-size:16px;">🎬 ${escapeHtml(fileName)}</h3>
                    </div>
                    <button onclick="window.downloadFile('${filePath}')" 
                            style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;">
                        <i class="fas fa-download"></i> Скачать
                    </button>
                </div>
            </div>
        `;
        setViewerEditable(false);
        return;
    }

    // Все остальные файлы
    fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`)
        .then(res => {
            if (!res.ok) throw new Error('Ошибка загрузки');
            return res.json();
        })
        .then(data => {
            currentFileType = data.type;

            if (data.type === 'html' || data.type === 'text' || data.type === 'pdf') {
                viewerContent.innerHTML = data.content;
            } else if (data.type === 'warning') {
                viewerContent.innerHTML = `
                    <div style="text-align:center; padding:40px; max-width:600px; margin:0 auto;">
                        <i class="fas fa-exclamation-triangle" style="font-size:3rem; color:#e65c2e;"></i>
                        <h3>${escapeHtml(data.fileName)}</h3>
                        <p style="color:#64748b;">${escapeHtml(data.message)}</p>
                        <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            ${data.downloadUrl ? `
                                <button onclick="window.open('${data.downloadUrl}','_blank')" 
                                        style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:30px;cursor:pointer;">
                                    <i class="fas fa-download"></i> Скачать
                                </button>
                            ` : ''}
                            <button onclick="window.downloadFile('${filePath}')" 
                                    style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:30px;cursor:pointer;">
                                <i class="fas fa-download"></i> Скачать
                            </button>
                        </div>
                    </div>
                `;
            } else {
                viewerContent.innerHTML = `
                    <div style="text-align:center; padding:40px; max-width:400px; margin:0 auto;">
                        <i class="fas fa-file" style="font-size:3rem; color:#94a3b8;"></i>
                        <h3>${escapeHtml(data.fileName || fileName)}</h3>
                        <p style="color:#64748b;">Размер: ${escapeHtml(data.size || '?')}</p>
                        <button onclick="window.downloadFile('${filePath}')" 
                                style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:30px;cursor:pointer;margin-top:15px;">
                            <i class="fas fa-download"></i> Скачать
                        </button>
                    </div>
                `;
            }

            // ===== КНОПКА "ОТКРЫТЬ В ПРИЛОЖЕНИИ" =====
            const toolbar = document.getElementById('editorToolbar');
            const oldBtn = document.getElementById('openAppBtn');
            if (oldBtn) oldBtn.remove();
            
            const openAppBtn = document.createElement('button');
            openAppBtn.id = 'openAppBtn';
            openAppBtn.className = 'editor-btn';
            openAppBtn.innerHTML = '📂 Открыть в приложении';
            openAppBtn.style.cssText = 'background:#2b579a;color:white;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:13px;';
            openAppBtn.onclick = () => {
                document.getElementById('fileViewer').style.display = 'none';
                openInApp(currentFilePath);
            };
            toolbar.appendChild(openAppBtn);

            const isEditable = mode === 'edit' && (data.type === 'text' || data.type === 'html');
            setViewerEditable(isEditable);
        })
        .catch(err => {
            console.error('Ошибка:', err);
            viewerContent.innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:2rem; color:#e65c2e;"></i>
                    <p style="color:#64748b;">Ошибка загрузки файла: ${escapeHtml(err.message)}</p>
                    <button onclick="window.downloadFile('${filePath}')" 
                            style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:30px;cursor:pointer;margin-top:15px;">
                        <i class="fas fa-download"></i> Скачать
                    </button>
                </div>
            `;
            setViewerEditable(false);
        });
}

document.getElementById('viewerClose').onclick = () => {
    document.getElementById('fileViewer').style.display = 'none';
    setViewerEditable(false);
};

document.getElementById('cancelEditBtn').onclick = () => {
    setViewerEditable(false);
    showCustomNotification('Редактирование отключено', 'success');
    openFileViewer(currentFilePath, currentFileName);
};

document.getElementById('saveEditBtn').onclick = () => {
    const content = document.getElementById('viewerContent');
    let newContent = content.innerHTML;

    const preMatch = newContent.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
    if (preMatch) {
        newContent = preMatch[1];
    }

    newContent = newContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    fetch('/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            path: currentFilePath,
            content: newContent
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showCustomNotification('✅ Файл сохранён!', 'success');
            setViewerEditable(false);
        } else {
            showCustomNotification('❌ Ошибка: ' + data.error, 'error');
        }
    })
    .catch(() => {
        showCustomNotification('❌ Ошибка соединения с сервером', 'error');
    });
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const viewer = document.getElementById('fileViewer');
        if (viewer.style.display === 'flex') {
            document.getElementById('viewerClose').click();
        }
    }
});
