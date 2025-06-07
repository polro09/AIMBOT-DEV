const dataManager = require('../../utils/dataManager');
const logger = require('../../utils/logger');

// 권한 레벨
const ROLES = {
    GUEST: 'guest',      // 권한 없음 (홈만 접속 가능)
    MEMBER: 'member',    // 일반 멤버
    ADMIN: 'admin'       // 관리자
};

// 페이지별 필요 권한
const PAGE_PERMISSIONS = {
    '/': ROLES.GUEST,
    '/dashboard': ROLES.ADMIN,
    '/admin/permissions': ROLES.ADMIN,
    '/admin/party': ROLES.ADMIN,
    '/servers': ROLES.MEMBER,
    '/party': ROLES.MEMBER,
    '/party/create': ROLES.MEMBER,
    '/logs': ROLES.ADMIN,
    '/settings': ROLES.MEMBER
};

class PermissionManager {
    constructor() {
        this.loadPermissions();
    }
    
    // 권한 설정 로드
    async loadPermissions() {
        try {
            const permissions = await dataManager.read('web_permissions');
            if (permissions) {
                this.permissions = permissions;
            } else {
                // 기본 권한 설정
                this.permissions = {
                    pagePermissions: PAGE_PERMISSIONS,
                    userRoles: {},
                    createdAt: new Date().toISOString()
                };
                await this.savePermissions();
            }
        } catch (error) {
            logger.error(`권한 로드 오류: ${error.message}`);
            this.permissions = {
                pagePermissions: PAGE_PERMISSIONS,
                userRoles: {}
            };
        }
    }
    
    // 권한 저장
    async savePermissions() {
        try {
            await dataManager.write('web_permissions', this.permissions);
            logger.info('✅ 권한 설정 저장됨');
        } catch (error) {
            logger.error(`권한 저장 오류: ${error.message}`);
        }
    }
    
    // 사용자 역할 가져오기
    getUserRole(userId) {
        // 환경변수에 설정된 관리자는 항상 ADMIN
        const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
        if (adminIds.includes(userId)) {
            return ROLES.ADMIN;
        }
        
        return this.permissions.userRoles[userId] || ROLES.GUEST;
    }
    
    // 사용자 역할 설정
    async setUserRole(userId, role) {
        if (!Object.values(ROLES).includes(role)) {
            throw new Error('잘못된 역할입니다.');
        }
        
        this.permissions.userRoles[userId] = role;
        await this.savePermissions();
        logger.info(`👤 사용자 권한 변경: ${userId} -> ${role}`);
    }
    
    // 페이지 접근 권한 확인
    canAccessPage(userId, path) {
        const userRole = this.getUserRole(userId);
        const requiredRole = this.permissions.pagePermissions[path] || ROLES.MEMBER;
        
        return this.hasPermission(userRole, requiredRole);
    }
    
    // 권한 레벨 비교
    hasPermission(userRole, requiredRole) {
        const roleLevel = {
            [ROLES.GUEST]: 0,
            [ROLES.MEMBER]: 1,
            [ROLES.ADMIN]: 2
        };
        
        return roleLevel[userRole] >= roleLevel[requiredRole];
    }
    
    // 페이지 권한 설정
    async setPagePermission(path, role) {
        if (!Object.values(ROLES).includes(role)) {
            throw new Error('잘못된 역할입니다.');
        }
        
        this.permissions.pagePermissions[path] = role;
        await this.savePermissions();
        logger.info(`📄 페이지 권한 변경: ${path} -> ${role}`);
    }
    
    // 모든 사용자 목록 가져오기
    async getAllUsers() {
        const users = [];
        const files = await require('fs').promises.readdir(require('path').join(process.cwd(), 'data'));
        
        for (const file of files) {
            if (file.startsWith('web_user_') && file.endsWith('.json')) {
                const userId = file.replace('web_user_', '').replace('.json', '');
                const userData = await dataManager.getUserData(`web_${userId}`);
                if (userData) {
                    users.push({
                        ...userData,
                        role: this.getUserRole(userData.id)
                    });
                }
            }
        }
        
        return users;
    }
    
    // 통계
    getStats() {
        const userRoles = this.permissions.userRoles;
        const stats = {
            total: Object.keys(userRoles).length,
            admins: Object.values(userRoles).filter(role => role === ROLES.ADMIN).length,
            members: Object.values(userRoles).filter(role => role === ROLES.MEMBER).length,
            guests: Object.values(userRoles).filter(role => role === ROLES.GUEST).length
        };
        
        return stats;
    }
}

// 싱글톤 인스턴스
const permissionManager = new PermissionManager();

// 미들웨어 함수들
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    // 현재 URL을 세션에 저장
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            // 현재 URL을 세션에 저장
            req.session.returnTo = req.originalUrl;
            return res.redirect('/login');
        }
        
        const userRole = permissionManager.getUserRole(req.user.id);
        if (permissionManager.hasPermission(userRole, role)) {
            req.userRole = userRole;
            return next();
        }
        
        res.status(403).render('error', { 
            error: '접근 권한이 없습니다.',
            user: req.user,
            userRole: userRole
        });
    };
}

function checkPagePermission(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    
    const userRole = permissionManager.getUserRole(req.user.id);
    req.userRole = userRole;
    
    if (permissionManager.canAccessPage(req.user.id, req.path)) {
        return next();
    }
    
    res.status(403).render('error', { 
        error: '이 페이지에 접근할 권한이 없습니다.',
        user: req.user 
    });
}

module.exports = {
    ROLES,
    permissionManager,
    requireAuth,
    requireRole,
    checkPagePermission
};