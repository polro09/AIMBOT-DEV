const chalk = require('chalk');
const moment = require('moment-timezone');

// 로거 설정
const config = {
    timezone: 'Asia/Seoul',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    useEmoji: true,
    useColor: true
};

// 로그 레벨별 설정
const levels = {
    system: {
        emoji: '🔧',
        color: chalk.cyan,
        label: 'SYSTEM'
    },
    info: {
        emoji: '📢',
        color: chalk.blue,
        label: 'INFO'
    },
    success: {
        emoji: '✅',
        color: chalk.green,
        label: 'SUCCESS'
    },
    warn: {
        emoji: '⚠️',
        color: chalk.yellow,
        label: 'WARN'
    },
    error: {
        emoji: '❌',
        color: chalk.red,
        label: 'ERROR'
    },
    module: {
        emoji: '📦',
        color: chalk.magenta,
        label: 'MODULE'
    },
    debug: {
        emoji: '🐛',
        color: chalk.gray,
        label: 'DEBUG'
    }
};

// 로그 포맷팅 함수
function formatLog(level, message, data = null) {
    const timestamp = moment().tz(config.timezone).format(config.dateFormat);
    const levelConfig = levels[level] || levels.info;
    
    let logString = '';
    
    // 타임스탬프
    logString += chalk.gray(`[${timestamp}] `);
    
    // 이모지 (옵션)
    if (config.useEmoji) {
        logString += `${levelConfig.emoji} `;
    }
    
    // 레벨
    if (config.useColor) {
        logString += levelConfig.color(`[${levelConfig.label}]`);
    } else {
        logString += `[${levelConfig.label}]`;
    }
    
    // 메시지
    logString += ` ${message}`;
    
    // 추가 데이터
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
    
    // 로그 기록 저장
    saveToHistory(level, message, data) {
        this.history.push({
            timestamp: new Date(),
            level,
            message,
            data
        });
        
        // 최대 기록 수 유지
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    // 기본 로그 메서드
    log(level, message, data = null) {
        const formattedLog = formatLog(level, message, data);
        console.log(formattedLog);
        this.saveToHistory(level, message, data);
    }
    
    // 레벨별 메서드
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
    
    // 구분선 출력
    separator(char = '─', length = 50) {
        console.log(chalk.gray(char.repeat(length)));
    }
    
    // 배너 출력
    banner(text, color = chalk.cyan) {
        const padding = 2;
        const totalLength = text.length + (padding * 2);
        const border = '═'.repeat(totalLength);
        
        console.log(color(`╔${border}╗`));
        console.log(color(`║${' '.repeat(padding)}${text}${' '.repeat(padding)}║`));
        console.log(color(`╚${border}╝`));
    }
    
    // 테이블 출력
    table(data, headers) {
        console.table(data, headers);
    }
    
    // 진행 상황 표시
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
    
    // 로그 기록 가져오기
    getHistory(level = null, limit = 100) {
        let filtered = this.history;
        
        if (level) {
            filtered = filtered.filter(log => log.level === level);
        }
        
        return filtered.slice(-limit);
    }
    
    // 로그 기록 초기화
    clearHistory() {
        this.history = [];
        this.success('로그 기록이 초기화되었습니다.');
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
module.exports = new Logger();