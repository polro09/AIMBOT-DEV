// ========================================
// web/utils/permissions.js
// ========================================
const dataManager = require('../../utils/dataManager');
const logger = require('../../utils/logger');

// 권한 레벨
const ROLES = {
    GUEST: 'guest',
    MEMBER: 'member',
    ADMIN: 'admin'
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
    
    async loadPermissions() {
        try {
            const permissions = await dataManager.read('web_permissions');
            if (permissions) {
                this.permissions = permissions;
            } else {
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
    
    async savePermissions() {
        try {
            await dataManager.write('web_permissions', this.permissions);
            logger.info('✅ 권한 설정 저장됨');
        } catch (error) {
            logger.error(`권한 저장 오류: ${error.message}`);
        }
    }
    
    getUserRole(userId) {
        const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
        if (adminIds.includes(userId)) {
            return ROLES.ADMIN;
        }
        
        return this.permissions.userRoles[userId] || ROLES.GUEST;
    }
    
    async setUserRole(userId, role) {
        if (!Object.values(ROLES).includes(role)) {
            throw new Error('잘못된 역할입니다.');
        }
        
        this.permissions.userRoles[userId] = role;
        await this.savePermissions();
        logger.info(`📝 사용자 권한 변경: ${userId} -> ${role}`);
    }
    
    hasPermission(userRole, requiredRole) {
        const roleHierarchy = {
            [ROLES.GUEST]: 0,
            [ROLES.MEMBER]: 1,
            [ROLES.ADMIN]: 2
        };
        
        return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
    }
    
    canAccessPage(userId, path) {
        const userRole = this.getUserRole(userId);
        const requiredRole = this.permissions.pagePermissions[path] || ROLES.GUEST;
        
        return this.hasPermission(userRole, requiredRole);
    }
    
    async setPagePermission(path, role) {
        if (!Object.values(ROLES).includes(role)) {
            throw new Error('잘못된 역할입니다.');
        }
        
        this.permissions.pagePermissions[path] = role;
        await this.savePermissions();
        logger.info(`📄 페이지 권한 변경: ${path} -> ${role}`);
    }
    
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
        req.userRole = permissionManager.getUserRole(req.user.id);
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            req.session.returnTo = req.originalUrl;
            return res.redirect('/login');
        }
        
        const userRole = permissionManager.getUserRole(req.user.id);
        req.userRole = userRole;
        
        if (permissionManager.hasPermission(userRole, role)) {
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
        user: req.user,
        userRole: userRole
    });
}

module.exports = {
    ROLES,
    permissionManager,
    requireAuth,
    requireRole,
    checkPagePermission
};