// ========================================
// utils/eventBus.js
// ========================================
const EventEmitter = require('events');
const logger = require('./logger');

class BotEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
    }
    
    safeEmit(event, ...args) {
        try {
            this.emit(event, ...args);
            logger.debug(`이벤트 발행: ${event}`);
        } catch (error) {
            logger.error(`이벤트 발행 오류 (${event}): ${error.message}`);
        }
    }
}

const eventBus = new BotEventBus();

eventBus.on('error', (error) => {
    logger.error(`EventBus 오류: ${error.message}`);
});

module.exports = eventBus;