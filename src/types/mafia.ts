export type MafiaRole = 'MAFIA' | 'DOCTOR' | 'POLICE' | 'CIVILIAN';
export type MafiaPhase = 
    | 'NIGHT' 
    | 'DAY_ANNOUNCEMENT' 
    | 'DAY_DISCUSSION' 
    | 'VOTE' 
    | 'VOTE_RESULT' 
    | 'FINAL_DEFENSE' 
    | 'FINAL_VOTE' 
    | 'FINAL_VOTE_RESULT' 
    | 'END';

export interface MafiaPlayer {
    deviceId: string;
    nickname: string;
    role?: MafiaRole; 
    isAlive: boolean;
    profileImage?: string | null;
}

export interface MafiaState {
    phase: MafiaPhase;
    timer: number;
    survivors: number;
    mafias: number;
    winner?: 'MAFIA' | 'CITIZEN' | null;
}
