const fs = require('fs');
const path = require('path');

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"]/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[m]));
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function safeResolve(base, target) {
    if (!base || !fs.existsSync(base)) return null;
    const full = path.resolve(base, target || '');
    if (!full.startsWith(base)) return null;
    return full;
}

// ===== ИСПРАВЛЕНО: функция объявлена как async =====
async function findLibreOffice() {
    const { execFile } = require('child_process');
    const util = require('util');
    const execFileAsync = util.promisify(execFile);
    const candidates = ['libreoffice', 'soffice'];
    for (const cmd of candidates) {
        try {
            await execFileAsync(cmd, ['--version']);
            return cmd;
        } catch (e) {
            // Игнорируем ошибку, пробуем следующую команду
        }
    }
    return null;
}

module.exports = { escapeHtml, formatBytes, safeResolve, findLibreOffice };
