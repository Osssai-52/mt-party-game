export type TruthPhase = 
    | 'SELECT_ANSWERER'  // 답변자 선정
    | 'SUBMIT_QUESTIONS' // 질문 제출
    | 'SELECT_QUESTION'  // 질문 선택 (랜덤/확정)
    | 'ANSWERING'        // 답변 중 (얼굴 분석 & HUD 가동)
    | 'RESULT'           // 판정 결과 (진실/거짓)
    | 'END';             // 게임 종료

export interface TruthAnswerer {
    deviceId: string;
    nickname: string;
    profileImage?: string | null;
}

export interface TruthQuestion {
    id: number;
    content: string;
}

export interface FaceAnalysisData {
    eyeBlinkRate: number;    // 눈 깜빡임
    eyeMovement: number;     // 동공 지진
    facialTremor: number;    // 안면 떨림
    nostrilMovement: number; // 콧구멍 벌렁임
    stressLevel: number;     // 종합 스트레스 지수 (0~100)
    isLie: boolean;          // 거짓말 여부 (스트레스 55 이상)
}