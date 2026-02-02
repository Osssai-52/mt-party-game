import { io } from "socket.io-client";

// 서버랑 연결하는 전용 무전기 생성
// path 옵션이 서버에 설정한 주소랑 똑같아야 함
export const socket = io({
    path: "/api/socket/io",
    autoConnect: false, 
});
