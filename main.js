const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('./server');

let mainWindow;
let server;
let serverReady = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 380,
        resizable: false,
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        },
        show: true,
        autoHideMenuBar: true,
        frame: true,
        backgroundColor: '#f0f4ff'
    });

    mainWindow.setMenu(null);

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>УМК Мастер</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
    font-family: system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
}
.container {
    background: white;
    border-radius: 24px;
    padding: 40px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.3);
    max-width: 400px;
    width: 100%;
    text-align: center;
}
.logo { font-size: 56px; }
h1 { color: #2d3748; font-size: 24px; margin: 8px 0; }
.subtitle { color: #718096; font-size: 14px; margin-bottom: 20px; }
.status {
    background: #f7fafc;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
    border: 2px solid #e2e8f0;
    transition: all 0.3s ease;
}
.status.ready { border-color: #48bb78; }
.status.error { border-color: #fc8181; }
.status.waiting { border-color: #ecc94b; }
.dot {
    display: inline-block;
    width: 12px; height: 12px;
    border-radius: 50%;
    margin-right: 10px;
    background: #e2e8f0;
    transition: all 0.3s ease;
}
.dot.green { background: #48bb78; animation: pulse 2s infinite; }
.dot.red { background: #fc8181; }
.dot.yellow { background: #ecc94b; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:1; transform:scale(1.2); } }
.status-text { font-size: 15px; font-weight: 600; color: #2d3748; }
.status-text.green { color: #48bb78; }
.status-text.red { color: #fc8181; }
.status-text.yellow { color: #ecc94b; }
.url { font-size: 13px; color: #a0aec0; margin-top: 6px; font-family: monospace; }
.btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 14px 40px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    transition: transform 0.2s;
}
.btn:hover:not(:disabled) { transform: scale(1.02); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.footer { margin-top: 16px; font-size: 12px; color: #a0aec0; }
.loader {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 3px solid #e2e8f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container">
    <div class="logo">🎓</div>
    <h1>УМК Мастер</h1>
    <p class="subtitle">Мастера производственного обучения</p>
    <div class="status waiting" id="status">
        <div>
            <span class="dot yellow" id="dot"></span>
            <span class="status-text yellow" id="statusText">Запуск...</span>
        </div>
        <div class="url">🌐 http://localhost:3000</div>
    </div>
    <button class="btn" id="btn" disabled>
        <span class="loader" id="loader"></span>
        <span id="btnText">Загрузка...</span>
    </button>
    <div class="footer">⚡ Версия 2.0.0</div>
</div>
<script>
const { ipcRenderer } = require('electron');
const status = document.getElementById('status');
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const btn = document.getElementById('btn');
const loader = document.getElementById('loader');
const btnText = document.getElementById('btnText');

ipcRenderer.on('server-status', (e, data) => {
    if (data.ready) {
        status.className = 'status ready';
        dot.className = 'dot green';
        statusText.className = 'status-text green';
        statusText.textContent = '✅ Готово!';
        btn.disabled = false;
        loader.style.display = 'none';
        btnText.textContent = '🌐 Открыть сайт';
        btn.onclick = () => ipcRenderer.send('open-browser');
    } else if (data.error) {
        status.className = 'status error';
        dot.className = 'dot red';
        statusText.className = 'status-text red';
        statusText.textContent = '❌ ' + (data.message || 'Ошибка');
        btn.disabled = true;
        loader.style.display = 'none';
        btnText.textContent = '❌ Ошибка';
    } else {
        status.className = 'status waiting';
        dot.className = 'dot yellow';
        statusText.className = 'status-text yellow';
        statusText.textContent = '⏳ ' + (data.message || 'Запуск...');
        btn.disabled = true;
        loader.style.display = 'inline-block';
        btnText.textContent = '⏳ Загрузка...';
    }
});
</script>
</body>
</html>`;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('open-browser', () => {
    require('electron').shell.openExternal('http://localhost:3000');
});

app.whenReady().then(async () => {
    console.log('🚀 Запуск УМК Мастер');
    console.log('📁 Папка приложения:', __dirname);
    
    createWindow();
    
    try {
        server = await startServer();
        serverReady = true;
        mainWindow.webContents.send('server-status', { ready: true });
        
        setTimeout(() => {
            require('electron').shell.openExternal('http://localhost:3000');
        }, 1000);
        
    } catch (err) {
        console.error('❌ Ошибка:', err);
        mainWindow.webContents.send('server-status', { error: true, message: err.message });
    }
});

app.on('window-all-closed', () => {
    if (server) {
        server.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

process.on('uncaughtException', (error) => {
    console.error('❌ Критическая ошибка:', error);
    if (mainWindow) {
        mainWindow.webContents.send('server-status', { error: true, message: error.message });
    }
});
