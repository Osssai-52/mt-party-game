export type QuizPhase = 'TEAM_SETUP' | 'WAITING' | 'PLAYING' | 'ROUND_END' | 'FINISHED';

export interface QuizCategory {
    id: number;
    name: string;
}

export interface QuizState {
    currentWord: string | null;
    remainingSeconds: number;
    score: Record<string, number>; // { "A": 3, "B": 1 }
    currentTeam: string | null;    // 현재 플레이 중인 팀 이름
}