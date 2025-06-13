// ========================================
// web/routes/partyRoutes.js
// ========================================
const express = require('express');
const router = express.Router();
const dataManager = require('../../utils/dataManager');
const logger = require('../../utils/logger');
const eventBus = require('../../utils/eventBus');
const { permissionManager } = require('../utils/permissions');
const PARTY_CONFIG = require('./partyConfig');

// Discord 알림 전송 함수 (EventBus 사용)
async function notifyDiscord(party, action = 'update') {
    try {
        eventBus.safeEmit(`party:${action}`, party);
        logger.debug(`파티 이벤트 발행: party:${action} - ${party.id}`);
    } catch (error) {
        logger.error(`Discord 알림 전송 실패: ${error.message}`);
    }
}

// 파티 목록 페이지
router.get('/', async (req, res) => {
    try {
        const parties = await getActiveParties();
        const userStats = await getUserStats(req.user.id);
        
        res.render('party/list', {
            parties: parties,
            userStats: userStats,
            partyTypes: PARTY_CONFIG.TYPES
        });
    } catch (error) {
        logger.error(`파티 목록 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '파티 목록을 불러올 수 없습니다.'
        });
    }
});

// 파티 생성 페이지
router.get('/create', (req, res) => {
    const partyType = req.query.type || 'regular_battle';
    
    res.render('party/create', {
        partyType: partyType,
        partyTypes: PARTY_CONFIG.TYPES,
        classes: PARTY_CONFIG.CLASSES,
        nations: PARTY_CONFIG.NATIONS
    });
});

// 파티 상세 페이지
router.get('/:partyId', async (req, res) => {
    try {
        const party = await dataManager.read(`party_${req.params.partyId}`);
        
        if (!party) {
            return res.render('error', { 
                error: '파티를 찾을 수 없습니다.'
            });
        }
        
        const userStats = await getUserStats(req.user.id);
        
        const teams = {};
        const waitingRoom = [];
        const partyConfig = PARTY_CONFIG.TYPES[party.type];
        
        for (let i = 1; i <= partyConfig.teams; i++) {
            teams[i] = [];
        }
        
        party.members.forEach(member => {
            if (member.team && member.team > 0) {
                teams[member.team].push(member);
            } else {
                waitingRoom.push(member);
            }
        });
        
        const allClasses = [...PARTY_CONFIG.CLASSES.일반, ...PARTY_CONFIG.CLASSES.귀족];
        
        res.render('party/detail', {
            party: party,
            teams: teams,
            waitingRoom: waitingRoom,
            userStats: userStats,
            partyConfig: partyConfig,
            classes: PARTY_CONFIG.CLASSES,
            nations: PARTY_CONFIG.NATIONS,
            allClasses: allClasses,
            isJoined: party.members.some(m => m.userId === req.user.id),
            isCreator: party.createdBy === req.user.id,
            PARTY_CONFIG: PARTY_CONFIG
        });
    } catch (error) {
        logger.error(`파티 상세 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '파티 정보를 불러올 수 없습니다.'
        });
    }
});

// 파티 생성 API
router.post('/api/create', async (req, res) => {
    try {
        const {
            type,
            title,
            description,
            startTime,
            requirements,
            minScore
        } = req.body;
        
        const partyConfig = PARTY_CONFIG.TYPES[type];
        if (!partyConfig) {
            return res.status(400).json({ success: false, error: '잘못된 파티 타입입니다.' });
        }
        
        const partyId = Date.now().toString();
        const party = {
            id: partyId,
            type: type,
            title: title,
            description: description,
            startTime: startTime,
            requirements: requirements,
            minScore: parseInt(minScore) || 0,
            maxMembers: partyConfig.teams * partyConfig.maxPerTeam,
            createdBy: req.user.id,
            createdByName: req.user.username,
            createdAt: new Date().toISOString(),
            members: [],
            status: 'recruiting'
        };
        
        await dataManager.write(`party_${partyId}`, party);
        
        // EventBus를 통한 알림
        await notifyDiscord(party, 'created');
        
        logger.success(`파티 생성: ${title} by ${req.user.username}`);
        res.json({ success: true, partyId: partyId });
    } catch (error) {
        logger.error(`파티 생성 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 파티 참여 API
router.post('/api/join/:partyId', async (req, res) => {
    try {
        const { selectedClass, selectedNation } = req.body;
        const partyId = req.params.partyId;
        
        const party = await dataManager.read(`party_${partyId}`);
        if (!party) {
            return res.status(404).json({ success: false, error: '파티를 찾을 수 없습니다.' });
        }
        
        if (party.members.some(m => m.userId === req.user.id)) {
            return res.status(400).json({ success: false, error: '이미 참여한 파티입니다.' });
        }
        
        const userStats = await getUserStats(req.user.id);
        
        if (party.minScore && userStats.points < party.minScore) {
            return res.status(400).json({ 
                success: false, 
                error: `최소 ${party.minScore}점이 필요합니다. (현재: ${userStats.points}점)` 
            });
        }
        
        const allClasses = [...PARTY_CONFIG.CLASSES.일반, ...PARTY_CONFIG.CLASSES.귀족];
        const selectedClassInfo = allClasses.find(c => c.id === selectedClass);
        const selectedNationInfo = PARTY_CONFIG.NATIONS.find(n => n.id === selectedNation);
        
        party.members.push({
            userId: req.user.id,
            username: req.user.username,
            selectedClass: selectedClass,
            selectedClassInfo: selectedClassInfo,
            selectedNation: selectedNation,
            selectedNationInfo: selectedNationInfo,
            team: 0,
            joinedAt: new Date().toISOString(),
            stats: userStats
        });
        
        await dataManager.write(`party_${partyId}`, party);
        await notifyDiscord(party, 'updated');
        
        logger.info(`파티 참여: ${req.user.username} -> ${party.title}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 참여 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 팀 이동 API
router.post('/api/move/:partyId', async (req, res) => {
    try {
        const { team } = req.body;
        const partyId = req.params.partyId;
        
        const party = await dataManager.read(`party_${partyId}`);
        if (!party) {
            return res.status(404).json({ success: false, error: '파티를 찾을 수 없습니다.' });
        }
        
        const memberIndex = party.members.findIndex(m => m.userId === req.user.id);
        if (memberIndex === -1) {
            return res.status(400).json({ success: false, error: '파티에 참여하지 않았습니다.' });
        }
        
        const targetTeam = parseInt(team);
        
        if (targetTeam > 0) {
            const partyConfig = PARTY_CONFIG.TYPES[party.type];
            const teamMembers = party.members.filter(m => m.team === targetTeam);
            if (teamMembers.length >= partyConfig.maxPerTeam) {
                return res.status(400).json({ success: false, error: '해당 팀이 가득 찼습니다.' });
            }
        }
        
        party.members[memberIndex].team = targetTeam;
        await dataManager.write(`party_${partyId}`, party);
        
        await notifyDiscord(party, 'updated');
        
        logger.info(`팀 이동: ${req.user.username} -> 팀 ${targetTeam}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`팀 이동 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 파티 나가기 API
router.post('/api/leave/:partyId', async (req, res) => {
    try {
        const partyId = req.params.partyId;
        
        const party = await dataManager.read(`party_${partyId}`);
        if (!party) {
            return res.status(404).json({ success: false, error: '파티를 찾을 수 없습니다.' });
        }
        
        party.members = party.members.filter(m => m.userId !== req.user.id);
        await dataManager.write(`party_${partyId}`, party);
        
        await notifyDiscord(party, 'updated');
        
        logger.info(`파티 나가기: ${req.user.username} <- ${party.title}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 나가기 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 파티 취소 API
router.post('/api/cancel/:partyId', async (req, res) => {
    try {
        const partyId = req.params.partyId;
        const party = await dataManager.read(`party_${partyId}`);
        
        if (!party) {
            return res.status(404).json({ success: false, error: '파티를 찾을 수 없습니다.' });
        }
        
        if (party.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: '파티 개최자만 취소할 수 있습니다.' });
        }
        
        party.status = 'cancelled';
        party.cancelledAt = new Date().toISOString();
        await dataManager.write(`party_${partyId}`, party);
        
        await notifyDiscord(party, 'cancelled');
        
        logger.warn(`파티 취소: ${party.title} by ${req.user.username}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 취소 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 헬퍼 함수들
async function getUserStats(userId) {
    const userData = await dataManager.getUserData(`party_user_${userId}`, {
        wins: 0,
        losses: 0,
        totalKills: 0,
        matches: []
    });
    
    const totalGames = userData.wins + userData.losses;
    const winRate = totalGames > 0 ? Math.round((userData.wins / totalGames) * 100) : 0;
    const avgKills = totalGames > 0 ? (userData.totalKills / totalGames).toFixed(1) : 0;
    const points = (userData.wins * 100) + (userData.losses * 50) + userData.totalKills;
    
    return {
        points,
        winRate,
        avgKills,
        totalGames,
        wins: userData.wins,
        losses: userData.losses,
        totalKills: userData.totalKills
    };
}

async function getActiveParties() {
    const files = await require('fs').promises.readdir(require('path').join(process.cwd(), 'data'));
    const parties = [];
    
    for (const file of files) {
        if (file.startsWith('party_') && file.endsWith('.json')) {
            const party = await dataManager.read(file.replace('.json', ''));
            if (party && party.status === 'recruiting') {
                const partyConfig = PARTY_CONFIG.TYPES[party.type];
                parties.push({
                    ...party,
                    icon: partyConfig.icon,
                    typeName: partyConfig.name,
                    currentMembers: party.members.length
                });
            }
        }
    }
    
    return parties.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = router;