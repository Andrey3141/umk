#!/usr/bin/env node
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const WordExtractor = require('word-extractor');
const { execFile } = require('child_process');
const util = require('util');
const pdf = require('pdf-parse');

const execFileAsync = util.promisify(execFile);

const app = express();
const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ========== РАБОТА С КОНФИГУРАЦИЕЙ ==========
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Ошибка загрузки конфига:', e);
    }
    return { baseDir: '' };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Ошибка сохранения конфига:', e);
        return false;
    }
}

// Загружаем конфиг
let config = loadConfig();
let BASE_DIR = config.baseDir || '';

// Если путь не задан, пробуем найти стандартный
if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
    const defaultPaths = [
        '/home/lenovo/working/lab 1 (text)/мастер/умк',
        path.join(__dirname, 'умк'),
        path.join(__dirname, '..', 'умк'),
        path.join(process.env.HOME || '', 'умк'),
    ];
    
    for (const p of defaultPaths) {
        if (fs.existsSync(p)) {
            BASE_DIR = p;
            break;
        }
    }
}

// Если путь всё ещё не найден, создаём папку по умолчанию
if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
    BASE_DIR = path.join(__dirname, 'умк');
    if (!fs.existsSync(BASE_DIR)) {
        fs.mkdirSync(BASE_DIR, { recursive: true });
        console.log(`📁 Создана папка УМК: ${BASE_DIR}`);
    }
}

// Сохраняем найденный путь в конфиг
if (config.baseDir !== BASE_DIR) {
    config.baseDir = BASE_DIR;
    saveConfig(config);
}

const TMP_DIR = path.join(__dirname, 'tmp-doc-convert');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

console.log(`✅ Папка УМК: ${BASE_DIR}`);
console.log(`📝 Конфиг: ${CONFIG_FILE}`);

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

async function findLibreOffice() {
    const candidates = ['libreoffice', 'soffice'];
    for (const cmd of candidates) {
        try {
            await execFileAsync(cmd, ['--version']);
            return cmd;
        } catch (e) {}
    }
    return null;
}

async function convertDocToHtml(fullPath) {
    const libreoffice = await findLibreOffice();
    if (!libreoffice) throw new Error('LibreOffice not found');

    const name = path.basename(fullPath, path.extname(fullPath));
    const outDir = fs.mkdtempSync(path.join(TMP_DIR, `${name}-`));

    await execFileAsync(libreoffice, [
        '--headless',
        '--convert-to',
        'html',
        '--outdir',
        outDir,
        fullPath
    ]);

    const htmlFile = path.join(outDir, `${name}.html`);
    if (!fs.existsSync(htmlFile)) {
        const files = fs.readdirSync(outDir).filter(f => f.toLowerCase().endsWith('.html'));
        if (!files.length) throw new Error('HTML conversion failed');
        return fs.readFileSync(path.join(outDir, files[0]), 'utf-8');
    }

    return fs.readFileSync(htmlFile, 'utf-8');
}

async function extractPdfText(fullPath) {
    try {
        const dataBuffer = fs.readFileSync(fullPath);
        const data = await pdf(dataBuffer);
        return {
            text: data.text,
            numPages: data.numpages,
            info: data.info
        };
    } catch (e) {
        throw new Error('PDF parsing failed');
    }
}

function renderExcelToHtml(fullPath) {
    const workbook = XLSX.readFile(fullPath, { cellDates: true, cellStyles: true });
    let html = `
        <style>
            .excel-container {
                font-family: 'Segoe UI', Arial, sans-serif;
                padding: 20px;
            }
            .excel-sheet {
                margin-bottom: 40px;
                border: 1px solid #d0d7de;
                border-radius: 8px;
                overflow: hidden;
                background: white;
            }
            .excel-sheet-title {
                background: #f6f8fa;
                padding: 10px 16px;
                font-weight: 600;
                font-size: 14px;
                border-bottom: 1px solid #d0d7de;
                color: #24292f;
            }
            .excel-table {
                border-collapse: collapse;
                width: 100%;
                font-size: 13px;
            }
            .excel-table th {
                background: #f0f6fc;
                color: #24292f;
                font-weight: 600;
                padding: 8px 12px;
                border: 1px solid #d0d7de;
                text-align: left;
                position: sticky;
                top: 0;
                z-index: 2;
            }
            .excel-table td {
                padding: 6px 12px;
                border: 1px solid #d0d7de;
                min-width: 40px;
                color: #24292f;
            }
            .excel-table tr:nth-child(even) td {
                background: #f8fafc;
            }
            .excel-table tr:hover td {
                background: #f0f6fc;
            }
            .excel-number {
                text-align: right;
                font-variant-numeric: tabular-nums;
            }
            .excel-date {
                font-variant-numeric: tabular-nums;
            }
            .excel-empty {
                color: #8b949e;
                text-align: center;
            }
            .excel-scroll {
                overflow: auto;
                max-height: 600px;
            }
            .excel-table th:first-child,
            .excel-table td:first-child {
                background: #f6f8fa;
                font-weight: 500;
                color: #57606a;
                min-width: 30px;
                text-align: center;
            }
            .excel-table tr:nth-child(even) td:first-child {
                background: #f0f2f4;
            }
            .excel-table tr:hover td:first-child {
                background: #e8ecf0;
            }
        </style>
        <div class="excel-container">
    `;

    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (data.length === 0) {
            html += `
                <div class="excel-sheet">
                    <div class="excel-sheet-title">📄 ${escapeHtml(sheetName)}</div>
                    <div style="padding: 20px; text-align: center; color: #8b949e;">
                        <i class="fas fa-table" style="font-size: 24px; display: block; margin-bottom: 8px;"></i>
                        Лист пуст
                    </div>
                </div>
            `;
            return;
        }

        const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
        
        const displayData = data.map(row => {
            const padded = [...row];
            while (padded.length < maxCols) padded.push('');
            return padded;
        });

        const colTypes = [];
        if (displayData.length > 0) {
            for (let c = 0; c < maxCols; c++) {
                let hasNumber = false;
                let hasDate = false;
                let hasEmpty = false;
                let hasString = false;
                
                for (let r = 0; r < Math.min(displayData.length, 100); r++) {
                    const val = displayData[r][c];
                    if (val === '' || val === null || val === undefined) {
                        hasEmpty = true;
                        continue;
                    }
                    if (typeof val === 'number') {
                        hasNumber = true;
                    } else if (typeof val === 'string') {
                        const dateCheck = XLSX.SSF.parse_date_code(val);
                        if (dateCheck) {
                            hasDate = true;
                        } else {
                            hasString = true;
                        }
                    }
                }
                
                if (hasNumber && !hasString && !hasDate) {
                    colTypes[c] = 'number';
                } else if (hasDate && !hasString) {
                    colTypes[c] = 'date';
                } else {
                    colTypes[c] = 'string';
                }
            }
        }

        html += `
            <div class="excel-sheet">
                <div class="excel-sheet-title">📄 ${escapeHtml(sheetName)}</div>
                <div class="excel-scroll">
                    <table class="excel-table">
                        <thead>
                            <tr>
                                <th style="min-width:30px;">#</th>
        `;

        const headerRow = displayData[0] || [];
        const useFirstRowAsHeader = displayData.length > 1 && 
            headerRow.some(v => v !== '' && typeof v === 'string');

        if (useFirstRowAsHeader) {
            for (let c = 0; c < maxCols; c++) {
                const val = headerRow[c] || `Столбец ${String.fromCharCode(65 + c)}`;
                html += `<th>${escapeHtml(String(val))}</th>`;
            }
            html += `</tr></thead><tbody>`;
            const startRow = 1;
            for (let r = startRow; r < displayData.length; r++) {
                const row = displayData[r];
                html += `<tr><td>${r - startRow + 1}</td>`;
                for (let c = 0; c < maxCols; c++) {
                    let val = row[c] !== undefined ? row[c] : '';
                    let displayVal = val;
                    let className = '';
                    
                    if (val === '' || val === null || val === undefined) {
                        displayVal = '';
                        className = 'excel-empty';
                    } else if (typeof val === 'number') {
                        if (colTypes[c] === 'date') {
                            const date = XLSX.SSF.parse_date_code(val);
                            if (date) {
                                const d = new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
                                displayVal = d.toLocaleDateString('ru-RU');
                                className = 'excel-date';
                            } else {
                                displayVal = val.toString();
                                className = 'excel-number';
                            }
                        } else {
                            displayVal = val.toString();
                            className = 'excel-number';
                        }
                    } else {
                        displayVal = String(val);
                        if (colTypes[c] === 'date') {
                            const dateCheck = XLSX.SSF.parse_date_code(val);
                            if (dateCheck) {
                                const d = new Date(dateCheck.y, dateCheck.m - 1, dateCheck.d);
                                displayVal = d.toLocaleDateString('ru-RU');
                                className = 'excel-date';
                            }
                        }
                    }
                    
                    html += `<td class="${className}">${escapeHtml(displayVal)}</td>`;
                }
                html += `</tr>`;
            }
        } else {
            html += `</tr></thead><tbody>`;
            for (let r = 0; r < displayData.length; r++) {
                const row = displayData[r];
                html += `<tr><td>${r + 1}</td>`;
                for (let c = 0; c < maxCols; c++) {
                    let val = row[c] !== undefined ? row[c] : '';
                    let displayVal = val;
                    let className = '';
                    
                    if (val === '' || val === null || val === undefined) {
                        displayVal = '';
                        className = 'excel-empty';
                    } else if (typeof val === 'number') {
                        if (colTypes[c] === 'date') {
                            const date = XLSX.SSF.parse_date_code(val);
                            if (date) {
                                const d = new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
                                displayVal = d.toLocaleDateString('ru-RU');
                                className = 'excel-date';
                            } else {
                                displayVal = val.toString();
                                className = 'excel-number';
                            }
                        } else {
                            displayVal = val.toString();
                            className = 'excel-number';
                        }
                    } else {
                        displayVal = String(val);
                        if (colTypes[c] === 'date') {
                            const dateCheck = XLSX.SSF.parse_date_code(val);
                            if (dateCheck) {
                                const d = new Date(dateCheck.y, dateCheck.m - 1, dateCheck.d);
                                displayVal = d.toLocaleDateString('ru-RU');
                                className = 'excel-date';
                            }
                        }
                    }
                    
                    html += `<td class="${className}">${escapeHtml(displayVal)}</td>`;
                }
                html += `</tr>`;
            }
        }

        html += `</tbody></table></div></div>`;
    });

    html += `</div>`;
    return html;
}

// ========== API: Получить текущий путь ==========
app.get('/api/config', (req, res) => {
    res.json({
        baseDir: BASE_DIR,
        exists: fs.existsSync(BASE_DIR)
    });
});

// ========== API: Установить путь ==========
app.post('/api/config', (req, res) => {
    const { baseDir } = req.body;
    
    if (!baseDir || typeof baseDir !== 'string') {
        return res.status(400).json({ success: false, error: 'Путь не указан' });
    }

    // Проверяем, что папка существует
    if (!fs.existsSync(baseDir)) {
        return res.status(400).json({ success: false, error: 'Папка не существует' });
    }

    // Проверяем, что это папка
    const stat = fs.statSync(baseDir);
    if (!stat.isDirectory()) {
        return res.status(400).json({ success: false, error: 'Указанный путь не является папкой' });
    }

    // Сохраняем новый путь
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

// ========== API: Просмотр папок ==========
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

// ========== API: Содержимое файла ==========
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

    // ===== PDF =====
    if (ext === '.pdf') {
        try {
            const pdfData = await extractPdfText(fullPath);
            const text = pdfData.text || '';
            const pages = text.split(/\f/g).filter(p => p.trim().length > 0);
            
            let html = `
                <div class="pdf-viewer">
                    <div class="pdf-info">
                        <span><i class="fas fa-file-pdf"></i> ${escapeHtml(fileName)}</span>
                        <span><i class="fas fa-file-alt"></i> Страниц: ${pdfData.numPages || pages.length || '?'}</span>
                        <span><i class="fas fa-database"></i> ${formatBytes(stat.size)}</span>
                        ${pdfData.info && pdfData.info.Title ? `<span><i class="fas fa-tag"></i> ${escapeHtml(pdfData.info.Title)}</span>` : ''}
                    </div>
            `;

            if (pages.length === 0 || (pages.length === 1 && pages[0].trim().length === 0)) {
                html += `
                    <div class="pdf-empty">
                        <i class="fas fa-file-pdf"></i>
                        <p>PDF-документ не содержит текста для отображения</p>
                        <p style="font-size: 12px; margin-top: 8px;">
                            <button onclick="window.parent.downloadFile('${filePath}')" style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;margin-top:12px;">
                                <i class="fas fa-download"></i> Скачать PDF
                            </button>
                        </p>
                    </div>
                `;
            } else {
                pages.forEach((pageContent, index) => {
                    let content = escapeHtml(pageContent)
                        .replace(/\r\n|\n\r|\r|\n/g, '</p><p>')
                        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
                    
                    html += `
                        <div class="pdf-page">
                            <div class="pdf-page-content">
                                <p>${content}</p>
                            </div>
                            <div class="pdf-page-label">— Страница ${index + 1} —</div>
                        </div>
                    `;
                });
            }

            html += `</div>`;
            return res.json({ type: 'pdf', content: html, fileName, size: formatBytes(stat.size), pages: pages.length });
        } catch (e) {
            console.error('PDF error:', e);
            return res.json({
                type: 'warning',
                fileName,
                size: formatBytes(stat.size),
                message: 'Не удалось прочитать содержимое PDF. Возможно, файл защищён паролем или повреждён.',
                downloadUrl: `/api/download?path=${encodeURIComponent(filePath)}`
            });
        }
    }

    // ===== DOCX =====
    if (ext === '.docx') {
        try {
            const result = await mammoth.convertToHtml({
                path: fullPath,
                ignoreEmptyParagraphs: false,
                convertImage: mammoth.images.imgElement(async image => {
                    const buffer = await image.read();
                    const base64 = buffer.toString('base64');
                    return { src: `data:${image.contentType};base64,${base64}` };
                })
            });

            return res.json({
                type: 'html',
                content: `<div class="word-page">${result.value}</div>`,
                warnings: result.messages || [],
                fileName
            });
        } catch (e) {
            return res.json({
                type: 'warning',
                fileName,
                size: formatBytes(stat.size),
                message: 'Не удалось корректно прочитать DOCX'
            });
        }
    }

    // ===== DOC =====
    if (ext === '.doc') {
        try {
            const html = await convertDocToHtml(fullPath);
            return res.json({
                type: 'html',
                content: `<div class="word-page">${html}</div>`,
                fileName
            });
        } catch (e1) {
            try {
                const extractor = new WordExtractor();
                const doc = await extractor.extract(fullPath);
                const text = doc.getBody() || '';
                const html = escapeHtml(text)
                    .replace(/\r\n|\n\r|\r|\n/g, '<br>')
                    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
                    .replace(/  /g, '&nbsp;&nbsp;');

                return res.json({
                    type: 'html',
                    content: `<div class="word-page">${html}</div>`,
                    fileName
                });
            } catch (e2) {
                return res.json({
                    type: 'warning',
                    fileName,
                    size: formatBytes(stat.size),
                    message: 'Не удалось прочитать DOC-файл'
                });
            }
        }
    }

    // ===== EXCEL =====
    if (ext === '.xlsx' || ext === '.xls') {
        try {
            const html = renderExcelToHtml(fullPath);
            return res.json({ type: 'html', content: html, fileName });
        } catch (e) {
            console.error('Excel error:', e);
            return res.json({ type: 'binary', fileName, size: formatBytes(stat.size) });
        }
    }

    // ===== ВИДЕО =====
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
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
        
        const html = `
            <div style="max-width:1000px;margin:0 auto;padding:20px;">
                <div style="background:#0f172a;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
                    <video controls style="width:100%;display:block;background:#000;max-height:80vh;" preload="metadata">
                        <source src="${videoUrl}" type="${mimeType}">
                        Ваш браузер не поддерживает видео.
                    </video>
                </div>
                <div style="padding:16px 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div>
                        <h3 style="margin:0;font-size:16px;color:#1e293b;">🎬 ${escapeHtml(fileName)}</h3>
                        <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">${formatBytes(stat.size)}</p>
                    </div>
                    <button onclick="window.parent.downloadFile('${filePath}')" style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;">
                        <i class="fas fa-download"></i> Скачать
                    </button>
                </div>
            </div>
        `;
        return res.json({ type: 'video', content: html, fileName, size: formatBytes(stat.size) });
    }

    // ===== ИЗОБРАЖЕНИЯ =====
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico', '.tiff', '.tif'];
    if (imageExts.includes(ext)) {
        const imageUrl = `/api/image?path=${encodeURIComponent(filePath)}`;
        const isGif = ext === '.gif';
        const html = `
            <div style="max-width:1000px;margin:0 auto;padding:20px;text-align:center;">
                <div style="background:#f1f5f9;border-radius:16px;padding:20px;min-height:200px;display:flex;align-items:center;justify-content:center;flex-direction:column;">
                    <img src="${imageUrl}" 
                         alt="${escapeHtml(fileName)}" 
                         style="max-width:100%;max-height:85vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);"
                         onerror="this.parentElement.innerHTML='<div style=\\'padding:40px;color:#94a3b8;\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'font-size:32px;display:block;margin-bottom:12px;\\'></i>Не удалось загрузить изображение</div>'">
                    ${isGif ? `<span style="display:inline-block;margin-top:12px;font-size:12px;color:#94a3b8;background:#e2e8f0;padding:4px 12px;border-radius:12px;">GIF анимация</span>` : ''}
                </div>
                <div style="padding:16px 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div>
                        <h3 style="margin:0;font-size:16px;color:#1e293b;">🖼️ ${escapeHtml(fileName)}</h3>
                        <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">${formatBytes(stat.size)}</p>
                    </div>
                    <button onclick="window.parent.downloadFile('${filePath}')" style="background:#2c5a8c;color:white;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;">
                        <i class="fas fa-download"></i> Скачать
                    </button>
                </div>
            </div>
        `;
        return res.json({ type: 'image', content: html, fileName, size: formatBytes(stat.size) });
    }

    // ===== ТЕКСТОВЫЕ ФАЙЛЫ =====
    const textExts = ['.txt', '.md', '.json', '.js', '.html', '.css', '.xml', '.csv', '.log', '.yml', '.yaml', '.toml', '.ini', '.cfg'];
    if (textExts.includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return res.json({
            type: 'text',
            content: `<pre style="font-family:monospace;white-space:pre-wrap;margin:0;font-size:13px;line-height:1.6;">${escapeHtml(content)}</pre>`,
            fileName
        });
    }

    // ===== ОСТАЛЬНЫЕ =====
    return res.json({ type: 'binary', fileName, size: formatBytes(stat.size) });
});

// ========== API: Видео-стрим ==========
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

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska'
    };
    const mimeType = mimeTypes[ext] || 'video/mp4';

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
        });

        const stream = fs.createReadStream(fullPath, { start, end });
        stream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(fullPath).pipe(res);
    }
});

// ========== API: Изображения ==========
app.get('/api/image', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.status(404).send('Папка УМК не найдена');
    }

    const filePath = req.query.path || '';
    const fullPath = safeResolve(BASE_DIR, filePath);

    if (!fullPath) return res.status(403).send('Доступ запрещён');
    if (!fs.existsSync(fullPath)) return res.status(404).send('Файл не найден');

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff'
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(fullPath);
});

// ========== API: Скачивание ==========
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

// ========== API: Сохранение файла ==========
app.post('/api/save-file', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.status(404).json({ success: false, error: 'Папка УМК не найдена' });
    }

    const { path: filePath, content } = req.body;
    const fullPath = safeResolve(BASE_DIR, filePath);

    if (!fullPath) return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, error: 'Файл не найден' });

    const ext = path.extname(fullPath).toLowerCase();
    const textExts = ['.txt', '.md', '.json', '.js', '.html', '.css', '.xml', '.csv', '.log', '.yml', '.yaml', '.toml', '.ini', '.cfg'];

    if (!textExts.includes(ext)) {
        return res.status(400).json({ success: false, error: 'Редактирование этого типа файлов не поддерживается' });
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
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');

        fs.writeFileSync(fullPath, saveContent, 'utf-8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ========== API: Статистика ==========
app.get('/api/info', (req, res) => {
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        return res.json({
            baseDir: BASE_DIR,
            totalFolders: 0,
            totalFiles: 0,
            totalSize: '0',
            error: 'Папка УМК не найдена'
        });
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 УМК запущен`);
    console.log(`📂 ${BASE_DIR}`);
    console.log(`🌐 http://localhost:${PORT}\n`);
});
