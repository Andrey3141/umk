let currentPath = '';
let historyStack = [];

async function loadPath(path) {
    try {
        const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error('Ошибка загрузки');
        const data = await res.json();
        renderItems(data.items);
        currentPath = data.path;
        updatePathBar(data.path);
    } catch(err) {
        document.getElementById('itemsGrid').innerHTML = `
            <div class="empty-folder">
                <i class="fas fa-exclamation-triangle"></i> Ошибка: ${escapeHtml(err.message)}
            </div>
        `;
    }
}

function updatePathBar(path) {
    const bar = document.getElementById('pathBar');
    bar.innerHTML = (!path || path === '') ? '/' : '/' + escapeHtml(path);
}

function goBack() {
    if (historyStack.length) loadPath(historyStack.pop());
}

function goHome() {
    historyStack = [];
    loadPath('');
}

// ===== ОТКРЫТИЕ В ПРИЛОЖЕНИИ =====
function openInApp(filePath) {
    fetch('/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) {
            showCustomNotification('❌ ' + (data.error || 'Ошибка'), 'error');
        }
    })
    .catch(() => {
        showCustomNotification('❌ Ошибка соединения', 'error');
    });
}

function renderItems(items) {
    const grid = document.getElementById('itemsGrid');
    if (!items || items.length === 0) {
        grid.innerHTML = `
            <div class="empty-folder">
                <i class="far fa-folder-open"></i> Папка пуста
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    for (const item of items) {
        const div = document.createElement('div');
        div.className = 'item';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'item-icon';

        if (item.type === 'folder') {
            iconDiv.innerHTML = '<i class="fas fa-folder-open" style="color:#f5b042;"></i>';
        } else {
            const ext = item.ext;
            if (ext === '.pdf') iconDiv.innerHTML = '<i class="fas fa-file-pdf" style="color:#e65c2e;"></i>';
            else if (ext === '.docx' || ext === '.doc') iconDiv.innerHTML = '<i class="fas fa-file-word" style="color:#2b579a;"></i>';
            else if (ext === '.xlsx' || ext === '.xls') iconDiv.innerHTML = '<i class="fas fa-file-excel" style="color:#1f724c;"></i>';
            else if (ext === '.pptx' || ext === '.ppt') iconDiv.innerHTML = '<i class="fas fa-file-powerpoint" style="color:#d35230;"></i>';
            else if (['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'].includes(ext)) iconDiv.innerHTML = '<i class="fas fa-video" style="color:#7c3aed;"></i>';
            else if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'].includes(ext)) iconDiv.innerHTML = '<i class="fas fa-image" style="color:#10b981;"></i>';
            else if (['.txt', '.md'].includes(ext)) iconDiv.innerHTML = '<i class="fas fa-file-alt" style="color:#6c8db0;"></i>';
            else iconDiv.innerHTML = '<i class="fas fa-file" style="color:#6c8db0;"></i>';
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'item-name';
        nameDiv.innerText = item.name;

        div.appendChild(iconDiv);
        div.appendChild(nameDiv);

        div.onclick = () => {
            if (item.type === 'folder') {
                historyStack.push(currentPath);
                const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
                loadPath(newPath);
            } else {
                const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;
                
                // ===== ТРИ РЕЖИМА =====
                const action = localStorage.getItem('action') || 'view';
                
                if (action === 'app') {
                    openInApp(fullPath);
                } else if (action === 'download') {
                    window.downloadFile(fullPath);
                } else {
                    openFileViewer(fullPath, item.name);
                }
            }
        };

        grid.appendChild(div);
    }
}
