const express = require('express');
const session = require('express-session');
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
    ADMIN_IDS: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [] // 콤마로 구분된 관리자 ID 목록
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

// 세션 설정
app.use(session({
    secret: CONFIG.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
        sameSite: 'lax'
    },
    name: 'aimdot.sid' // 세션 쿠키 이름
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
        // 프로필 확인
        if (!profile || !profile.id) {
            logger.error('Discord 프로필 정보가 없습니다');
            return done(new Error('프로필 정보를 가져올 수 없습니다'), null);
        }
        
        // 사용자 정보 저장
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

// 인증 미들웨어 (삭제 - permissions.js에서 가져옴)

// 라우트
// 홈페이지
app.get('/', (req, res) => {
    const userRole = req.user ? permissionManager.getUserRole(req.user.id) : null;
    res.render('index', { 
        user: req.user,
        userRole: userRole
    });
});

// 로그인 페이지
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        const userRole = permissionManager.getUserRole(req.user.id);
        if (userRole === ROLES.ADMIN) {
            return res.redirect('/dashboard');
        } else if (userRole === ROLES.MEMBER) {
            return res.redirect('/servers');
        } else {
            return res.redirect('/');
        }
    }
    res.render('login', { user: null });
});

// Discord OAuth2 인증 시작
app.get('/auth/discord', (req, res, next) => {
    logger.info('🔐 Discord OAuth2 인증 시작');
    passport.authenticate('discord')(req, res, next);
});

// Discord OAuth2 인증 (성공 후 리다이렉트)
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
        
        // 사용자 권한 확인
        const userRole = permissionManager.getUserRole(req.user.id);
        
        // 권한에 따라 리다이렉트
        if (userRole === ROLES.ADMIN) {
            res.redirect('/dashboard');
        } else if (userRole === ROLES.MEMBER) {
            res.redirect('/servers');
        } else {
            res.redirect('/'); // 게스트는 홈으로
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

// 대시보드 (관리자 전용)
app.get('/dashboard', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const stats = await dataManager.getStats();
        const userStats = permissionManager.getStats();
        
        // 봇 클라이언트 가져오기
        const botClient = require('../index');
        
        // 서버 정보 가져오기
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
        
        // 로그 기록 가져오기
        const logs = logger.getHistory(null, 50); // 최근 50개 로그
        
        res.render('dashboard', { 
            user: req.user,
            userRole: req.userRole,
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
            error: '데이터를 불러오는 중 오류가 발생했습니다.',
            user: req.user 
        });
    }
});

// 관리자 페이지 - 권한 관리
app.get('/admin/permissions', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const users = await permissionManager.getAllUsers();
        const pagePermissions = permissionManager.permissions.pagePermissions;
        
        res.render('admin/permissions', { 
            user: req.user,
            userRole: req.userRole,
            users: users,
            pagePermissions: pagePermissions,
            roles: ROLES
        });
    } catch (error) {
        logger.error(`권한 관리 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '데이터를 불러오는 중 오류가 발생했습니다.',
            user: req.user 
        });
    }
});

// API 라우트
// 사용자 권한 업데이트 (관리자 전용)
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

// 페이지 권한 업데이트 (관리자 전용)
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

// 봇 제어 API (관리자 전용)
app.post('/api/bot/control', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { action } = req.body;
        
        switch(action) {
            case 'stop':
                logger.warn(`⚠️ 웹 대시보드에서 봇 종료 요청: ${req.user.username}`);
                res.json({ success: true, message: '봇을 종료합니다...' });
                
                // PM2를 사용하는 경우 graceful shutdown
                setTimeout(() => {
                    logger.system('🛑 봇 종료 신호 수신');
                    process.kill(process.pid, 'SIGINT');
                }, 500);
                break;
                
            case 'restart':
                logger.warn(`⚠️ 웹 대시보드에서 봇 재시작 요청: ${req.user.username}`);
                res.json({ success: true, message: '봇을 재시작합니다...' });
                
                // PM2가 자동으로 재시작하도록 프로세스 종료
                setTimeout(() => {
                    logger.system('🔄 봇 재시작 신호 수신');
                    process.exit(0); // PM2가 감지하고 자동 재시작
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

// 권한 업데이트 (관리자 전용) - 이전 버전 (제거됨)

// 봇 상태 API
app.get('/api/bot/status', requireAuth, async (req, res) => {
    try {
        // 여기에 봇 상태 확인 로직 추가
        const botStatus = {
            online: true, // 실제로는 봇 클라이언트에서 가져와야 함
            guilds: 0,
            users: 0,
            uptime: process.uptime()
        };
        
        res.json(botStatus);
    } catch (error) {
        logger.error(`봇 상태 API 오류: ${error.message}`);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 404 처리
app.use((req, res) => {
    res.status(404).render('error', { 
        error: '페이지를 찾을 수 없습니다.',
        user: req.user 
    });
});

// 에러 처리
app.use((err, req, res, next) => {
    logger.error(`서버 오류: ${err.stack || err.message || err}`);
    res.status(500).render('error', { 
        error: '서버 오류가 발생했습니다.',
        user: req.user 
    });
});

// 서버 시작
async function startWebServer() {
    // 권한 시스템 초기화
    await permissionManager.loadPermissions();
    
    const server = app.listen(CONFIG.PORT, () => {
        logger.separator();
        logger.system(`🌐 웹 대시보드가 시작되었습니다!`);
        logger.separator();
        
        // 네트워크 인터페이스 가져오기
        const networkInterfaces = os.networkInterfaces();
        const addresses = [];
        
        // 모든 네트워크 인터페이스 확인
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
        
        // 웹 서버 통계 로깅
        let requestCount = 0;
        app.use((req, res, next) => {
            requestCount++;
            next();
        });
        
        // 1분마다 웹 서버 상태 출력
        setInterval(() => {
            logger.debug(`📊 웹 서버 상태: 요청 수 ${requestCount}회, 가동 시간 ${Math.floor(process.uptime() / 60)}분`);
        }, 60000);
    });
    
    // 웹 서버 에러 처리
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