// src/constants/gameList.ts

export type GameType = 'JURUMARBLE' | 'MAFIA' | 'TRUTH' | 'SPEED_QUIZ' | 'LIAR';

export interface GameInfo {
  id: GameType;
  title: string;
  description: string;
  icon: string; 
  color: string; 
}

export const GAMES: GameInfo[] = [
  {
    id: 'JURUMARBLE',
    title: '주루마블',
    description: 'DICE in your area 🎲',
    icon: '🎲',
    color: 'from-yellow-400 to-orange-500',
  },
  {
    id: 'MAFIA',
    title: '마피아게임',
    description: 'MAFIA in your area 🕵️‍♂️',
    icon: '🔫',
    color: 'from-red-600 to-black',
  },
  {
    id: 'TRUTH',
    title: '진실게임',
    description: 'NO LIE in your area 👀',
    icon: '🤫',
    color: 'from-pink-500 to-rose-600',
  },
  {
    id: 'SPEED_QUIZ',
    title: '몸으로 말해요\n고요 속의 외침',
    description: 'QUIZ in your area 📢',
    icon: '🙆‍♂️',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    id: 'LIAR', 
    title: '라이어 게임',
    description: 'LIAR in your area 🤥',
    icon: '🦜',
    color: 'from-green-500 to-emerald-700', 
  },
];