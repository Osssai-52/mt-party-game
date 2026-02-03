'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 레거시 경로 - 메인 페이지로 리다이렉트
 * 이전에 /host/create 경로를 사용했던 링크들을 위한 호환성 유지
 */
export default function LegacyCreatePage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/');
    }, [router]);

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="text-center">
                <div className="text-4xl mb-4 animate-spin">🎲</div>
                <p className="text-gray-400">리다이렉트 중...</p>
            </div>
        </div>
    );
}
