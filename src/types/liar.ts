export type LiarPhase = 
    | 'LOBBY'             // 대기
    | 'ROLE_REVEAL'       // 역할 공개 (30초)
    | 'EXPLANATION'       // 제시어 설명 (턴제)
    | 'VOTE_MORE_ROUND'   // 추가 라운드 투표 (15초)
    | 'POINTING'          // 라이어 지목 (무제한)
    | 'GAME_END';         // 결과 공개

export interface LiarPlayer {
    deviceId: string;
    nickname: string;
    isLiar?: boolean;     // 내 화면에서만 확인 가능 (또는 결과 공개 시)
    profileImage?: string | null;
}

export interface LiarState {
    phase: LiarPhase;
    timerSec: number;
    keyword: string | null;     // 설정에 따라 호스트는 모를 수도 있음 
    categoryName: string;
    currentExplainerIndex: number;
    roundCount: number;
    voteStatus: { agree: number; disagree: number }; // 추가 라운드 찬반 현황
    liarName?: string;          // 결과 공개용
    liarKeyword?: string;       // 결과 공개용
}