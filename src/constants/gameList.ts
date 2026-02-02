// src/constants/gameList.ts

export type GameType = 'JURUMARBLE' | 'MAFIA' | 'TRUTH';

export interface GameInfo {
  id: GameType;
  title: string;
  description: string;
  icon: string; // 이모지나 이미지 경로
  color: string; // 테마 색상
}

export const GAMES: GameInfo[] = [
  {
    id: 'JURUMARBLE',
    title: '주루마블',
    description: '굴려라 주사위! 마셔라 벌칙! 🎲',
    icon: '🎲',
    color: 'from-yellow-400 to-orange-500',
  },
  {
    id: 'MAFIA',
    title: '라이어/마피아',
    description: '우리 중에 거짓말쟁이가 있다... 🕵️‍♂️',
    icon: '🔫',
    color: 'from-gray-700 to-black',
  },
  {
    id: 'TRUTH',
    title: '진실게임',
    description: 'AI가 분석하는 너의 진심 💓',
    icon: '🤥',
    color: 'from-pink-500 to-rose-600',
  },
];