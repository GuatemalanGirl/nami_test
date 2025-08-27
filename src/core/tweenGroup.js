// core/tweenGroup.js
//
// ===
// @tweenjs/tween.js v23.x+ 공식 권장 방식:
// 프로젝트 전체에서 사용할 Tween 애니메이션 그룹(Group) 인스턴스를 생성/공유하는 모듈.
// 모든 Tween 인스턴스를 생성할 때 이 그룹 객체를 명시적으로 전달해야 하며,
// 루프(animate)에서 group.update(time)으로 프레임마다 업데이트를 실행해야 애니메이션이 정상 동작한다.
//
// 사용 예:
//   import { tweenGroup } from './src/core/tweenGroup.js';
//   import { Tween } from '@tweenjs/tween.js';
//   new Tween(obj, tweenGroup).to(...).start();
//
// 루프에서:
//   tweenGroup.update(time);
//
// 여러 파일/모듈에서 이 그룹을 import해서 사용하면 됨.
//
// ===

import { Group } from '@tweenjs/tween.js';

// 프로젝트 전역에서 사용하는 Tween 그룹 객체 (싱글턴)
export const tweenGroup = new Group();
