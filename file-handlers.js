const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const WordExtractor = require('word-extractor');
const pdf = require('pdf-parse');
const { execFile } = require('child_process');
const util = require('util');
const { escapeHtml, formatBytes, findLibreOffice } = require('./utils');

const execFileAsync = util.promisify(execFile);
const TMP_DIR = path.join(__dirname, 'tmp-doc-convert');

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
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
            .excel-container { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; }
            .excel-sheet { margin-bottom: 40px; border: 1px solid #d0d7de; border-radius: 8px; overflow: hidden; background: white; }
            .excel-sheet-title { background: #f6f8fa; padding: 10px 16px; font-weight: 600; font-size: 14px; border-bottom: 1px solid #d0d7de; color: #24292f; }
            .excel-table { border-collapse: collapse; width: 100%; font-size: 13px; }
            .excel-table th { background: #f0f6fc; color: #24292f; font-weight: 600; padding: 8px 12px; border: 1px solid #d0d7de; text-align: left; }
            .excel-table td { padding: 6px 12px; border: 1px solid #d0d7de; min-width: 40px; color: #24292f; }
            .excel-table tr:nth-child(even) td { background: #f8fafc; }
            .excel-table tr:hover td { background: #f0f6fc; }
            .excel-number { text-align: right; font-variant-numeric: tabular-nums; }
            .excel-date { font-variant-numeric: tabular-nums; }
            .excel-empty { color: #8b949e; text-align: center; }
            .excel-scroll { overflow: auto; max-height: 600px; }
        </style>
        <div class="excel-container">
    `;

    workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (data.length === 0) {
            html += `
                <div class="excel-sheet">
                    <div class="excel-sheet-title">📄 ${escapeHtml(sheetName)}</div>
                    <div style="padding:20px;text-align:center;color:#8b949e;">Лист пуст</div>
                </div>
            `;
            return;
        }

        const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);
        const displayData = data.map(row => { const padded = [...row]; while (padded.length < maxCols) padded.push(''); return padded; });

        html += `
            <div class="excel-sheet">
                <div class="excel-sheet-title">📄 ${escapeHtml(sheetName)}</div>
                <div class="excel-scroll">
                    <table class="excel-table">
                        <thead><tr><th style="min-width:30px;">#</th>`;
        
        for (let c = 0; c < maxCols; c++) {
            html += `<th>${String.fromCharCode(65 + c)}</th>`;
        }
        html += `</tr></thead><tbody>`;

        for (let r = 0; r < displayData.length; r++) {
            html += `<tr><td>${r + 1}</td>`;
            for (let c = 0; c < maxCols; c++) {
                let val = displayData[r][c] || '';
                let displayVal = typeof val === 'number' ? val.toString() : escapeHtml(String(val));
                html += `<td>${displayVal}</td>`;
            }
            html += `</tr>`;
        }

        html += `</tbody></table></div></div>`;
    });

    html += `</div>`;
    return html;
}

module.exports = { convertDocToHtml, extractPdfText, renderExcelToHtml };
