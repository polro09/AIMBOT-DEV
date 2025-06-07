const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { createEmbed, successEmbed, errorEmbed } = require('../utils/embedBuilder');
const logger = require('../utils/logger');
const dataManager = require('../utils/dataManager');

// 설정 (상단에서 쉽게 수정 가능)
const CONFIG = {
    // 채널 ID
    CHANNEL_IDS: {
        partyList: '1234567890', // 파티 목록이 표시될 채널
        partyNotice: '0987654321' // 파티 알림 채널
    },
    
    // 역할 ID
    ROLE_IDS: {
        member: '1357924680',
        noble: '2468013579', // 귀족 역할
        admin: '9876543210'
    },
    
    // 병과 설정
    CLASSES: {
        일반: ['방패보병', '폴암보병', '궁기병', '궁수', '창기병'],
        귀족: ['궁기병', '궁수', '창기병']
    },
    
    // 파티 타입별 최대 인원
    PARTY_LIMITS: {
        모의전: { teams: 2, maxPerTeam: 5 },
        정규전: { teams: 2, maxPerTeam: 5 },
        훈련: { teams: 2, maxPerTeam: 5 },
        레이드: { teams: 1, maxPerTeam: 5 },
        PK: { teams: 1, maxPerTeam: 5 },
        검은발톱: { teams: 1, maxPerTeam: 5 }
    },
    
    // 점수 설정
    POINTS: {
        win: 100,
        lose: 50,
        killPerPoint: 1
    },
    
    // 기타 설정
    PREFIX: '!',
    WEB_URL: process.env.WEB_URL || 'http://localhost:3000',
    API_KEY: process.env.PARTY_API_KEY || 'your-api-key'
};

// 모듈 정보
module.exports = {
    name: 'party',
    description: '파티 모집 시스템',
    version: '1.0.0',
    author: 'aimdot.dev',
    
    // 모듈 초기화
    async init(client) {
        logger.module(`${this.name} 모듈이 초기화되었습니다.`);
        
        // 메시지 이벤트 리스너 등록
        client.on('messageCreate', (message) => this.handleMessage(message, client));
        
        // 인터랙션 이벤트 리스너 등록
        client.on('interactionCreate', (interaction) => this.handleInteraction(interaction, client));
        
        // 웹 API 이벤트 처리 (웹서버와 연동)
        this.initWebAPI(client);
    },
    
    // 메시지 처리
    async handleMessage(message, client) {
        if (message.author.bot) return;
        
        if (message.content === '!파티모집') {
            await this.showPartyMenu(message, client);
        }
    },
    
    // 파티 모집 메뉴 표시
    async showPartyMenu(message, client) {
        try {
            // 사용자 통계 가져오기
            const userStats = await this.getUserStats(message.author.id);
            
            const embed = createEmbed({
                title: '⚔️ 파티 모집 타입 선택',
                description: '아래 드롭다운 메뉴에서 모집할 파티 타입을 선택해주세요.',
                color: 0xFF0000,
                guild: message.guild,
                fields: [
                    {
                        name: '❌ 모의전',
                        value: '클랜원들끼리 진행하는 연습 경기',
                        inline: true
                    },
                    {
                        name: '🔥 정규전',
                        value: '적대 클랜원과의 경쟁',
                        inline: true
                    },
                    {
                        name: '⚫ 검은발톱',
                        value: '검은 발톱 퀘스트',
                        inline: true
                    },
                    {
                        name: '⚡ PK',
                        value: '적대 클랜원 공격',
                        inline: true
                    },
                    {
                        name: '👑 레이드',
                        value: '북부 및 사막 보스 레이드',
                        inline: true
                    },
                    {
                        name: '🎯 훈련',
                        value: '투창, 마장 등 병과기 훈련',
                        inline: true
                    },
                    {
                        name: '📊 내 정보',
                        value: `점수: ${userStats.points} | 승률: ${userStats.winRate}% | 평균 킬: ${userStats.avgKills}`,
                        inline: false
                    }
                ],
                thumbnail: 'https://i.imgur.com/6G5xYJJ.png' // 파티 아이콘
            });
            
            // 파티 타입 선택 드롭다운
            const typeSelect = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('party_type_select')
                        .setPlaceholder('파티 타입을 선택하세요')
                        .addOptions([
                            {
                                label: '모의전',
                                description: '클랜원들끼리 진행하는 연습 경기',
                                value: 'mock_battle',
                                emoji: '❌'
                            },
                            {
                                label: '정규전',
                                description: '적대 클랜원과의 경쟁',
                                value: 'regular_battle',
                                emoji: '🔥'
                            },
                            {
                                label: '검은발톱',
                                description: '검은 발톱 퀘스트',
                                value: 'black_claw',
                                emoji: '⚫'
                            },
                            {
                                label: 'PK',
                                description: '적대 클랜원 공격',
                                value: 'pk',
                                emoji: '⚡'
                            },
                            {
                                label: '레이드',
                                description: '보스 레이드',
                                value: 'raid',
                                emoji: '👑'
                            },
                            {
                                label: '훈련',
                                description: '병과기 훈련',
                                value: 'training',
                                emoji: '🎯'
                            }
                        ])
                );
            
            // 버튼 액션
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('웹에서 파티 만들기')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`${CONFIG.WEB_URL}/party/create`)
                        .setEmoji('🌐'),
                    new ButtonBuilder()
                        .setCustomId('party_list')
                        .setLabel('모집 중인 파티 보기')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📋'),
                    new ButtonBuilder()
                        .setCustomId('party_my_stats')
                        .setLabel('내 상세 정보')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊')
                );
            
            await message.reply({
                embeds: [embed],
                components: [typeSelect, buttons]
            });
            
            logger.success(`파티 모집 메뉴 실행: ${message.author.tag}`);
        } catch (error) {
            logger.error(`파티 모집 메뉴 오류: ${error.message}`);
            await message.reply({ embeds: [errorEmbed('❌ 오류 발생', '파티 모집 메뉴를 표시할 수 없습니다.', { guild: message.guild })] });
        }
    },
    
    // 인터랙션 처리
    async handleInteraction(interaction, client) {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'party_type_select') {
                await this.handlePartyTypeSelect(interaction, client);
            }
        }
        
        if (interaction.isButton()) {
            if (interaction.customId === 'party_list') {
                await this.showPartyList(interaction, client);
            } else if (interaction.customId === 'party_my_stats') {
                await this.showDetailedStats(interaction, client);
            } else if (interaction.customId.startsWith('party_join_')) {
                await this.handlePartyJoin(interaction, client);
            }
        }
    },
    
    // 파티 타입 선택 처리
    async handlePartyTypeSelect(interaction, client) {
        await interaction.deferUpdate();
        
        const partyType = interaction.values[0];
        const typeNames = {
            'mock_battle': '모의전',
            'regular_battle': '정규전',
            'black_claw': '검은발톱',
            'pk': 'PK',
            'raid': '레이드',
            'training': '훈련'
        };
        
        const embed = createEmbed({
            title: `⚔️ ${typeNames[partyType]} 파티 생성`,
            description: `**${typeNames[partyType]}** 파티를 생성하려면 아래 버튼을 클릭하세요.\n\n웹 페이지에서 상세 설정을 할 수 있습니다.`,
            color: 0xFF0000,
            guild: interaction.guild,
            fields: [
                {
                    name: '📝 필요 정보',
                    value: '• 파티 제목\n• 시작 시간\n• 참가 조건\n• 상세 설명',
                    inline: true
                },
                {
                    name: '⚙️ 설정 가능 항목',
                    value: '• 팀 구성 (1팀/2팀)\n• 최대 인원\n• 병과 제한\n• 최소 점수',
                    inline: true
                }
            ]
        });
        
        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('파티 생성하기')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${CONFIG.WEB_URL}/party/create?type=${partyType}`)
                    .setEmoji('🌐')
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [button]
        });
    },
    
    // 모집 중인 파티 목록 표시
    async showPartyList(interaction, client) {
        await interaction.deferUpdate();
        
        try {
            const parties = await this.getActiveParties();
            
            if (parties.length === 0) {
                const embed = createEmbed({
                    title: '📋 모집 중인 파티',
                    description: '현재 모집 중인 파티가 없습니다.',
                    color: 0xFF0000,
                    guild: interaction.guild
                });
                
                await interaction.editReply({ embeds: [embed], components: [] });
                return;
            }
            
            const embed = createEmbed({
                title: '📋 모집 중인 파티 목록',
                description: '참여하고 싶은 파티의 링크를 클릭하세요.',
                color: 0xFF0000,
                guild: interaction.guild,
                fields: parties.map(party => ({
                    name: `${party.icon} ${party.title}`,
                    value: `타입: **${party.type}** | 인원: **${party.currentMembers}/${party.maxMembers}**\n시작: ${party.startTime}\n[🔗 참여하기](${CONFIG.WEB_URL}/party/${party.id})`,
                    inline: true
                }))
            });
            
            await interaction.editReply({ embeds: [embed], components: [] });
        } catch (error) {
            logger.error(`파티 목록 조회 오류: ${error.message}`);
        }
    },
    
    // 상세 통계 표시
    async showDetailedStats(interaction, client) {
        await interaction.deferUpdate();
        
        try {
            const userId = interaction.user.id;
            const stats = await this.getUserDetailedStats(userId);
            
            const embed = createEmbed({
                title: '📊 상세 전적 정보',
                description: `<@${userId}>님의 전투 기록`,
                color: 0xFF0000,
                guild: interaction.guild,
                fields: [
                    {
                        name: '🏆 총 점수',
                        value: `**${stats.points}**점`,
                        inline: true
                    },
                    {
                        name: '⚔️ 전투 수',
                        value: `**${stats.totalGames}**판`,
                        inline: true
                    },
                    {
                        name: '📈 승률',
                        value: `**${stats.winRate}%**`,
                        inline: true
                    },
                    {
                        name: '✅ 승리',
                        value: `**${stats.wins}**승`,
                        inline: true
                    },
                    {
                        name: '❌ 패배',
                        value: `**${stats.losses}**패`,
                        inline: true
                    },
                    {
                        name: '💀 평균 킬',
                        value: `**${stats.avgKills}**킬`,
                        inline: true
                    },
                    {
                        name: '🎯 총 킬수',
                        value: `**${stats.totalKills}**킬`,
                        inline: true
                    },
                    {
                        name: '🏅 랭킹',
                        value: `**${stats.ranking}**위`,
                        inline: true
                    },
                    {
                        name: '📅 최근 전투',
                        value: stats.recentMatches || '기록 없음',
                        inline: false
                    }
                ],
                thumbnail: interaction.user.displayAvatarURL({ dynamic: true })
            });
            
            await interaction.editReply({ embeds: [embed], components: [] });
        } catch (error) {
            logger.error(`상세 통계 조회 오류: ${error.message}`);
        }
    },
    
    // 웹 API 초기화
    initWebAPI(client) {
        // 웹 서버의 API 엔드포인트 추가
        try {
            const { app } = require('../web/server');
            
            if (!app) {
                logger.warn('웹 서버가 초기화되지 않았습니다.');
                return;
            }
            
            // 파티 생성 웹훅
            app.post('/api/party/create', this.authMiddleware, async (req, res) => {
                try {
                    const partyData = req.body;
                    const party = await this.createParty(partyData, client);
                    
                    res.json({ success: true, partyId: party.id });
                } catch (error) {
                    logger.error(`파티 생성 API 오류: ${error.message}`);
                    res.status(500).json({ success: false, error: error.message });
                }
            });
            
            // 파티 참여 API
            app.post('/api/party/join/:partyId', this.authMiddleware, async (req, res) => {
                try {
                    const { partyId } = req.params;
                    const { userId, selectedClass, team } = req.body;
                    
                    const result = await this.joinParty(partyId, userId, selectedClass, team);
                    res.json(result);
                } catch (error) {
                    logger.error(`파티 참여 API 오류: ${error.message}`);
                    res.status(500).json({ success: false, error: error.message });
                }
            });
            
            // 전투 결과 입력 API (관리자)
            app.post('/api/party/result/:partyId', this.authMiddleware, async (req, res) => {
                try {
                    const { partyId } = req.params;
                    const results = req.body;
                    
                    await this.saveMatchResults(partyId, results);
                    res.json({ success: true });
                } catch (error) {
                    logger.error(`전투 결과 저장 오류: ${error.message}`);
                    res.status(500).json({ success: false, error: error.message });
                }
            });
        } catch (error) {
            logger.warn(`웹 API 초기화 건너뜀: ${error.message}`);
        }
    },
    
    // API 인증 미들웨어
    authMiddleware(req, res, next) {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== CONFIG.API_KEY) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        next();
    },
    
    // 파티 생성
    async createParty(partyData, client) {
        const partyId = Date.now().toString();
        const party = {
            id: partyId,
            ...partyData,
            createdAt: new Date().toISOString(),
            members: [],
            status: 'recruiting'
        };
        
        // 파티 데이터 저장
        await dataManager.write(`party_${partyId}`, party);
        
        // Discord 채널에 알림
        const channel = client.channels.cache.get(CONFIG.CHANNEL_IDS.partyNotice);
        if (channel) {
            const embed = createEmbed({
                title: `⚔️ 새로운 ${party.type} 파티 모집!`,
                description: `**${party.title}**\n\n${party.description}`,
                color: 0xFF0000,
                guild: channel.guild,
                fields: [
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
                ],
                thumbnail: 'https://i.imgur.com/6G5xYJJ.png'
            });
            
            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('파티 참여하기')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`${CONFIG.WEB_URL}/party/${partyId}`)
                        .setEmoji('🔗')
                );
            
            await channel.send({
                content: '@everyone',
                embeds: [embed],
                components: [button]
            });
        }
        
        logger.success(`새 파티 생성: ${party.title} (${partyId})`);
        return party;
    },
    
    // 사용자 통계 가져오기
    async getUserStats(userId) {
        const userData = await dataManager.getUserData(`party_user_${userId}`, {
            wins: 0,
            losses: 0,
            totalKills: 0,
            matches: []
        });
        
        const totalGames = userData.wins + userData.losses;
        const winRate = totalGames > 0 ? Math.round((userData.wins / totalGames) * 100) : 0;
        const avgKills = totalGames > 0 ? (userData.totalKills / totalGames).toFixed(1) : 0;
        const points = (userData.wins * CONFIG.POINTS.win) + (userData.losses * CONFIG.POINTS.lose) + (userData.totalKills * CONFIG.POINTS.killPerPoint);
        
        return {
            points,
            winRate,
            avgKills,
            totalGames
        };
    },
    
    // 상세 통계 가져오기
    async getUserDetailedStats(userId) {
        const userData = await dataManager.getUserData(`party_user_${userId}`, {
            wins: 0,
            losses: 0,
            totalKills: 0,
            matches: []
        });
        
        const totalGames = userData.wins + userData.losses;
        const winRate = totalGames > 0 ? Math.round((userData.wins / totalGames) * 100) : 0;
        const avgKills = totalGames > 0 ? (userData.totalKills / totalGames).toFixed(1) : 0;
        const points = (userData.wins * CONFIG.POINTS.win) + (userData.losses * CONFIG.POINTS.lose) + (userData.totalKills * CONFIG.POINTS.killPerPoint);
        
        // 최근 5경기
        const recentMatches = userData.matches.slice(-5).reverse().map(match => 
            `${match.date} - ${match.result} (${match.kills}킬)`
        ).join('\n');
        
        // 랭킹 계산 (실제로는 모든 유저와 비교해야 함)
        const ranking = await this.calculateRanking(userId, points);
        
        return {
            points,
            totalGames,
            winRate,
            wins: userData.wins,
            losses: userData.losses,
            avgKills,
            totalKills: userData.totalKills,
            ranking,
            recentMatches: recentMatches || '기록 없음'
        };
    },
    
    // 활성 파티 목록 가져오기
    async getActiveParties() {
        // 실제로는 데이터베이스에서 가져와야 함
        return [
            {
                id: '1',
                icon: '⚔️',
                title: '정규전 5vs5',
                type: '정규전',
                currentMembers: 3,
                maxMembers: 10,
                startTime: '오후 9:00'
            }
        ];
    },
    
    // 랭킹 계산
    async calculateRanking(userId, userPoints) {
        // 실제로는 모든 유저의 점수를 비교해야 함
        return 1;
    },
    
    // 파티 참여
    async joinParty(partyId, userId, selectedClass, team) {
        const party = await dataManager.read(`party_${partyId}`);
        if (!party) {
            throw new Error('파티를 찾을 수 없습니다.');
        }
        
        // 이미 참여했는지 확인
        if (party.members.some(m => m.userId === userId)) {
            return { success: false, error: '이미 참여한 파티입니다.' };
        }
        
        // 인원 확인
        const teamMembers = party.members.filter(m => m.team === team);
        if (teamMembers.length >= CONFIG.PARTY_LIMITS[party.type].maxPerTeam) {
            return { success: false, error: '해당 팀이 가득 찼습니다.' };
        }
        
        // 멤버 추가
        party.members.push({
            userId,
            selectedClass,
            team,
            joinedAt: new Date().toISOString()
        });
        
        await dataManager.write(`party_${partyId}`, party);
        
        return { success: true };
    },
    
    // 전투 결과 저장
    async saveMatchResults(partyId, results) {
        const party = await dataManager.read(`party_${partyId}`);
        if (!party) {
            throw new Error('파티를 찾을 수 없습니다.');
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
        await dataManager.write(`party_${partyId}`, party);
        
        logger.success(`전투 결과 저장 완료: ${partyId}`);
    },
    
    // 모듈 실행
    async execute(client) {
        // 이벤트 기반이므로 비워둠
    }
};