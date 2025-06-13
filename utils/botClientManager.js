// ========================================
// utils/botClientManager.js
// ========================================
const logger = require('./logger');
let botInstance = null;

class BotClientManager {
    static setClient(client) {
        botInstance = client;
        logger.info('봇 클라이언트가 설정되었습니다.');
    }
    
    static getClient() {
        if (!botInstance) {
            throw new Error('봇 클라이언트가 초기화되지 않았습니다.');
        }
        return botInstance;
    }
    
    static isInitialized() {
        return botInstance !== null;
    }
}

module.exports = BotClientManager;