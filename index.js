const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 로거 시스템
const logger = require('./utils/logger');

// 클라이언트 생성
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// 컬렉션 초기화
client.modules = new Collection();
client.commands = new Collection();
client.events = new Collection();

// 데이터 폴더 확인 및 생성
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info('📁 데이터 폴더가 생성되었습니다.');
}

// 모듈 로딩 함수
async function loadModules() {
    const modulesPath = path.join(__dirname, 'modules');
    
    if (!fs.existsSync(modulesPath)) {
        fs.mkdirSync(modulesPath, { recursive: true });
        logger.warn('📦 모듈 폴더가 생성되었습니다.');
        return;
    }

    const moduleFiles = fs.readdirSync(modulesPath).filter(file => file.endsWith('.js'));

    for (const file of moduleFiles) {
        try {
            const module = require(path.join(modulesPath, file));
            
            if (module.name && module.execute) {
                client.modules.set(module.name, module);
                
                // 모듈 초기화
                if (module.init) {
                    await module.init(client);
                }
                
                logger.success(`✅ 모듈 로드됨: ${module.name}`);
            } else {
                logger.error(`❌ 잘못된 모듈 형식: ${file}`);
            }
        } catch (error) {
            logger.error(`❌ 모듈 로드 실패: ${file} - ${error.message}`);
        }
    }
}

// 이벤트 핸들러 로딩
async function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
        logger.warn('📅 이벤트 폴더가 생성되었습니다.');
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
                
                logger.success(`✅ 이벤트 로드됨: ${event.name}`);
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
        require('./web/server');
    } catch (error) {
        logger.error(`웹 서버 시작 실패: ${error.message}`);
    }
});

// 오류 처리
client.on('error', error => {
    logger.error(`클라이언트 오류: ${error.message}`);
});

process.on('unhandledRejection', error => {
    logger.error(`처리되지 않은 거부: ${error.message}`);
});

// 봇 시작
async function start() {
    try {
        logger.separator();
        logger.banner('AIMDOT.DEV BOT');
        logger.separator();

        // 봇 정보 출력
        logger.system(`🤖 봇 로그인: ${process.env.BOT_NAME || 'Aimbot.DEV'}`);
        logger.info(`📊 서버 수: ${client.guilds.cache.size}`);
        logger.info(`👥 전체 유저 수: ${client.users.cache.size}`);
        logger.info(`📺 채널 수: ${client.channels.cache.size}`);
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
        await client.login(process.env.DISCORD_TOKEN);
        
        logger.separator();
        logger.success('✅ 봇이 성공적으로 시작되었습니다!');
        logger.separator();
        
        // 웹 대시보드 시작 (옵션)
        if (process.env.ENABLE_WEB_DASHBOARD === 'true') {
            logger.info('🌐 웹 대시보드를 시작하는 중...');
            
            // 웹 서버 환경 변수 확인
            const webRequiredVars = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'];
            const missingWebVars = webRequiredVars.filter(varName => !process.env[varName]);
            
            if (missingWebVars.length > 0) {
                logger.warn(`⚠️ 웹 대시보드 환경 변수가 없습니다: ${missingWebVars.join(', ')}`);
                logger.info('💡 웹 대시보드를 사용하려면 .env 파일에서 설정하세요.');
            } else {
                require('./web/server');
                logger.success('✅ 웹 대시보드가 시작되었습니다!');
            }
        }
        
    } catch (error) {
        logger.error(`❌ 시작 중 오류 발생: ${error.message}`);
        process.exit(1);
    }
}

// graceful shutdown 처리
process.on('SIGINT', async () => {
    logger.warn('⚠️ 봇 종료 신호를 받았습니다...');
    
    try {
        // 봇 상태를 오프라인으로 설정
        if (client.user) {
            await client.destroy();
            logger.success('✅ Discord 연결이 정상적으로 종료되었습니다.');
        }
        
        // 프로세스 종료
        process.exit(0);
    } catch (error) {
        logger.error(`❌ 종료 중 오류: ${error.message}`);
        process.exit(1);
    }
});

// 시작
start();

// 모듈 export (웹서버에서 사용)
module.exports = client;