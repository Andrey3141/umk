const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Ошибка загрузки конфига:', e);
    }
    return { baseDir: '', openMode: 'view' };
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

function findDefaultPath() {
    const defaultPaths = [
        path.join(__dirname, 'public', 'умк'),
        path.join(__dirname, 'умк'),
        path.join(process.env.HOME || '', 'умк'),
        'C:\\умк'
    ];
    
    for (const p of defaultPaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

function ensureBaseDir(config) {
    let BASE_DIR = config.baseDir || '';
    
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        BASE_DIR = findDefaultPath();
    }
    
    if (!BASE_DIR || !fs.existsSync(BASE_DIR)) {
        BASE_DIR = path.join(__dirname, 'умк');
        if (!fs.existsSync(BASE_DIR)) {
            try {
                fs.mkdirSync(BASE_DIR, { recursive: true });
                console.log(`📁 Создана папка УМК: ${BASE_DIR}`);
            } catch (e) {
                console.error('❌ Не удалось создать папку:', e);
            }
        }
    }
    
    if (config.baseDir !== BASE_DIR) {
        config.baseDir = BASE_DIR;
        saveConfig(config);
    }
    
    return BASE_DIR;
}

module.exports = { loadConfig, saveConfig, findDefaultPath, ensureBaseDir };
