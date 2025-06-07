// 파티 설정을 별도 파일로 분리
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
        일반: [
            { id: 'shield_infantry', name: '방패보병', icon: '🛡️' },
            { id: 'polearm_infantry', name: '폴암보병', icon: '🗡️' },
            { id: 'archer', name: '궁수', icon: '🏹' },
            { id: 'crossbowman', name: '석궁병', icon: '🎯' },
            { id: 'lancer', name: '창기병', icon: '🐴' },
            { id: 'horse_archer', name: '궁기병', icon: '🏇' }
        ],
        귀족: [
            { id: 'noble_archer', name: '귀족 궁수', icon: '👑🏹' },
            { id: 'noble_lancer', name: '귀족 창기병', icon: '👑🐴' },
            { id: 'noble_horse_archer', name: '귀족 궁기병', icon: '👑🏇' }
        ]
    },
    NATIONS: [
        { id: 'vlandian', name: '블란디아', icon: 'https://static.wikia.nocookie.net/mountandblade/images/c/c4/Vlandia.jpg/revision/latest?cb=20191125150828' },
        { id: 'sturgian', name: '스터지아', icon: 'https://static.wikia.nocookie.net/mountandblade/images/8/88/Sturgia.jpg/revision/latest?cb=20180531054519' },
        { id: 'empire', name: '제국', icon: 'https://static.wikia.nocookie.net/mountandblade/images/7/73/Western_Empire.jpg/revision/latest?cb=20200409234712' },
        { id: 'battanian', name: '바타니아', icon: 'https://static.wikia.nocookie.net/mountandblade/images/e/e8/Battania.jpg/revision/latest?cb=20200409234144' },
        { id: 'khuzait', name: '쿠자이트', icon: 'https://static.wikia.nocookie.net/mountandblade/images/7/72/Khuzait.jpg/revision/latest?cb=20191125155232' },
        { id: 'aserai', name: '아세라이', icon: 'https://static.wikia.nocookie.net/mountandblade/images/a/a1/Aserai.jpg/revision/latest?cb=20191125150553' }
    ]
};

module.exports = PARTY_CONFIG;