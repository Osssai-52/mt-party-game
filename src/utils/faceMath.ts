// 1. 기본 거리 계산
export const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// 2. 표준편차 계산 (데이터가 얼마나 불안정하게 튀는지 확인용)
export const calculateStdDev = (data: number[]) => {
    if (data.length === 0) return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
};

// 3. 눈 깜빡임 비율 (EAR) - 6개 포인트 사용
export const calculateEAR = (landmarks: any[]) => {
    // 왼쪽 눈: 상(159,160) 하(144,145) 좌우(33,133)
    const leftV1 = getDistance(landmarks[159], landmarks[145]);
    const leftV2 = getDistance(landmarks[160], landmarks[144]);
    const leftH = getDistance(landmarks[33], landmarks[133]);
    // 오른쪽 눈: 상(386,385) 하(373,374) 좌우(362,263)
    const rightV1 = getDistance(landmarks[386], landmarks[374]);
    const rightV2 = getDistance(landmarks[385], landmarks[373]);
    const rightH = getDistance(landmarks[362], landmarks[263]);
    return ((leftV1 + leftV2) / (2 * leftH) + (rightV1 + rightV2) / (2 * rightH)) / 2;
};

// 4. 홍채(눈동자) 중심 위치 구하기
export const getIrisPosition = (landmarks: any[]) => {
    return {
        left: landmarks[468],
        right: landmarks[473]
    };
};

// 5. 콧구멍 확장 정도
export const calculateNostrilDilatation = (landmarks: any[]) => {
    const leftNostril = getDistance(landmarks[94], landmarks[98]);
    const rightNostril = getDistance(landmarks[327], landmarks[331]);
    return (leftNostril + rightNostril) / 2;
};

// 6. Blendshape에서 특정 값 가져오기
export const getBlendshapeValue = (blendshapes: any[], name: string): number => {
    if (!blendshapes || blendshapes.length === 0) return 0;
    const categories = blendshapes[0]?.categories;
    if (!categories) return 0;
    const shape = categories.find((c: any) => c.categoryName === name);
    return shape?.score ?? 0;
};

// 7. Blendshape 기반 스트레스 지표 추출
export const extractBlendshapeMetrics = (blendshapes: any[]) => {
    const get = (name: string) => getBlendshapeValue(blendshapes, name);
    return {
        // 눈 깜빡임 (0~1, 높을수록 감은 상태)
        eyeBlinkLeft: get('eyeBlinkLeft'),
        eyeBlinkRight: get('eyeBlinkRight'),
        // 눈 찡그림 (긴장 시 증가)
        eyeSquintLeft: get('eyeSquintLeft'),
        eyeSquintRight: get('eyeSquintRight'),
        // 눈썹 움직임 (긴장/놀람)
        browDownLeft: get('browDownLeft'),
        browDownRight: get('browDownRight'),
        browInnerUp: get('browInnerUp'),
        // 입 긴장 (입술 꽉 다물기)
        mouthPressLeft: get('mouthPressLeft'),
        mouthPressRight: get('mouthPressRight'),
        // 입꼬리 (억지 웃음 감지)
        mouthSmileLeft: get('mouthSmileLeft'),
        mouthSmileRight: get('mouthSmileRight'),
        // 턱 긴장
        jawClench: get('jawClench'),
        jawOpen: get('jawOpen'),
    };
};

// 8. 지수이동평균 (EMA) - 데이터 스무딩
export const ema = (prev: number, current: number, alpha: number = 0.3): number => {
    return alpha * current + (1 - alpha) * prev;
};

// 9. 미세표정 판단 로직
export const determineMicroExpression = (
    blinkRate: number,
    eyeMovement: number,
    tremor: number,
    mouthTension: number = 0,
    browTension: number = 0
) => {
    const score = blinkRate * 0.2 + eyeMovement * 0.25 + tremor * 0.2 + mouthTension * 0.2 + browTension * 0.15;
    if (score > 0.6) return "very_nervous";
    if (score > 0.35) return "nervous";
    if (score < 0.1) return "confident";
    return "neutral";
};
