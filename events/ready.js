// ========================================
// events/ready.js
// ========================================
const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    
    async execute(client) {
        logger.banner('AIMDOT.DEV BOT', require('chalk').cyan);
        logger.separator();
        
        logger.system(`🤖 봇 로그인: ${client.user.tag}`);
        logger.info(`📊 서버 수: ${client.guilds.cache.size}`);
        logger.info(`👥 전체 유저 수: ${client.users.cache.size}`);
        logger.info(`📺 채널 수: ${client.channels.cache.size}`);
        
        logger.separator();
        
        // 봇 상태 설정
        const activities = [
            { name: 'aimdot.dev | 🔺DEUS VULT', type: 'WATCHING' },
            { name: `${client.guilds.cache.size}개의 서버`, type: 'WATCHING' },
            { name: `${client.users.cache.size}명의 유저`, type: 'WATCHING' }
        ];
        
        let activityIndex = 0;
        
        // 초기 상태 설정
        client.user.setPresence({
            activities: [activities[0]],
            status: 'online'
        });
        
        // 10초마다 상태 변경
        setInterval(() => {
            activityIndex = (activityIndex + 1) % activities.length;
            client.user.setPresence({
                activities: [activities[activityIndex]],
                status: 'online'
            });
        }, 10000);
        
        logger.success('✅ 봇이 성공적으로 시작되었습니다!');
        logger.separator();
    }
};