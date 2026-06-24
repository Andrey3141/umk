const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { loadConfig, saveConfig, ensureBaseDir } = require('./config');
const { escapeHtml, formatBytes, safeResolve, findLibreOffice } = require('./utils');
const { convertDocToHtml, extractPdfText, renderExcelToHtml } = require('./file-handlers');

const app = express();
const PORT = 3000;
const publicPath = path.join(__dirname, 'public');
const indexPath = path.join(publicPath, 'index.html');

// Загружаем конфиг
let config = loadConfig();
let BASE_DIR = ensureBaseDir(config);

console.log(`✅ Папка УМК: ${BASE_DIR}`);
console.log(`📝 Конфиг: ${path.join(__dirname, 'config.json')}`);

// Настройка Express
app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

// ========== API МАРШРУТЫ ==========

// Получить конфиг
app.get('/api/config', (req, res) => {
    res.json({
        baseDir: BASE_DIR,
        exists: fs.existsSync(BASE_DIR)
    });
});

// Установить путь
app.post('/api/config', (req, res) => {
    const { baseDir } = req.body;
    
    if (!baseDir || typeof baseDir !== 'string') {
        return res.status(400).json({ success: false, error: 'Путь не указан' });
    }

    if (!fs.existsSync(baseDir)) {
        return res.status(400).json({ success: false, error: 'Папка не существует' });
    }

    const stat = fs.statSync(baseDir);
    if (!stat.isDirectory()) {
        return res.status(400).json({ success: false, error: 'Указанный путь не является папкой' });
    }

    const oldBaseDir = BASE_DIR;
    BASE_DIR = baseDir;
    config.baseDir = baseDir;
    
    if (saveConfig(config)) {
        console.log(`📁 Путь УМК изменён: ${oldBaseDir} → ${BASE_DIR}`);
        res.json({ success: true, baseDir: BASE_DIR });
    } else {
        BASE_DIR = oldBaseDir;
        res.status(500).json({ success: false, error: 'Не удалось сохранить конфигурацию' });
    }
});

// Получить настройки
app.get('/api/settings', (req, res) => {
    res.json({
        openMode: config.openMode || 'view'
    });
});

// Сохранить настройки
app.post('/api/settings', (req, res) => {
    const { openMode } = req.body;
    if (openMode) {
        config.openMode = openMode;
        saveConfig(config);
        console.log(`📝 Настройка открытия: ${openMode}`);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: 'Неверный параметр' });
    }
});

// Просмотр папок
app.get('/api/browse', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.status(404).json({ error: 'Папка УМК не найдена' });
    }

    const requestedPath = req.query.path || '';
    const targetPath = safeResolve(BASE_DIR, requestedPath);

    if (!targetPath) return res.status(403).json({ error: 'Доступ запрещён' });
    if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Папка не найдена' });
    if (!fs.statSync(targetPath).isDirectory()) return res.status(400).json({ error: 'Это не папка' });

    try {
        const items = fs.readdirSync(targetPath).map(item => {
            const itemPath = path.join(targetPath, item);
            const itemStat = fs.statSync(itemPath);
            return {
                name: item,
                type: itemStat.isDirectory() ? 'folder' : 'file',
                size: itemStat.size,
                ext: path.extname(item).toLowerCase(),
                modified: itemStat.mtime
            };
        });

        items.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        res.json({ path: requestedPath, items });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка чтения папки' });
    }
});

// Содержимое файла
app.get('/api/file-content', async (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.status(404).json({ error: 'Папка УМК не найдена' });
    }

    const filePath = req.query.path || '';
    const fullPath = safeResolve(BASE_DIR, filePath);

    if (!fullPath) return res.status(403).json({ error: 'Доступ запрещён' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Файл не найден' });

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) return res.status(400).json({ error: 'Это папка, а не файл' });

    const ext = path.extname(fullPath).toLowerCase();
    const fileName = path.basename(fullPath);

    // PDF
    if (ext === '.pdf') {
        try {
            const pdfData = await extractPdfText(fullPath);
            const text = pdfData.text || '';
            const pages = text.split(/\f/g).filter(p => p.trim().length > 0);
            
            let html = `
                <div class="pdf-viewer">
                    <div class="pdf-info">
                        <span>📄 ${escapeHtml(fileName)}</span>
                        <span>📄 Страниц: ${pdfData.numPages || pages.length || '?'}</span>
                        <span>💾 ${formatBytes(stat.size)}</span>
                    </div>
            `;

            if (pages.length === 0) {
                html += `<div style="padding:20px;text-align:center;">PDF не содержит текста</div>`;
            } else {
                pages.forEach((pageContent, index) => {
                    let content = escapeHtml(pageContent).replace(/\n/g, '</p><p>');
                    html += `<div class="pdf-page"><div class="pdf-page-content"><p>${content}</p></div><div class="pdf-page-label">— Страница ${index + 1} —</div></div>`;
                });
            }

            html += `</div>`;
            return res.json({ type: 'pdf', content: html, fileName, size: formatBytes(stat.size), pages: pages.length });
        } catch (e) {
            return res.json({
                type: 'warning',
                fileName,
                size: formatBytes(stat.size),
                message: 'Не удалось прочитать PDF'
            });
        }
    }

    // DOCX
    if (ext === '.docx') {
        try {
            const result = await mammoth.convertToHtml({
                path: fullPath,
                ignoreEmptyParagraphs: false
            });
            return res.json({ type: 'html', content: `<div class="word-page">${result.value}</div>`, fileName });
        } catch (e) {
            return res.json({ type: 'warning', fileName, size: formatBytes(stat.size), message: 'Не удалось прочитать DOCX' });
        }
    }

    // DOC
    if (ext === '.doc') {
        try {
            const html = await convertDocToHtml(fullPath);
            return res.json({ type: 'html', content: `<div class="word-page">${html}</div>`, fileName });
        } catch (e) {
            try {
                const extractor = new WordExtractor();
                const doc = await extractor.extract(fullPath);
                const text = doc.getBody() || '';
                const html = escapeHtml(text).replace(/\n/g, '<br>');
                return res.json({ type: 'html', content: `<div class="word-page">${html}</div>`, fileName });
            } catch (e2) {
                return res.json({ type: 'warning', fileName, size: formatBytes(stat.size), message: 'Не удалось прочитать DOC' });
            }
        }
    }

    // Excel
    if (ext === '.xlsx' || ext === '.xls') {
        try {
            const html = renderExcelToHtml(fullPath);
            return res.json({ type: 'html', content: html, fileName });
        } catch (e) {
            return res.json({ type: 'binary', fileName, size: formatBytes(stat.size) });
        }
    }

    // Видео
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    if (videoExts.includes(ext)) {
        const videoUrl = `/api/video-stream?path=${encodeURIComponent(filePath)}`;
        const html = `
            <div style="max-width:1000px;margin:0 auto;padding:20px;">
                <video controls style="width:100%;display:block;background:#000;max-height:80vh;">
                    <source src="${videoUrl}" type="video/mp4">
                </video>
                <div style="padding:16px 0;">
                    <h3>🎬 ${escapeHtml(fileName)}</h3>
                    <p style="color:#94a3b8;">${formatBytes(stat.size)}</p>
                </div>
            </div>
        `;
        return res.json({ type: 'video', content: html, fileName, size: formatBytes(stat.size) });
    }

    // Изображения
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
    if (imageExts.includes(ext)) {
        const imageUrl = `/api/image?path=${encodeURIComponent(filePath)}`;
        const html = `
            <div style="max-width:1000px;margin:0 auto;padding:20px;text-align:center;">
                <img src="${imageUrl}" style="max-width:100%;max-height:85vh;border-radius:8px;">
                <div style="padding:16px 0;">
                    <h3>🖼️ ${escapeHtml(fileName)}</h3>
                    <p style="color:#94a3b8;">${formatBytes(stat.size)}</p>
                </div>
            </div>
        `;
        return res.json({ type: 'image', content: html, fileName, size: formatBytes(stat.size) });
    }

    // Текстовые файлы
    const textExts = ['.txt', '.md', '.json', '.js', '.html', '.css', '.xml', '.csv', '.log', '.yml', '.yaml'];
    if (textExts.includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return res.json({
            type: 'text',
            content: `<pre style="font-family:monospace;white-space:pre-wrap;margin:0;font-size:13px;line-height:1.6;">${escapeHtml(content)}</pre>`,
            fileName
        });
    }

    return res.json({ type: 'binary', fileName, size: formatBytes(stat.size) });
});

// Видео-стрим
app.get('/api/video-stream', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.status(404).send('Папка УМК не найдена');
    }

    const filePath = req.query.path || '';
    const fullPath = safeResolve(BASE_DIR, filePath);

    if (!fullPath) return res.status(403).send('Доступ запрещён');
    if (!fs.existsSync(fullPath)) return res.status(404).send('Файл не найден');

    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4',
        });

        const stream = fs.createReadStream(fullPath, { start, end });
        stream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(fullPath).pipe(res);
    }
});

// Изображения
app.get('/api/image', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.status(404).send('Папка УМК не найдена');
    }

    const filePath = req.query.path || '';
    const fullPath = safeResolve(BASE_DIR, filePath);

    if (!fullPath) return res.status(403).send('Доступ запрещён');
    if (!fs.existsSync(fullPath)) return res.status(404).send('Файл не найден');

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(fullPath);
});

// Скачивание
app.get('/api/download', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.status(404).send('Папка УМК не найдена');
    }

    const filePath = req.query.path || '';
    const fullPath = safeResolve(BASE_DIR, filePath);

    if (!fullPath) return res.status(403).send('Доступ запрещён');
    if (!fs.existsSync(fullPath)) return res.status(404).send('Файл не найден');

    res.download(fullPath, path.basename(fullPath));
});

// Сохранение файла
app.post('/api/save-file', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.status(404).json({ success: false, error: 'Папка УМК не найдена' });
    }

    const { path: filePath, content } = req.body;
    const fullPath = safeResolve(BASE_DIR, filePath);

    if (!fullPath) return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, error: 'Файл не найден' });

    const ext = path.extname(fullPath).toLowerCase();
    const textExts = ['.txt', '.md', '.json', '.js', '.html', '.css', '.xml', '.csv', '.log'];

    if (!textExts.includes(ext)) {
        return res.status(400).json({ success: false, error: 'Редактирование этого типа не поддерживается' });
    }

    try {
        let saveContent = content;
        const preMatch = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
        if (preMatch) {
            saveContent = preMatch[1];
        }
        saveContent = saveContent
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        fs.writeFileSync(fullPath, saveContent, 'utf-8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Статистика
app.get('/api/info', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.json({ baseDir: BASE_DIR, totalFolders: 0, totalFiles: 0, totalSize: '0' });
    }

    let totalFolders = 0;
    let totalFiles = 0;
    let totalSize = 0;

    function walkDir(dirPath) {
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    totalFolders++;
                    walkDir(itemPath);
                } else {
                    totalFiles++;
                    totalSize += stat.size;
                }
            }
        } catch(e) {}
    }

    walkDir(BASE_DIR);

    res.json({
        baseDir: BASE_DIR,
        totalFolders,
        totalFiles,
        totalSize: formatBytes(totalSize)
    });
});

// Открыть файл в приложении
app.post('/api/open-file', (req, res) => {
    const { path: filePath } = req.body;
    
    if (!filePath) {
        return res.status(400).json({ success: false, error: 'Путь не указан' });
    }

    const fullPath = safeResolve(BASE_DIR, filePath);
    
    if (!fullPath) {
        return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, error: 'Файл не найден' });
    }

    shell.openPath(fullPath)
        .then((error) => {
            if (error) {
                res.status(500).json({ success: false, error: 'Не удалось открыть файл' });
            } else {
                res.json({ success: true });
            }
        })
        .catch((err) => {
            res.status(500).json({ success: false, error: err.message });
        });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(indexPath);
});

// Запуск сервера
function startServer() {
    return new Promise((resolve) => {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}`);
            console.log(`📁 Папка УМК: ${BASE_DIR}`);
            console.log(`📄 index.html: ${indexPath}\n`);
            resolve(server);
        });
    });
}

module.exports = { startServer, BASE_DIR, config };
