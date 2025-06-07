const express = require('express');
const router = express.Router();
const dataManager = require('../../utils/dataManager');
const logger = require('../../utils/logger');
const { permissionManager } = require('../utils/permissions');
const PARTY_CONFIG = require('./partyConfig');

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
        
        // 사용자 통계 가져오기
        const userStats = await getUserStats(req.user.id);
        
        // 팀별 멤버 정리
        const teams = {};
        const waitingRoom = [];
        const partyConfig = PARTY_CONFIG.TYPES[party.type];
        
        // 팀 초기화
        for (let i = 1; i <= partyConfig.teams; i++) {
            teams[i] = [];
        }
        
        // 멤버 분류 (팀 배정된 멤버 vs 대기실)
        party.members.forEach(member => {
            if (member.team && member.team > 0) {
                teams[member.team].push(member);
            } else {
                waitingRoom.push(member);
            }
        });
        
        // 병과 정보 추가
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
            PARTY_CONFIG: PARTY_CONFIG // 뷰에서 사용할 수 있도록 전달
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
        
        // Discord 봇에 알림 전송
        await notifyDiscord(party, false);
        
        logger.success(`파티 생성: ${title} by ${req.user.username}`);
        res.json({ success: true, partyId: partyId });
    } catch (error) {
        logger.error(`파티 생성 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 파티 참여 API (대기실로 우선 참여)
router.post('/api/join/:partyId', async (req, res) => {
    try {
        const { selectedClass, selectedNation } = req.body;
        const partyId = req.params.partyId;
        
        const party = await dataManager.read(`party_${partyId}`);
        if (!party) {
            return res.status(404).json({ success: false, error: '파티를 찾을 수 없습니다.' });
        }
        
        // 이미 참여했는지 확인
        if (party.members.some(m => m.userId === req.user.id)) {
            return res.status(400).json({ success: false, error: '이미 참여한 파티입니다.' });
        }
        
        // 최소 점수 확인
        const userStats = await getUserStats(req.user.id);
        if (party.minScore && userStats.points < party.minScore) {
            return res.status(400).json({ 
                success: false, 
                error: `최소 ${party.minScore}점이 필요합니다. (현재: ${userStats.points}점)` 
            });
        }
        
        // 병과와 국가 정보 가져오기
        const allClasses = [...PARTY_CONFIG.CLASSES.일반, ...PARTY_CONFIG.CLASSES.귀족];
        const selectedClassInfo = allClasses.find(c => c.id === selectedClass);
        const selectedNationInfo = PARTY_CONFIG.NATIONS.find(n => n.id === selectedNation);
        
        // 대기실로 추가 (팀 번호는 0 또는 null)
        party.members.push({
            userId: req.user.id,
            username: req.user.username,
            selectedClass: selectedClass,
            selectedClassInfo: selectedClassInfo,
            selectedNation: selectedNation,
            selectedNationInfo: selectedNationInfo,
            team: 0, // 대기실
            joinedAt: new Date().toISOString(),
            stats: userStats
        });
        
        await dataManager.write(`party_${partyId}`, party);
        
        // Discord 알림 업데이트
        await notifyDiscord(party, true);
        
        logger.info(`파티 참여 (대기실): ${req.user.username} -> ${party.title}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 참여 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 팀 이동 API (대기실 <-> 팀)
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
        
        // 팀 이동
        const targetTeam = parseInt(team);
        
        if (targetTeam > 0) {
            // 팀으로 이동하는 경우 인원 확인
            const partyConfig = PARTY_CONFIG.TYPES[party.type];
            const teamMembers = party.members.filter(m => m.team === targetTeam);
            if (teamMembers.length >= partyConfig.maxPerTeam) {
                return res.status(400).json({ success: false, error: '해당 팀이 가득 찼습니다.' });
            }
        }
        
        party.members[memberIndex].team = targetTeam;
        await dataManager.write(`party_${partyId}`, party);
        
        // Discord 알림 업데이트
        await notifyDiscord(party, true);
        
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
        
        // Discord 알림 업데이트
        await notifyDiscord(party, true);
        
        logger.info(`파티 나가기: ${req.user.username} <- ${party.title}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 나가기 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 파티 취소 API (개최자만)
router.post('/api/cancel/:partyId', async (req, res) => {
    try {
        const partyId = req.params.partyId;
        
        const party = await dataManager.read(`party_${partyId}`);
        if (!party) {
            return res.status(404).json({ success: false, error: '파티를 찾을 수 없습니다.' });
        }
        
        // 개최자 확인
        if (party.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: '파티 개최자만 취소할 수 있습니다.' });
        }
        
        party.status = 'cancelled';
        party.cancelledAt = new Date().toISOString();
        await dataManager.write(`party_${partyId}`, party);
        
        // Discord 알림에서 취소 표시
        await notifyDiscordCancelled(party);
        
        logger.warn(`파티 취소: ${party.title} by ${req.user.username}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 취소 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 전투 결과 입력 API (관리자용)
router.post('/api/result/:partyId', async (req, res) => {
    try {
        // 관리자 권한 확인
        const userRole = permissionManager.getUserRole(req.user.id);
        if (userRole !== 'admin') {
            return res.status(403).json({ success: false, error: '권한이 없습니다.' });
        }
        
        const { partyId } = req.params;
        const results = req.body;
        
        const party = await dataManager.read(`party_${partyId}`);
        if (!party) {
            return res.status(404).json({ success: false, error: '파티를 찾을 수 없습니다.' });
        }
        
        // 각 멤버의 결과 저장
        for (const result of results) {
            const userData = await dataManager.getUserData(`party_user_${result.userId}`, {
                wins: 0,
                losses: 0,
                totalKills: 0,
                matches: []
            });
            
            if (result.win) {
                userData.wins++;
            } else {
                userData.losses++;
            }
            
            userData.totalKills += result.kills;
            userData.matches.push({
                date: new Date().toLocaleDateString('ko-KR'),
                partyId,
                result: result.win ? '승리' : '패배',
                kills: result.kills
            });
            
            await dataManager.setUserData(`party_user_${result.userId}`, userData);
        }
        
        party.status = 'completed';
        party.completedAt = new Date().toISOString();
        
        await dataManager.write(`party_${partyId}`, party);
        
        logger.success(`전투 결과 저장 완료: ${partyId}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`전투 결과 저장 오류: ${error.message}`);
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

// Discord 알림 전송 함수
async function notifyDiscord(party, isUpdate = false) {
    try {
        // 봇 클라이언트를 통해 알림 전송
        const response = await fetch(`http://localhost:${process.env.WEB_PORT || 3000}/api/party/update/${party.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        logger.error(`Discord 알림 전송 실패: ${error.message}`);
    }
}

// Discord 취소 알림
async function notifyDiscordCancelled(party) {
    try {
        // 취소 알림 전송
        const response = await fetch(`http://localhost:${process.env.WEB_PORT || 3000}/api/party/cancelled/${party.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        logger.error(`Discord 취소 알림 전송 실패: ${error.message}`);
    }
}

module.exports = router;