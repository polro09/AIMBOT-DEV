const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const logger = require('../utils/logger');
const dataManager = require('../utils/dataManager');
const { ROLES, permissionManager, requireAuth, requireRole, checkPagePermission } = require('./utils/permissions');
const os = require('os');
require('dotenv').config();

// 설정
const CONFIG = {
    PORT: process.env.WEB_PORT || 3000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'your-secret-key',
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    CALLBACK_URL: process.env.CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
    BOT_INVITE_URL: process.env.BOT_INVITE_URL || '#',
    ADMIN_IDS: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : []
};

// 설정 확인
if (!CONFIG.CLIENT_ID || !CONFIG.CLIENT_SECRET) {
    logger.error('❌ Discord OAuth2 설정이 없습니다!');
    logger.info('💡 .env 파일에 DISCORD_CLIENT_ID와 DISCORD_CLIENT_SECRET를 설정하세요.');
} else {
    logger.info(`✅ Discord OAuth2 설정 확인: Client ID: ${CONFIG.CLIENT_ID.substring(0, 8)}...`);
    logger.info(`✅ Callback URL: ${CONFIG.CALLBACK_URL}`);
}

// Express 앱 초기화
const app = express();

// 보안 미들웨어
app.use(helmet({
    contentSecurityPolicy: false
}));

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// EJS 및 레이아웃 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    logger.debug(`🌐 ${req.method} ${req.path} - ${req.ip}`);
    next();
});

// 세션 설정 - 메모리 스토어 사용 (파일 권한 문제 해결)
app.use(session({
    store: new MemoryStore({
        checkPeriod: 86400000 // 24시간마다 만료된 세션 정리
    }),
    secret: CONFIG.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    },
    name: 'aimdot.sid'
}));

// Passport 설정
app.use(passport.initialize());
app.use(passport.session());

// Discord OAuth2 전략 설정
passport.use(new DiscordStrategy({
    clientID: CONFIG.CLIENT_ID,
    clientSecret: CONFIG.CLIENT_SECRET,
    callbackURL: CONFIG.CALLBACK_URL,
    scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        if (!profile || !profile.id) {
            logger.error('Discord 프로필 정보가 없습니다');
            return done(new Error('프로필 정보를 가져올 수 없습니다'), null);
        }
        
        const userData = {
            id: profile.id,
            username: profile.username || 'Unknown',
            discriminator: profile.discriminator || '0000',
            avatar: profile.avatar || null,
            accessToken: accessToken,
            refreshToken: refreshToken,
            lastLogin: new Date().toISOString()
        };
        
        await dataManager.setUserData(`web_${profile.id}`, userData);
        logger.info(`🔐 웹 로그인: ${userData.username}#${userData.discriminator} (${userData.id})`);
        
        return done(null, userData);
    } catch (error) {
        logger.error(`OAuth 오류: ${error.stack || error.message || error}`);
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await dataManager.getUserData(`web_${id}`);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// 사용자 역할을 자동으로 설정하는 미들웨어
app.use((req, res, next) => {
    if (req.user) {
        req.userRole = permissionManager.getUserRole(req.user.id);
        res.locals.userRole = req.userRole;
    }
    res.locals.user = req.user;
    next();
});

// 라우트
// 홈페이지
app.get('/', (req, res) => {
    res.render('index');
});

// 로그인 페이지
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        // returnTo가 있으면 그곳으로, 없으면 역할에 따라 리다이렉트
        const returnTo = req.session.returnTo;
        if (returnTo) {
            delete req.session.returnTo;
            return res.redirect(returnTo);
        }
        
        const userRole = permissionManager.getUserRole(req.user.id);
        if (userRole === ROLES.ADMIN) {
            return res.redirect('/dashboard');
        } else if (userRole === ROLES.MEMBER) {
            return res.redirect('/party');
        } else {
            return res.redirect('/');
        }
    }
    res.render('login');
});

// Discord OAuth2 인증 시작
app.get('/auth/discord', (req, res, next) => {
    logger.info('🔐 Discord OAuth2 인증 시작');
    passport.authenticate('discord')(req, res, next);
});

// Discord OAuth2 콜백
app.get('/auth/discord/callback', 
    (req, res, next) => {
        logger.info('🔐 Discord OAuth2 콜백 수신');
        passport.authenticate('discord', { 
            failureRedirect: '/login',
            failureMessage: true 
        })(req, res, next);
    },
    (req, res) => {
        logger.success('🔐 Discord OAuth2 인증 성공');
        const userRole = permissionManager.getUserRole(req.user.id);
        
        // 이전 페이지로 리다이렉트 (세션에 저장된 경우)
        const returnTo = req.session.returnTo;
        if (returnTo) {
            delete req.session.returnTo;
            return res.redirect(returnTo);
        }
        
        // 기본 리다이렉트
        if (userRole === ROLES.ADMIN) {
            res.redirect('/dashboard');
        } else if (userRole === ROLES.MEMBER) {
            res.redirect('/party');
        } else {
            res.redirect('/');
        }
    }
);

// 로그아웃
app.get('/logout', (req, res) => {
    const username = req.user ? req.user.username : 'Unknown';
    req.logout((err) => {
        if (err) {
            logger.error(`로그아웃 오류: ${err.message}`);
        } else {
            logger.info(`🔓 웹 로그아웃: ${username}`);
        }
        res.redirect('/');
    });
});

// 파티 라우트 추가 (멤버 이상 접근 가능)
const partyRoutes = require('./routes/partyRoutes');
app.use('/party', (req, res, next) => {
    // 인증 확인
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    
    // 권한 확인
    const userRole = permissionManager.getUserRole(req.user.id);
    if (!permissionManager.hasPermission(userRole, ROLES.MEMBER)) {
        return res.status(403).render('error', { 
            error: '파티 기능은 멤버 이상만 사용할 수 있습니다.'
        });
    }
    
    next();
}, partyRoutes);

// 서버 목록 페이지 (멤버 이상)
app.get('/servers', requireRole(ROLES.MEMBER), async (req, res) => {
    try {
        const botClient = require('../index');
        
        const guilds = botClient.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ dynamic: true }),
            memberCount: guild.memberCount,
            owner: guild.ownerId,
            createdAt: guild.createdAt,
            joinedAt: guild.joinedAt
        }));
        
        res.render('servers', { 
            guilds: guilds
        });
    } catch (error) {
        logger.error(`서버 목록 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 대시보드 (관리자 전용)
app.get('/dashboard', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const stats = await dataManager.getStats();
        const userStats = permissionManager.getStats();
        
        const botClient = require('../index');
        
        const guilds = botClient.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ dynamic: true }),
            memberCount: guild.memberCount,
            owner: guild.ownerId,
            createdAt: guild.createdAt,
            joinedAt: guild.joinedAt,
            boostLevel: guild.premiumTier,
            boostCount: guild.premiumSubscriptionCount
        }));
        
        const logs = logger.getHistory(null, 50);
        
        res.render('dashboard', { 
            stats: stats,
            userStats: userStats,
            guilds: guilds,
            botStatus: {
                online: botClient.ws.status === 0,
                uptime: process.uptime(),
                ping: botClient.ws.ping,
                guildCount: botClient.guilds.cache.size,
                userCount: botClient.users.cache.size
            },
            logs: logs
        });
    } catch (error) {
        logger.error(`대시보드 오류: ${error.message}`);
        res.render('error', { 
            error: '데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 권한 관리 페이지
app.get('/admin/permissions', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const users = await permissionManager.getAllUsers();
        const pagePermissions = permissionManager.permissions.pagePermissions;
        
        res.render('admin/permissions', { 
            users: users,
            pagePermissions: pagePermissions,
            roles: ROLES
        });
    } catch (error) {
        logger.error(`권한 관리 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 파티 관리 페이지 (관리자 전용)
app.get('/admin/party', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const fs = require('fs').promises;
        const files = await fs.readdir(path.join(process.cwd(), 'data'));
        const completedParties = [];
        const battleHistory = [];
        
        for (const file of files) {
            if (file.startsWith('party_') && file.endsWith('.json')) {
                const party = await dataManager.read(file.replace('.json', ''));
                if (party) {
                    const partyConfig = {
                        mock_battle: { name: '모의전', icon: '❌' },
                        regular_battle: { name: '정규전', icon: '🔥' },
                        black_claw: { name: '검은발톱', icon: '⚫' },
                        pk: { name: 'PK', icon: '⚡' },
                        raid: { name: '레이드', icon: '👑' },
                        training: { name: '훈련', icon: '🎯' }
                    }[party.type];
                    
                    party.icon = partyConfig?.icon || '⚔️';
                    party.typeName = partyConfig?.name || '기타';
                    
                    if (party.status === 'recruiting' && new Date(party.startTime) < new Date()) {
                        completedParties.push(party);
                    } else if (party.status === 'completed') {
                        battleHistory.push({
                            ...party,
                            memberCount: party.members.length
                        });
                    }
                }
            }
        }
        
        battleHistory.sort((a, b) => new Date(b.completedAt || b.startTime) - new Date(a.completedAt || a.startTime));
        
        res.render('party/admin', {
            completedParties: completedParties,
            battleHistory: battleHistory.slice(0, 20)
        });
    } catch (error) {
        logger.error(`파티 관리 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// API 라우트
// 파티 업데이트 알림 API (Discord 봇용)
app.post('/api/party/update/:partyId', async (req, res) => {
    try {
        const partyId = req.params.partyId;
        const party = await dataManager.read(`party_${partyId}`);
        
        if (!party) {
            return res.status(404).json({ success: false, error: '파티를 찾을 수 없습니다.' });
        }
        
        // Discord 봇에 알림 전송
        const botClient = require('../index');
        const channelId = process.env.PARTY_NOTICE_CHANNEL_ID;
        
        if (channelId) {
            const channel = botClient.channels.cache.get(channelId);
            if (channel) {
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                
                const partyConfig = {
                    mock_battle: { name: '모의전', icon: '❌' },
                    regular_battle: { name: '정규전', icon: '🔥' },
                    black_claw: { name: '검은발톱', icon: '⚫' },
                    pk: { name: 'PK', icon: '⚡' },
                    raid: { name: '레이드', icon: '👑' },
                    training: { name: '훈련', icon: '🎯' }
                }[party.type];
                
                // 팀별 멤버 정리
                const teams = {};
                const waitingRoom = [];
                
                party.members.forEach(member => {
                    if (member.team && member.team > 0) {
                        if (!teams[member.team]) teams[member.team] = [];
                        teams[member.team].push(member);
                    } else {
                        waitingRoom.push(member);
                    }
                });
                
                // 팀 구성 텍스트
                let teamText = '';
                if (Object.keys(teams).length > 0) {
                    for (const [teamNum, members] of Object.entries(teams)) {
                        teamText += `**${teamNum}팀**: ${members.map(m => m.username).join(', ') || '없음'}\n`;
                    }
                }
                
                if (waitingRoom.length > 0) {
                    teamText += `**대기실**: ${waitingRoom.map(m => m.username).join(', ')}\n`;
                }
                
                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: 'Aimbot.DEV',
                        iconURL: 'https://imgur.com/Sd8qK9c.gif'
                    })
                    .setTitle(`${partyConfig.icon} ${party.title}`)
                    .setDescription(`**${party.description}**\n\n${teamText || '참가자가 없습니다.'}`)
                    .setColor(0xFF0000)
                    .addFields([
                        {
                            name: '📅 시작 시간',
                            value: new Date(party.startTime).toLocaleString('ko-KR'),
                            inline: true
                        },
                        {
                            name: '👥 모집 인원',
                            value: `${party.members.length}/${party.maxMembers}명`,
                            inline: true
                        },
                        {
                            name: '🎯 참가 조건',
                            value: party.requirements || '제한 없음',
                            inline: true
                        }
                    ])
                    .setThumbnail('https://i.imgur.com/6G5xYJJ.png')
                    .setFooter({
                        text: '🔺DEUS VULT',
                        iconURL: channel.guild.iconURL({ dynamic: true })
                    })
                    .setTimestamp();
                
                const button = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('파티 참여하기')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`${process.env.WEB_URL || 'http://localhost:3000'}/party/${party.id}`)
                            .setEmoji('🔗')
                    );
                
                // 기존 메시지 찾아서 업데이트 또는 새로 생성
                const messages = await channel.messages.fetch({ limit: 20 });
                const existingMessage = messages.find(m => 
                    m.author.id === botClient.user.id && 
                    m.embeds.length > 0 && 
                    m.embeds[0].title?.includes(party.title)
                );
                
                if (existingMessage) {
                    await existingMessage.edit({
                        embeds: [embed],
                        components: [button]
                    });
                } else {
                    await channel.send({
                        embeds: [embed],
                        components: [button]
                    });
                }
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 업데이트 알림 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 사용자 권한 업데이트
app.post('/api/admin/permissions/user', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { userId, role } = req.body;
        
        if (!userId || !role) {
            return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
        }
        
        await permissionManager.setUserRole(userId, role);
        logger.info(`👤 권한 변경: ${userId} -> ${role} (by ${req.user.username})`);
        
        res.json({ 
            success: true, 
            message: `권한이 ${role}로 변경되었습니다.` 
        });
    } catch (error) {
        logger.error(`권한 업데이트 오류: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 페이지 권한 업데이트
app.post('/api/admin/permissions/page', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { path, role } = req.body;
        
        if (!path || !role) {
            return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
        }
        
        await permissionManager.setPagePermission(path, role);
        logger.info(`📄 페이지 권한 변경: ${path} -> ${role} (by ${req.user.username})`);
        
        res.json({ 
            success: true, 
            message: `페이지 권한이 변경되었습니다.` 
        });
    } catch (error) {
        logger.error(`페이지 권한 업데이트 오류: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 봇 제어 API
app.post('/api/bot/control', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { action } = req.body;
        
        switch(action) {
            case 'stop':
                logger.warn(`⚠️ 웹 대시보드에서 봇 종료 요청: ${req.user.username}`);
                res.json({ success: true, message: '봇을 종료합니다...' });
                
                setTimeout(() => {
                    logger.system('🛑 봇 종료 신호 수신');
                    process.kill(process.pid, 'SIGINT');
                }, 500);
                break;
                
            case 'restart':
                logger.warn(`⚠️ 웹 대시보드에서 봇 재시작 요청: ${req.user.username}`);
                res.json({ success: true, message: '봇을 재시작합니다...' });
                
                setTimeout(() => {
                    logger.system('🔄 봇 재시작 신호 수신');
                    process.exit(0);
                }, 500);
                break;
                
            default:
                res.status(400).json({ success: false, message: '잘못된 액션입니다.' });
        }
    } catch (error) {
        logger.error(`봇 제어 오류: ${error.message}`);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 실시간 로그 API
app.get('/api/logs', requireRole(ROLES.ADMIN), (req, res) => {
    try {
        const logs = logger.getHistory(null, 100);
        res.json(logs);
    } catch (error) {
        logger.error(`로그 조회 오류: ${error.message}`);
        res.status(500).json({ error: '로그를 불러올 수 없습니다.' });
    }
});

// 봇 상태 API
app.get('/api/bot/status', requireAuth, async (req, res) => {
    try {
        const botClient = require('../index');
        const botStatus = {
            online: botClient.ws.status === 0,
            guilds: botClient.guilds.cache.size,
            users: botClient.users.cache.size,
            uptime: process.uptime()
        };
        
        res.json(botStatus);
    } catch (error) {
        logger.error(`봇 상태 API 오류: ${error.message}`);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 파티 상세 정보 API
app.get('/party/api/details/:partyId', requireAuth, async (req, res) => {
    try {
        const party = await dataManager.read(`party_${req.params.partyId}`);
        if (!party) {
            return res.status(404).json({ error: '파티를 찾을 수 없습니다.' });
        }
        res.json(party);
    } catch (error) {
        logger.error(`파티 상세 정보 오류: ${error.message}`);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 404 처리
app.use((req, res) => {
    res.status(404).render('error', { 
        error: '페이지를 찾을 수 없습니다.'
    });
});

// 에러 처리 - 중복 응답 방지
app.use((err, req, res, next) => {
    logger.error(`서버 오류: ${err.stack || err.message || err}`);
    
    // 이미 응답이 전송된 경우 무시
    if (res.headersSent) {
        return next(err);
    }
    
    res.status(500).render('error', { 
        error: '서버 오류가 발생했습니다.'
    });
});

// 서버 시작
async function startWebServer() {
    await permissionManager.loadPermissions();
    
    const server = app.listen(CONFIG.PORT, () => {
        logger.separator();
        logger.system(`🌐 웹 대시보드가 시작되었습니다!`);
        logger.separator();
        
        const networkInterfaces = os.networkInterfaces();
        const addresses = [];
        
        for (const [name, interfaces] of Object.entries(networkInterfaces)) {
            for (const interface of interfaces) {
                if (interface.family === 'IPv4' && !interface.internal) {
                    addresses.push(interface.address);
                }
            }
        }
        
        logger.info(`📍 로컬 주소: http://localhost:${CONFIG.PORT}`);
        logger.info(`📍 로컬 주소: http://127.0.0.1:${CONFIG.PORT}`);
        
        if (addresses.length > 0) {
            addresses.forEach(address => {
                logger.info(`📍 네트워크 주소: http://${address}:${CONFIG.PORT}`);
            });
        }
        
        logger.separator();
        logger.success(`✅ 웹 대시보드 준비 완료!`);
        logger.info(`💡 팁: Ctrl+클릭으로 브라우저에서 바로 열 수 있습니다.`);
        logger.separator();
        
        let requestCount = 0;
        app.use((req, res, next) => {
            requestCount++;
            next();
        });
        
        setInterval(() => {
            logger.debug(`📊 웹 서버 상태: 요청 수 ${requestCount}회, 가동 시간 ${Math.floor(process.uptime() / 60)}분`);
        }, 60000);
    });
    
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            logger.error(`❌ 포트 ${CONFIG.PORT}이(가) 이미 사용 중입니다.`);
            logger.info(`💡 다른 포트를 사용하려면 .env 파일에서 WEB_PORT를 변경하세요.`);
        } else {
            logger.error(`❌ 웹 서버 오류: ${error.message}`);
        }
    });
    
    return server;
}

module.exports = { app, startWebServer };