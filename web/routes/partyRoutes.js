const express = require('express');
const router = express.Router();
const dataManager = require('../../utils/dataManager');
const logger = require('../../utils/logger');
const { permissionManager } = require('../utils/permissions');

// 파티 설정
const PARTY_CONFIG = {
    TYPES: {
        mock_battle: { name: '모의전', icon: '❌', teams: 2, maxPerTeam: 5 },
        regular_battle: { name: '정규전', icon: '🔥', teams: 2, maxPerTeam: 5 },
        black_claw: { name: '검은발톱', icon: '⚫', teams: 1, maxPerTeam: 5 },
        pk: { name: 'PK', icon: '⚡', teams: 1, maxPerTeam: 5 },
        raid: { name: '레이드', icon: '👑', teams: 1, maxPerTeam: 5 },
        training: { name: '훈련', icon: '🎯', teams: 2, maxPerTeam: 5 }
    },
    CLASSES: {
        일반: ['방패보병', '폴암보병', '궁기병', '궁수', '창기병'],
        귀족: ['궁기병', '궁수', '창기병']
    }
};

// 파티 생성 페이지
router.get('/create', (req, res) => {
    const partyType = req.query.type || 'regular_battle';
    
    res.render('party/create', {
        partyType: partyType,
        partyTypes: PARTY_CONFIG.TYPES,
        classes: PARTY_CONFIG.CLASSES
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
        const partyConfig = PARTY_CONFIG.TYPES[party.type];
        
        for (let i = 1; i <= partyConfig.teams; i++) {
            teams[i] = party.members.filter(m => m.team === i);
        }
        
        res.render('party/detail', {
            party: party,
            teams: teams,
            userStats: userStats,
            partyConfig: partyConfig,
            classes: PARTY_CONFIG.CLASSES,
            isJoined: party.members.some(m => m.userId === req.user.id)
        });
    } catch (error) {
        logger.error(`파티 상세 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '파티 정보를 불러올 수 없습니다.'
        });
    }
});

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
            createdAt: new Date().toISOString(),
            members: [],
            status: 'recruiting'
        };
        
        await dataManager.write(`party_${partyId}`, party);
        
        // Discord 봇에 알림 전송
        await notifyDiscord(party);
        
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
        const { selectedClass, team } = req.body;
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
        
        // 팀 인원 확인
        const partyConfig = PARTY_CONFIG.TYPES[party.type];
        const teamMembers = party.members.filter(m => m.team === parseInt(team));
        if (teamMembers.length >= partyConfig.maxPerTeam) {
            return res.status(400).json({ success: false, error: '해당 팀이 가득 찼습니다.' });
        }
        
        // 멤버 추가
        party.members.push({
            userId: req.user.id,
            username: req.user.username,
            selectedClass: selectedClass,
            team: parseInt(team),
            joinedAt: new Date().toISOString(),
            stats: userStats
        });
        
        await dataManager.write(`party_${partyId}`, party);
        
        logger.info(`파티 참여: ${req.user.username} -> ${party.title}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 참여 오류: ${error.message}`);
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
        
        logger.info(`파티 나가기: ${req.user.username} <- ${party.title}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`파티 나가기 오류: ${error.message}`);
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

async function notifyDiscord(party) {
    try {
        // Discord 봇에 알림 전송
        const botClient = require('../../index');
        const partyConfig = PARTY_CONFIG.TYPES[party.type];
        
        // 파티 알림 채널 ID는 환경변수에서 가져옴
        const channelId = process.env.PARTY_NOTICE_CHANNEL_ID;
        if (!channelId) return;
        
        const channel = botClient.channels.cache.get(channelId);
        if (!channel) return;
        
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        const embed = new EmbedBuilder()
            .setAuthor({
                name: 'Aimbot.DEV',
                iconURL: 'https://imgur.com/Sd8qK9c.gif'
            })
            .setTitle(`${partyConfig.icon} 새로운 ${partyConfig.name} 파티 모집!`)
            .setDescription(`**${party.title}**\n\n${party.description}`)
            .setColor(0xFF0000)
            .addFields([
                {
                    name: '📅 시작 시간',
                    value: party.startTime,
                    inline: true
                },
                {
                    name: '👥 모집 인원',
                    value: `0/${party.maxMembers}명`,
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
        
        await channel.send({
            embeds: [embed],
            components: [button]
        });
    } catch (error) {
        logger.error(`Discord 알림 전송 오류: ${error.message}`);
    }
}

module.exports = router;