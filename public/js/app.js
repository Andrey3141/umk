// ============================================================
// 1. ТЕМА
// ============================================================
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

const mql = window.matchMedia('(prefers-color-scheme: dark)');
if (mql.addEventListener) {
    mql.addEventListener('change', syncSystemTheme);
} else if (mql.addListener) {
    mql.addListener(syncSystemTheme);
}

// ============================================================
// 2. ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ ОТКРЫТИЯ В ПРИЛОЖЕНИИ
// ============================================================
window.openInApp = function(filePath) {
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
};

// ============================================================
// 3. ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ СКАЧИВАНИЯ
// ============================================================
window.downloadFile = function(filePath) {
    window.open(`/api/download?path=${encodeURIComponent(filePath)}`, '_blank');
};

// ============================================================
// 4. ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ УВЕДОМЛЕНИЙ
// ============================================================
function showCustomNotification(message, type = 'success') {
    const colors = {
        success: '#2c5a8c',
        error: '#e65c2e',
        warning: '#e6a800',
        info: '#2b579a'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.success};
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        max-width: 400px;
        animation: slideIn 0.3s ease;
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    // Иконка
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    notification.innerHTML = `<span>${icons[type] || '📢'}</span> ${message}`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3500);
}

// Добавляем стиль для уведомлений
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(notificationStyle);

// ============================================================
// 5. ПРИМЕНЕНИЕ ТЕМЫ
// ============================================================
function applyTheme(theme) {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.style.setProperty('--app-bg', isDark ? '#0f172a' : '#f8fafc');
    document.documentElement.style.setProperty('--text', isDark ? '#f1f5f9' : '#0f172a');
    document.documentElement.style.setProperty('--card', isDark ? '#1e293b' : '#ffffff');
    document.documentElement.style.setProperty('--border', isDark ? '#334155' : '#e2e8f0');
    document.documentElement.style.setProperty('--sidebar-bg', isDark ? '#1e293b' : '#f1f5f9');
    document.documentElement.style.setProperty('--hover', isDark ? '#334155' : '#e2e8f0');

    if (isDark) {
        document.body.style.background = '#0f172a';
        document.body.style.color = '#f1f5f9';
    } else {
        document.body.style.background = '#f8fafc';
        document.body.style.color = '#0f172a';
    }

    // Текст в шапке (белый всегда)
    document.querySelectorAll('.white-text').forEach(el => {
        el.style.color = 'white';
    });

    // Адаптивный текст в боковой панели
    document.querySelectorAll('.adaptive-text').forEach(el => {
        el.style.color = isDark ? '#cbd5e1' : '#1e293b';
    });

    const header = document.querySelector('.header');
    if (header) {
        header.style.background = isDark ? '#0a2b44' : '#0a2b44';
    }

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.style.background = isDark ? '#1e293b' : '#f1f5f9';
        sidebar.style.color = isDark ? '#f1f5f9' : '#0f172a';
    }

    const infoCards = document.querySelectorAll('.info-card');
    infoCards.forEach(card => {
        card.style.background = isDark ? '#2d3748' : '#ffffff';
        card.style.color = isDark ? '#e2e8f0' : '#2d3748';
        card.style.border = isDark ? '1px solid #4a5568' : '1px solid #e2e8f0';
    });
}

function syncSystemTheme(e) {
    if (localStorage.getItem('theme') === 'system') {
        applyTheme('system');
    }
}

// ============================================================
// 6. СТАТИСТИКА
// ============================================================
async function loadStats() {
    try {
        const res = await fetch('/api/info');
        const data = await res.json();

        document.getElementById('totalFolders').textContent = data.totalFolders || 0;
        document.getElementById('totalFiles').textContent = data.totalFiles || 0;
        document.getElementById('totalSize').textContent = data.totalSize || '0';

        document.getElementById('folderCount').textContent = data.totalFolders || 0;
        document.getElementById('fileCount').textContent = data.totalFiles || 0;
        document.getElementById('sizeCount').textContent = data.totalSize || '0';
    } catch (e) {
        document.getElementById('totalFolders').textContent = '-';
        document.getElementById('totalFiles').textContent = '-';
        document.getElementById('totalSize').textContent = '-';
        document.getElementById('folderCount').textContent = '-';
        document.getElementById('fileCount').textContent = '-';
        document.getElementById('sizeCount').textContent = '-';
    }
}

// ============================================================
// 7. ПЕРЕКЛЮЧАТЕЛЬ НАСТРОЕК (шестерёнка)
// ============================================================
document.getElementById('settingsBtn').onclick = () => {
    const btn = document.getElementById('settingsBtn');
    btn.classList.add('rotating');
    setTimeout(() => btn.classList.remove('rotating'), 400);
    openSettingsModal();
};

// ============================================================
// 8. НАВИГАЦИЯ (НАЗАД / КОРЕНЬ)
// ============================================================
document.getElementById('backBtn').onclick = goBack;
document.getElementById('homeBtn').onclick = goHome;

// ============================================================
// 9. ПРОВЕРКА ПАПКИ УМК ПРИ ЗАГРУЗКЕ
// ============================================================
fetch('/api/config')
    .then(res => res.json())
    .then(data => {
        if (!data.exists) {
            showCustomNotification('⚠️ Папка УМК не найдена. Укажите путь в настройках.', 'error');
        }
        loadStats();
        loadPath('');
    })
    .catch(() => {
        loadStats();
        loadPath('');
    });

// ============================================================
// 10. АВТООБНОВЛЕНИЕ СТАТИСТИКИ
// ============================================================
setInterval(loadStats, 30000);

// ============================================================
// 11. ПОИСК ПОСЛЕ НАЖАТИЯ ENTER (если есть поле поиска)
// ============================================================
// Если в будущем добавишь поиск — раскомментируй:
// document.addEventListener('keydown', (e) => {
//     if (e.key === 'Enter' && e.target.id === 'searchInput') {
//         searchFiles();
//     }
// });
