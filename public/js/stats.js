async function loadStats() {
    try {
        const res = await fetch('/api/info');
        const data = await res.json();
        document.getElementById('totalFolders').innerText = data.totalFolders || 0;
        document.getElementById('totalFiles').innerText = data.totalFiles || 0;
        document.getElementById('totalSize').innerText = data.totalSize || '0';
        document.getElementById('folderCount').innerText = data.totalFolders || 0;
        document.getElementById('fileCount').innerText = data.totalFiles || 0;
        document.getElementById('sizeCount').innerText = data.totalSize || '0';
    } catch(e) {
        console.error('Ошибка загрузки статистики:', e);
    }
}
