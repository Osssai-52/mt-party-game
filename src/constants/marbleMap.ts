export type TileType = 'START' | 'PENALTY' | 'LOYALTY_FILL' | 'LOYALTY_DRINK' | 'NORMAL';

export interface MarbleTile {
    id: number;
    type: TileType;
    name: string; 
    image?: string;
    bgColor?: string;
    icon?: string;
}

// 벌칙 이미지 매핑 리스트
const CUSTOM_PENALTY_IMAGES: Record<string, string> = {
    '원샷': '/images/marble/01.원샷.png',
    '한명지목': '/images/marble/02.한명지목.png',
    '휘리릭뽕': '/images/marble/03.휘리릭뽕.png',
    '제로게임': '/images/marble/05.제로게임.png',
    '아파트게임': '/images/marble/06.아파트게임.png',
    '눈치게임': '/images/marble/10.눈치게임.png',
    '안녕클레오파트라': '/images/marble/12.안녕클레오파트라.png',
    '지하철게임': '/images/marble/13.지하철게임.png',
    '무인도': '/images/marble/14.무인도.png',
    '369': '/images/marble/15.369.png',
    '랜덤게임': '/images/marble/16.랜덤게임.png',
    '당근게임': '/images/marble/17.당근게임.png',
    '병뚜껑게임': '/images/marble/18.병뚜껑게임.png',
    '양옆마셔': '/images/marble/23.양옆마셔.png',
    '배스킨라빈스31': '/images/marble/24.배스킨라빈스31.png',
    '홍삼게임': '/images/marble/25.홍삼게임.png',
    '출석부게임': '/images/marble/27.출석부게임.png',
};

// Fixed configuration for special tiles
const SPECIAL_TILES: Record<number, { image: string; fixedName: string; type: TileType; bgColor?: string }> = {
    0: {
        image: '/images/marble/00.START.png',
        fixedName: '출발',
        type: 'START',
        bgColor: 'bg-white'
    },
    7: {
        image: '/images/marble/07.의리주채우기.png',
        fixedName: '의리주 채우기',
        type: 'LOYALTY_FILL',
        bgColor: 'bg-white'
    },
    21: {
        image: '/images/marble/21.의리주마시기.png',
        fixedName: '의리주 마시기',
        type: 'LOYALTY_DRINK',
        bgColor: 'bg-white'
    }
};

export const generateBoard = (penalties: { text: string }[] = []): MarbleTile[] => {
    const board: MarbleTile[] = Array(28).fill(null);
    let penaltyIndex = 0;

    for (let i = 0; i < 28; i++) {
        // 1. Check if it's a special fixed tile
        if (SPECIAL_TILES[i]) {
            const config = SPECIAL_TILES[i];
            board[i] = {
                id: i,
                type: config.type,
                name: config.fixedName,
                image: config.image,
                bgColor: config.bgColor
            };
        } else {
            // 2. Fill with penalty
            const penalty = penalties[penaltyIndex];
            const colors = ['bg-[#FF6B6B]', 'bg-[#4ECDC4]', 'bg-[#FFE66D]', 'bg-[#FF9F43]', 'bg-[#ff9ff3]', 'bg-[#54a0ff]'];

            const penaltyText = penalty ? penalty.text.trim() : '빈 칸';
            let customImage = undefined;

            if (penalty && penaltyText.length >= 2) {
                const matchedKey = Object.keys(CUSTOM_PENALTY_IMAGES).find(key =>
                    key.startsWith(penaltyText)
                );

                if (matchedKey) {
                    customImage = CUSTOM_PENALTY_IMAGES[matchedKey];
                }
            }

            board[i] = {
                id: i,
                type: 'PENALTY',
                name: penaltyText, 
                image: customImage, 
                bgColor: penalty ? colors[i % colors.length] : 'bg-gray-200'
            };

            if (penalty) penaltyIndex++;
        }
    }

    return board;
};