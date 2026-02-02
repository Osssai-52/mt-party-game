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

// 3. 눈 깜빡임 비율 (EAR)
export const calculateEAR = (landmarks: any[]) => {
    const leftEyeV = getDistance(landmarks[159], landmarks[145]);
    const leftEyeH = getDistance(landmarks[33], landmarks[133]);
    const rightEyeV = getDistance(landmarks[386], landmarks[374]);
    const rightEyeH = getDistance(landmarks[362], landmarks[263]);
    return ((leftEyeV / leftEyeH) + (rightEyeV / rightEyeH)) / 2;
};

// 4. 홍채(눈동자) 중심 위치 구하기 (468:왼쪽, 473:오른쪽)
export const getIrisPosition = (landmarks: any[]) => {
    // MediaPipe 최신 모델은 468~477번에 홍채 정보가 있음
    return { 
        left: landmarks[468], 
        right: landmarks[473] 
    };
};

// 5. 콧구멍 확장 정도 (콧볼 넓이)
// 가이드: (94,98) / (327,331) 사용
export const calculateNostrilDilatation = (landmarks: any[]) => {
    const leftNostril = getDistance(landmarks[94], landmarks[98]);
    const rightNostril = getDistance(landmarks[327], landmarks[331]);
    return (leftNostril + rightNostril) / 2;
};

// 6. 미세표정 판단 로직 (프론트에서 계산해서 보냄)
export const determineMicroExpression = (
    blinkRate: number, 
    eyeMovement: number, 
    tremor: number
    ) => {
    // 기준값은 테스트하면서 조금씩 수정해야 해!
    if (blinkRate >= 1 || eyeMovement > 0.02 || tremor > 0.05) return "nervous"; // 긴장
    if (blinkRate === 0 && eyeMovement < 0.005 && tremor < 0.01) return "confident"; // 여유
    return "neutral"; // 평범
};