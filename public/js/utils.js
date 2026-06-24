function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showCustomNotification(message, type) {
    const n = document.createElement('div');
    n.style.cssText = `
        position:fixed;
        bottom:20px;
        right:20px;
        background:${type === 'success' ? '#2c5a8c' : '#e65c2e'};
        color:white;
        padding:12px 20px;
        border-radius:12px;
        z-index:9999;
        max-width:320px;
        font-family:'Inter',sans-serif;
        font-size:14px;
        box-shadow:0 4px 12px rgba(0,0,0,0.2);
        animation:slideIn 0.3s ease;
    `;
    n.innerHTML = message;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.opacity = '0';
        n.style.transition = 'opacity 0.3s ease';
        setTimeout(() => n.remove(), 300);
    }, 2500);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

function applyTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-system');

    if (theme === 'system') {
        document.body.classList.add('theme-system');
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.add(dark ? 'theme-dark' : 'theme-light');
    } else {
        document.body.classList.add(`theme-${theme}`);
    }
}

function syncSystemTheme() {
    if ((localStorage.getItem('theme') || 'light') === 'system') {
        applyTheme('system');
    }
}

window.downloadFile = function(filePath) {
    window.open(`/api/download?path=${encodeURIComponent(filePath)}`, '_blank');
};
