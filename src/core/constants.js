import * as THREE from 'three';

/**
 * 프로젝트 전역에서 사용되는 모든 수치 상수들을 한곳에 모아 관리
 * - 방 크기, 카메라 설정, 초기 위치, 배치 오프셋, 애니메이션 지속시간 등
 */
// room dimensions
export const ROOM_WIDTH = 20;
export const ROOM_HEIGHT = 8;
export const ROOM_DEPTH = 20;

// 카메라 설정
export const CAMERA_FOV = 75;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 1000;

// 초기 카메라 위치
export const INITIAL_CAMERA_POS = new THREE.Vector3(0, ROOM_HEIGHT, -ROOM_DEPTH * 1.5);

// offsets
export const PAINTING_Y_OFFSET = 0;
export const WALL_OFFSET = 0.01;

// 카메라 애니메이션 
export const ZOOM_DISTANCE = 6;
export const ZOOM_DISTANCE_CLOSER = 3; // 두 번째 줌 거리 추가
export const CAMERA_DURATION = 1000;

// 작품의 최대 크기 제한
export const PAINTING_WIDTH_LIMIT = ROOM_WIDTH / 4;
export const PAINTING_HEIGHT_LIMIT = ROOM_HEIGHT / 3;