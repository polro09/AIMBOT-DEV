const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const BotClientManager = require('./utils/botClientManager');
const eventBus = require('./utils/eventBus');

// 봇 클라이언트 생성
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// 봇 클라이언트를 전역적으로 사용 가능하게 설정
BotClientManager.setClient(client);

// 모듈 컬렉션
client.modules = new Collection();

// 모듈 로드 함수
async function loadModules() {
    const modulesPath = path.join(__dirname, 'modules');
    
    if (!fs.existsSync(modulesPath)) {
        logger.warn('📁 modules 폴더가 없습니다. 폴더를 생성합니다.');
        fs.mkdirSync(modulesPath);
        return;
    }
    
    const moduleFiles = fs.readdirSync(modulesPath).filter(file => file.endsWith('.js'));
    
    for (const file of moduleFiles) {
        try {
            const module = require(path.join(modulesPath, file));
            
            if (module.name && module.init) {
                await module.init(client);
                client.modules.set(module.name, module);
                logger.success(`✅ 모듈 로드됨: ${module.name}`);
            } else {
                logger.error(`❌ 잘못된 모듈 형식: ${file}`);
            }
        } catch (error) {
            logger.error(`❌ 모듈 로드 실패: ${file} - ${error.message}`);
            logger.error(error.stack);
        }
    }
}

// 이벤트 로드 함수
async function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    
    if (!fs.existsSync(eventsPath)) {
        logger.warn('📁 events 폴더가 없습니다. 폴더를 생성합니다.');
        fs.mkdirSync(eventsPath);
        return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        try {
            const event = require(path.join(eventsPath, file));
            
            if (event.name && event.execute) {
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
                
                logger.success(`📅 이벤트 로드됨: ${event.name}`);
            } else {
                logger.error(`❌ 잘못된 이벤트 형식: ${file}`);
            }
        } catch (error) {
            logger.error(`❌ 이벤트 로드 실패: ${file} - ${error.message}`);
        }
    }
}

// 봇 준비 이벤트
client.once('ready', async () => {
    logger.separator();
    logger.system(`🤖 ${client.user.tag} 봇이 준비되었습니다!`);
    logger.info(`📊 ${client.guilds.cache.size}개의 서버에서 실행 중`);
    
    // 모듈 로드
    await loadModules();
    
    // 웹 서버 시작
    try {
        const { startWebServer } = require('./web/server');
        await startWebServer();
    } catch (error) {
        logger.error(`웹 서버 시작 실패: ${error.message}`);
    }
});

// 오류 처리
client.on('error', error => {
    logger.error(`클라이언트 오류: ${error.message}`);
    logger.error(error.stack);
});

process.on('unhandledRejection', error => {
    logger.error(`처리되지 않은 거부: ${error.message}`);
    logger.error(error.stack);
});

process.on('uncaughtException', error => {
    logger.error(`잡히지 않은 예외: ${error.message}`);
    logger.error(error.stack);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('🛑 봇 종료 신호를 받았습니다...');
    
    try {
        client.destroy();
        logger.success('✅ Discord 클라이언트가 종료되었습니다.');
        
        // EventBus 이벤트 발행
        eventBus.safeEmit('bot:shutdown');
        
        // 잠시 대기 후 종료
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    } catch (error) {
        logger.error(`종료 중 오류: ${error.message}`);
        process.exit(1);
    }
});

// 봇 시작
async function start() {
    try {
        logger.separator();
        logger.banner('AIMDOT.DEV BOT');
        logger.separator();
        logger.system('🚀 시스템을 시작하는 중...');
        logger.separator();

        // 환경 변수 확인
        const requiredEnvVars = ['DISCORD_TOKEN'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            logger.error(`❌ 필수 환경 변수가 없습니다: ${missingVars.join(', ')}`);
            logger.info('💡 .env 파일을 확인하고 필요한 값을 설정하세요.');
            process.exit(1);
        }
        
        // 이벤트 로드
        await loadEvents();
        
        // 봇 로그인
        logger.info('🤖 Discord 봇 로그인 중...');
        await client.login(config.discord.token);
        
    } catch (error) {
        logger.error(`봇 시작 실패: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    }
}

// 시작
start();