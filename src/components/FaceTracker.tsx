'use client';

import { useEffect, useRef } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import gameApi from '../services/gameApi';
import {
    calculateEAR,
    getDistance,
    getIrisPosition,
    calculateNostrilDilatation,
    calculateStdDev,
    extractBlendshapeMetrics,
    ema,
} from '../utils/faceMath';
import { FaceAnalysisData } from '../types/truth';

interface FaceTrackerProps {
    roomId: string;
    targetDeviceId: string;
    onStatusChange?: (msg: string) => void;
    onAnalyze?: (data: FaceAnalysisData) => void;
}

export default function FaceTracker({ roomId, targetDeviceId, onStatusChange, onAnalyze }: FaceTrackerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastTimeRef = useRef<number>(-1);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);

    // 1초 동안 데이터를 쌓아둘 통계 창고
    const statsRef = useRef({
        blinks: 0,
        isEyeClosed: false,
        irisMovements: [] as number[],
        headMovements: [] as number[],
        nostrilSizes: [] as number[],
        lastIris: null as any,
        lastNose: null as any,
        // Blendshape 기반 추가 지표
        eyeSquints: [] as number[],
        mouthPresses: [] as number[],
        browTensions: [] as number[],
        jawClenches: [] as number[],
    });

    // Baseline (처음 3초간 평균을 기준선으로 사용)
    const baselineRef = useRef({
        collected: false,
        sampleCount: 0,
        blinkRate: 0,
        irisStdDev: 0,
        headTremor: 0,
        nostrilStdDev: 0,
        eyeSquint: 0,
        mouthPress: 0,
        browTension: 0,
        // 임시 수집용
        samples: {
            blinks: 0,
            irisMovements: [] as number[],
            headMovements: [] as number[],
            nostrilSizes: [] as number[],
            eyeSquints: [] as number[],
            mouthPresses: [] as number[],
            browTensions: [] as number[],
        }
    });

    // EMA 스무딩된 최종 값
    const smoothedRef = useRef({
        stressLevel: 0,
        eyeMovement: 0,
        facialTremor: 0,
        nostrilMovement: 0,
        eyeBlinkRate: 0,
    });

    useEffect(() => {
        const setupFaceMesh = async () => {
            onStatusChange?.("AI 모델 로딩 중...");
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });
            startCamera();
        };
        setupFaceMesh();
    }, []);

    const startCamera = async () => {
        if (!videoRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: "user" }
            });
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            onStatusChange?.("기준선 측정 중... 자연스럽게 정면을 봐주세요");
        } catch (err) {
            console.error(err);
            onStatusChange?.("카메라 권한 필요 📷");
        }
    };

    const predictWebcam = () => {
        const video = videoRef.current;
        const landmarker = faceLandmarkerRef.current;

        if (video && landmarker) {
            let startTimeMs = performance.now();
            if (lastTimeRef.current !== video.currentTime) {
                lastTimeRef.current = video.currentTime;
                const results = landmarker.detectForVideo(video, startTimeMs);

                if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                    const landmarks = results.faceLandmarks[0];
                    const stats = statsRef.current;

                    // === Landmark 기반 분석 ===

                    // 1. 눈 깜빡임 (EAR 기반)
                    const ear = calculateEAR(landmarks);
                    if (ear < 0.22) {
                        if (!stats.isEyeClosed) {
                            stats.blinks += 1;
                            stats.isEyeClosed = true;
                        }
                    } else if (ear > 0.28) {
                        stats.isEyeClosed = false;
                    }

                    // 2. 시선 불안정 (홍채 움직임)
                    const currentIris = getIrisPosition(landmarks);
                    if (stats.lastIris) {
                        const dist = getDistance(currentIris.left, stats.lastIris.left);
                        stats.irisMovements.push(dist);
                    }
                    stats.lastIris = currentIris;

                    // 3. 얼굴 떨림 (코 끝 기준)
                    const currentNose = landmarks[1];
                    if (stats.lastNose) {
                        const dist = getDistance(currentNose, stats.lastNose);
                        stats.headMovements.push(dist);
                    }
                    stats.lastNose = currentNose;

                    // 4. 콧구멍 움직임
                    const currentNostrilSize = calculateNostrilDilatation(landmarks);
                    stats.nostrilSizes.push(currentNostrilSize);

                    // === Blendshape 기반 분석 (더 정확!) ===
                    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                        const bs = extractBlendshapeMetrics(results.faceBlendshapes);

                        // 눈 찡그림 (긴장 시 증가)
                        stats.eyeSquints.push((bs.eyeSquintLeft + bs.eyeSquintRight) / 2);

                        // 입 긴장 (입술 꽉 다물기)
                        stats.mouthPresses.push((bs.mouthPressLeft + bs.mouthPressRight) / 2);

                        // 눈썹 긴장 (찡그리기 + 치켜올리기)
                        const browDown = (bs.browDownLeft + bs.browDownRight) / 2;
                        stats.browTensions.push(Math.max(browDown, bs.browInnerUp));

                        // 턱 긴장
                        stats.jawClenches.push(bs.jawClench);
                    }
                }
            }
            requestAnimationFrame(predictWebcam);
        }
    };

    // 1초마다 데이터 분석 및 전송
    useEffect(() => {
        const interval = setInterval(async () => {
            const stats = statsRef.current;
            const baseline = baselineRef.current;
            const smoothed = smoothedRef.current;

            if (stats.headMovements.length < 3) return;

            // === 현재 1초간의 raw 수치 계산 ===
            const rawBlinks = stats.blinks;
            const rawIrisStdDev = calculateStdDev(stats.irisMovements);
            const rawHeadTremor = stats.headMovements.length > 0
                ? stats.headMovements.reduce((a,b) => a+b, 0) / stats.headMovements.length
                : 0;
            const rawNostrilStdDev = calculateStdDev(stats.nostrilSizes);
            const rawEyeSquint = stats.eyeSquints.length > 0
                ? stats.eyeSquints.reduce((a,b) => a+b, 0) / stats.eyeSquints.length
                : 0;
            const rawMouthPress = stats.mouthPresses.length > 0
                ? stats.mouthPresses.reduce((a,b) => a+b, 0) / stats.mouthPresses.length
                : 0;
            const rawBrowTension = stats.browTensions.length > 0
                ? stats.browTensions.reduce((a,b) => a+b, 0) / stats.browTensions.length
                : 0;

            // === Baseline 수집 (처음 3초) ===
            if (!baseline.collected) {
                baseline.sampleCount++;
                baseline.samples.blinks += rawBlinks;
                baseline.samples.irisMovements.push(rawIrisStdDev);
                baseline.samples.headMovements.push(rawHeadTremor);
                baseline.samples.nostrilSizes.push(rawNostrilStdDev);
                baseline.samples.eyeSquints.push(rawEyeSquint);
                baseline.samples.mouthPresses.push(rawMouthPress);
                baseline.samples.browTensions.push(rawBrowTension);

                if (baseline.sampleCount >= 3) {
                    const avg = (arr: number[]) => arr.reduce((a,b) => a+b, 0) / arr.length;
                    baseline.blinkRate = baseline.samples.blinks / baseline.sampleCount;
                    baseline.irisStdDev = avg(baseline.samples.irisMovements);
                    baseline.headTremor = avg(baseline.samples.headMovements);
                    baseline.nostrilStdDev = avg(baseline.samples.nostrilSizes);
                    baseline.eyeSquint = avg(baseline.samples.eyeSquints);
                    baseline.mouthPress = avg(baseline.samples.mouthPresses);
                    baseline.browTension = avg(baseline.samples.browTensions);
                    baseline.collected = true;
                    onStatusChange?.("진실의 눈 가동 중... 👁️");
                }

                // baseline 수집 중에는 기본값 전송
                stats.blinks = 0;
                stats.irisMovements = [];
                stats.headMovements = [];
                stats.nostrilSizes = [];
                stats.eyeSquints = [];
                stats.mouthPresses = [];
                stats.browTensions = [];
                stats.jawClenches = [];
                return;
            }

            // === Baseline 대비 변화량 기반 점수 (0~1) ===
            // 각 지표가 baseline 대비 얼마나 증가했는지 계산
            const safeDiv = (val: number, base: number, scale: number) => {
                const diff = Math.max(0, val - base);
                return Math.min(diff * scale, 1.0);
            };

            // 눈 깜빡임: baseline 대비 초과 횟수 기반
            const blinkDiff = Math.max(0, rawBlinks - baseline.blinkRate);
            const blinkScore = Math.min(blinkDiff / 3, 1.0); // 3회 초과 시 max

            // 시선 불안정: baseline 대비 표준편차 증가
            const eyeScore = safeDiv(rawIrisStdDev, baseline.irisStdDev, 80);

            // 얼굴 떨림: baseline 대비 증가
            const tremorScore = safeDiv(rawHeadTremor, baseline.headTremor, 50);

            // 콧구멍: baseline 대비 변동성 증가
            const nostrilScore = safeDiv(rawNostrilStdDev, baseline.nostrilStdDev, 150);

            // Blendshape 기반 점수
            const squintScore = safeDiv(rawEyeSquint, baseline.eyeSquint, 3);
            const mouthScore = safeDiv(rawMouthPress, baseline.mouthPress, 3);
            const browScore = safeDiv(rawBrowTension, baseline.browTension, 3);

            // === 종합 스트레스 지수 (가중 합산) ===
            // Landmark 기반 (50%) + Blendshape 기반 (50%)
            const rawStress = (
                blinkScore * 12 +       // 눈 깜빡임 증가
                eyeScore * 15 +          // 시선 불안정
                tremorScore * 10 +       // 얼굴 떨림
                nostrilScore * 8 +       // 콧구멍 변화
                squintScore * 18 +       // 눈 찡그림 (강력한 긴장 지표)
                mouthScore * 20 +        // 입 긴장 (가장 강력한 지표)
                browScore * 17           // 눈썹 긴장
            );
            const clampedStress = Math.min(Math.max(rawStress, 0), 100);

            // === EMA 스무딩 (급격한 변동 방지) ===
            smoothed.stressLevel = ema(smoothed.stressLevel, clampedStress, 0.35);
            smoothed.eyeMovement = ema(smoothed.eyeMovement, eyeScore, 0.3);
            smoothed.facialTremor = ema(smoothed.facialTremor, tremorScore, 0.3);
            smoothed.nostrilMovement = ema(smoothed.nostrilMovement, nostrilScore, 0.3);
            smoothed.eyeBlinkRate = ema(smoothed.eyeBlinkRate, rawBlinks, 0.4);

            const finalStress = Math.round(smoothed.stressLevel);
            const isLie = finalStress >= 55;

            const analysisData: FaceAnalysisData = {
                eyeBlinkRate: parseFloat(smoothed.eyeBlinkRate.toFixed(1)),
                eyeMovement: parseFloat(smoothed.eyeMovement.toFixed(2)),
                facialTremor: parseFloat(smoothed.facialTremor.toFixed(2)),
                nostrilMovement: parseFloat(smoothed.nostrilMovement.toFixed(2)),
                stressLevel: finalStress,
                isLie
            };

            // 서버로 전송
            try {
                if (targetDeviceId) {
                    await gameApi.truth.sendFaceData(roomId, targetDeviceId, analysisData);
                }
            } catch (e) { /* 전송 실패 무시 */ }

            // 부모(HUD) 화면 업데이트
            if (onAnalyze) {
                onAnalyze(analysisData);
            }

            // 1초 통계 초기화
            stats.blinks = 0;
            stats.irisMovements = [];
            stats.headMovements = [];
            stats.nostrilSizes = [];
            stats.eyeSquints = [];
            stats.mouthPresses = [];
            stats.browTensions = [];
            stats.jawClenches = [];

        }, 1000);

        return () => clearInterval(interval);
    }, [roomId, targetDeviceId, onAnalyze]);

    return (
        <div className="w-full h-full">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
            />
        </div>
    );
}
