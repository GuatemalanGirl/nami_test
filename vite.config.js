import { defineConfig } from 'vite';

export default defineConfig({
    root: './', // 소스 파일이 있는 루트
    base: '/nami_test/', // 상대 경로로 자산 로딩
    build: {
        outDir: 'dist' // 빌드 산출물 폴더
    },
    server: {
        port: 5173, // 개발 서버 포트
        allowedHosts: ['a00a21baa7e8.ngrok-free.app'],
    },
});