import axios, { AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 에러 메시지 추출 헬퍼
export function getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        // 서버 응답이 있는 경우
        if (error.response?.data?.error) {
            return error.response.data.error;
        }
        if (error.response?.data?.message) {
            return error.response.data.message;
        }
        // HTTP 상태 코드별 메시지
        switch (error.response?.status) {
            case 400: return '잘못된 요청입니다';
            case 401: return '인증이 필요합니다';
            case 403: return '접근 권한이 없습니다';
            case 404: return '요청한 리소스를 찾을 수 없습니다';
            case 500: return '서버 오류가 발생했습니다';
        }
        // 네트워크 에러
        if (error.code === 'ECONNABORTED') {
            return '요청 시간이 초과되었습니다';
        }
        if (error.code === 'ERR_NETWORK') {
            return '서버에 연결할 수 없습니다';
        }
    }
    if (error instanceof Error) {
        return error.message;
    }
    return '알 수 없는 오류가 발생했습니다';
}

api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export default api;