// ========================================
// utils/logger.js
// ========================================
const chalk = require('chalk');
const moment = require('moment-timezone');

// 색상 정의
const colors = {
    system: chalk.cyan,
    info: chalk.blue,
    success: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
    module: chalk.magenta,
    debug: chalk.gray
};

// 이모지 정의
const emojis = {
    system: '🔧',
    info: '📢',
    success: '✅',
    warn: '⚠️',
    error: '❌',
    module: '📦',
    debug: '🐛'
};

// 타임스탬프 생성
function getTimestamp() {
    return moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
}

// 로그 포맷팅
function formatLog(level, message, data) {
    const color = colors[level] || chalk.white;
    const emoji = emojis[level] || '📝';
    const timestamp = chalk.gray(`[${getTimestamp()}]`);
    const levelTag = color(`[${level.toUpperCase()}]`);
    
    let logString = `${timestamp} ${emoji} ${levelTag} ${message}`;
    
    if (data) {
        logString += '\n' + chalk.gray(JSON.stringify(data, null, 2));
    }
    
    return logString;
}

// 로거 클래스
class Logger {
    constructor() {
        this.history = [];
        this.maxHistory = 1000;
    }
    
    saveToHistory(level, message, data) {
        this.history.push({
            timestamp: new Date(),
            level,
            message,
            data
        });
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    log(level, message, data = null) {
        const formattedLog = formatLog(level, message, data);
        console.log(formattedLog);
        this.saveToHistory(level, message, data);
    }
    
    system(message, data) {
        this.log('system', message, data);
    }
    
    info(message, data) {
        this.log('info', message, data);
    }
    
    success(message, data) {
        this.log('success', message, data);
    }
    
    warn(message, data) {
        this.log('warn', message, data);
    }
    
    error(message, data) {
        this.log('error', message, data);
    }
    
    module(message, data) {
        this.log('module', message, data);
    }
    
    debug(message, data) {
        if (process.env.DEBUG === 'true') {
            this.log('debug', message, data);
        }
    }
    
    separator(char = '─', length = 50) {
        console.log(chalk.gray(char.repeat(length)));
    }
    
    banner(text, color = chalk.cyan) {
        const padding = 2;
        const totalLength = text.length + (padding * 2);
        const border = '═'.repeat(totalLength);
        
        console.log(color(`╔${border}╗`));
        console.log(color(`║${' '.repeat(padding)}${text}${' '.repeat(padding)}║`));
        console.log(color(`╚${border}╝`));
    }
    
    table(data, headers) {
        console.table(data, headers);
    }
    
    progress(current, total, label = 'Progress') {
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round(percentage / 5);
        const empty = 20 - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(
            chalk.cyan(`${label}: [${bar}] ${percentage}% (${current}/${total})`)
        );
        
        if (current === total) {
            process.stdout.write('\n');
        }
    }
    
    getHistory(level = null, limit = 100) {
        let filtered = this.history;
        
        if (level) {
            filtered = filtered.filter(log => log.level === level);
        }
        
        return filtered.slice(-limit);
    }
    
    clearHistory() {
        this.history = [];
        this.success('로그 기록이 초기화되었습니다.');
    }
}

module.exports = new Logger();
