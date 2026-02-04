import api from './api';

// 1. 데이터 타입 정의
export interface JoinRoomReq {
    roomId: string; 
    nickname: string;
}

export interface ReactionReq {
    roomId: string;
    type: 'FIREWORK' | 'BOO' | 'ANGRY';
}

// 2. API 함수 모음 (최신 명세서 + SSE 로직 반영)
export const gameApi = {
    // [방 관리]
    room: {
        create: () => api.post('/rooms'),
        get: (roomId: string) => api.get(`/rooms/${roomId}`),
        join: (data: JoinRoomReq) => api.post('/rooms/join', data),
    },

    // 🎲 주루마블
    marble: {
        // [Phase 1] 벌칙 제출
        submitPenalty: (roomId: string, text: string, deviceId: string) =>
            api.post('/games/marble/penalty/submit', { roomId, text, deviceId }),

        getPenaltyStatus: (roomId: string) => 
            api.get(`/games/marble/penalty/status/${roomId}`),

        // [Phase 2] 벌칙 투표
        getVotePenalties: (roomId: string) => 
            api.get(`/games/marble/vote/penalties/${roomId}`),

        vote: (roomId: string, penaltyId: string | number) => 
            api.post('/games/marble/vote', { roomId, penaltyId }),

        getVoteStatus: (roomId: string) => 
            api.get(`/games/marble/vote/status/${roomId}`),

        finishVote: (roomId: string) => 
            api.post('/games/marble/vote/finish', { roomId }),

        // [Phase 3] 게임판 생성
        init: (roomId: string) => 
            api.post('/games/marble/init', { roomId }),

        // [Phase 4] 게임 진행
        rollDice: (roomId: string, deviceId: string) => 
            api.post('/games/marble/roll', { roomId, deviceId }),

        getState: (roomId: string) => 
            api.get(`/games/marble/state/${roomId}`),

        end: (roomId: string) => 
            api.post('/games/marble/end', { roomId }),
    },

    // [팀 관리]
    team: {
        divideRandom: (roomId: string, teamCount: number) =>
            api.post('/teams/random', { roomId, teamCount }),

        // 사다리타기 팀 배정
        divideLadder: (roomId: string, teamCount: number) =>
            api.post('/teams/ladder', { roomId, teamCount }),

        // 수동 팀 선택
        selectTeam: (roomId: string, deviceId: string, teamName: string) =>
            api.post('/teams/select', { roomId, deviceId, teamName }),

        // 팀 초기화 및 상태 조회
        resetTeams: (roomId: string) =>
            api.post('/teams/reset', { roomId }),

        getTeamStatus: (roomId: string) =>
            api.get(`/teams/status/${roomId}`),
    },

    // [공통 기능]
    common: {
        sendReaction: (data: ReactionReq) => api.post('/games/reaction', data),
        changePhase: (roomId: string, phase: string) => 
            api.post('/phase/change', { roomId, phase }),
    },

    mafia: {
        // 게임 시작
        init: (roomId: string) => 
            api.post('/games/mafia/init', { roomId }),

        // 내 역할 확인 (플레이어용)
        getRole: (roomId: string, deviceId: string) => 
            api.get(`/games/mafia/role?roomId=${roomId}&deviceId=${deviceId}`),

        // [NIGHT] 행동
        chat: (roomId: string, deviceId: string, message: string) => 
            api.post('/games/mafia/chat', { roomId, deviceId, message }),
            
        getChat: (roomId: string) => 
            api.get(`/games/mafia/chat?roomId=${roomId}`),

        kill: (roomId: string, deviceId: string, targetId: string) => 
            api.post('/games/mafia/kill', { roomId, deviceId, targetId }),

        save: (roomId: string, deviceId: string, targetId: string) => 
            api.post('/games/mafia/save', { roomId, deviceId, targetId }),

        investigate: (roomId: string, deviceId: string, targetId: string) => 
            api.post('/games/mafia/investigate', { roomId, deviceId, targetId }),

        // [DAY/VOTE] 행동
        vote: (roomId: string, deviceId: string, voteTo: string) => 
            api.post('/games/mafia/vote', { roomId, deviceId, voteTo }),

        finalVote: (roomId: string, deviceId: string, agree: boolean) => 
            api.post('/games/mafia/final-vote', { roomId, deviceId, agree }),

        // 상태 조회
        getAlivePlayers: (roomId: string) => 
            api.get(`/games/mafia/alive/${roomId}`),
    },

    truth: {
        init: (roomId: string) => api.post('/games/truth/init', { roomId }),

        // 답변자 관련
        selectAnswererRandom: (roomId: string) => api.post('/games/truth/answerer/random', { roomId }),
        selectAnswerer: (roomId: string, answererDeviceId: string) => api.post('/games/truth/answerer/select', { roomId, answererDeviceId }),
        getAnswerer: (roomId: string) => api.get(`/games/truth/answerer/${roomId}`),

        // 질문 관련
        submitQuestion: (roomId: string, deviceId: string, question: string) => api.post('/games/truth/question/submit', { roomId, deviceId, question }),
        getQuestionCount: (roomId: string) => api.get(`/games/truth/question/count/${roomId}`),
        finishQuestionSubmit: (roomId: string) => api.post('/games/truth/question/finish', { roomId }),
        selectQuestion: (roomId: string) => api.post('/games/truth/question/select', { roomId }),
        confirmQuestion: (roomId: string) => api.post('/games/truth/question/confirm', { roomId }),

        // 얼굴 데이터 & 결과
        sendFaceData: (roomId: string, deviceId: string, data: any) => api.post('/games/truth/face-tracking', { roomId, deviceId, data }),
        finishAnswering: (roomId: string) => api.post('/games/truth/finish-answering', { roomId }),

        // 진행
        nextRound: (roomId: string) => api.post('/games/truth/next-round', { roomId }),
        end: (roomId: string) => api.post('/games/truth/end', { roomId }),
    },

    // 몸으로 말해요 / 고요 속의 외침
    quiz: {
        getCategories: () => api.get('/games/quiz/categories'),
        init: (roomId: string) => api.post('/games/quiz/init', { roomId }),
        startRound: (roomId: string, categoryId: number) => api.post('/games/quiz/start', { roomId, categoryId }),
        correct: (roomId: string) => api.post('/games/quiz/correct', { roomId }),
        pass: (roomId: string) => api.post('/games/quiz/pass', { roomId }),
        endRound: (roomId: string) => api.post('/games/quiz/end-round', { roomId }),
        nextTeam: (roomId: string) => api.post('/games/quiz/next-team', { roomId }),
        endGame: (roomId: string) => api.post('/games/quiz/end', { roomId }),
        getRanking: (roomId: string) => api.get(`/games/quiz/ranking/${roomId}`),
        getState: (roomId: string) => api.get(`/games/quiz/state/${roomId}`),
        getCurrentWord: (roomId: string) => api.get(`/games/quiz/current-word/${roomId}`),
    },

    // 라이어 게임
    liar: {
        getCategories: () => api.get('/games/liar/categories'),
        init: (roomId: string, categoryId: number) => api.post('/games/liar/init', { roomId, categoryId }),
        getRole: (roomId: string, deviceId: string) => api.get(`/games/liar/role?roomId=${roomId}&deviceId=${deviceId}`),
        voteMore: (roomId: string, deviceId: string, wantMore: boolean) => api.post('/games/liar/vote-more', { roomId, deviceId, wantMore }),
        getState: (roomId: string) => api.get(`/games/liar/state/${roomId}`),
    }
};

export default gameApi;