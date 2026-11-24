// 무기: [이름, 데미지, 쿨타임(초), 사거리], angles: 근접/표시용 부채꼴 각도(도)
// 장비 id: 0 운동화, 1 방탄조끼, 2 장갑, 3 목걸이, 4 손목시계, 5 흡혈 반지

const weapons = [["맨손", 100, 0.5, 80], ["검", 250, 0.6, 120], ["망치", 600, 1.5, 100], ["권총", 250, 0.6, 240], ["샷건", 140, 1.4, 160], ["저격총", 800, 2, 380], ["수류탄", 500, 2, 260]];
const angles = [90, 120, 160, 30, 75, 12, 60];
const gear = ["운동화", "방탄조끼", "장갑", "목걸이", "손목시계", "흡혈 반지"];

// 탄창: 최대 max발 연속 공격, 무기 쿨타임(위 weapons 의 3번째 값)마다 1발씩 충전
// fireGap: 연속으로 쏠 때 한 발과 다음 발 사이 최소 간격(초)
const AMMO = { max: 3, fireGap: 0.25 };

// ===== 기능 스위치 =====
// accessories: 액세서리(장비) 시스템. 기획 변경으로 이번 버전은 꺼 둠.
//   gear 데이터와 관련 코드는 그대로 보존하며, true 로 바꾸면 획득·장착·효과·상자 드롭·UI 가 다시 켜짐.
const FEATURES = { accessories: false };

// ===== 아이템 종류 =====
// 0 주무기, 1 액세서리(비활성), 2 수류탄(소모품), 3 체력 회복
const LOOT = { weapon: 0, accessory: 1, grenade: 2, heal: 3 };

// 주무기 5종 (weapons 의 id). 수류탄(6)은 주무기가 아니라 보조 소모품
const MAIN_WEAPONS = [1, 2, 3, 4, 5];

// ===== 보물 상자 드롭 표 (weight 는 상대 확률) =====
// 액세서리 항목은 FEATURES.accessories 가 true 일 때만 포함
const DROP_TABLE = [
  { type: LOOT.weapon, id: 1, weight: 10 }, // 검
  { type: LOOT.weapon, id: 2, weight: 10 }, // 망치
  { type: LOOT.weapon, id: 3, weight: 10 }, // 권총
  { type: LOOT.weapon, id: 4, weight: 10 }, // 산탄총
  { type: LOOT.weapon, id: 5, weight: 10 }, // 저격총
  { type: LOOT.grenade, weight: 28 },
  { type: LOOT.heal, weight: 22 },
  { type: LOOT.accessory, weight: 50, accessory: true }, // 비활성 (예전: 상자의 50%)
];

// ===== 수류탄 (소모성 보조 무기) =====
// 위력·범위·지연은 기존 수류탄 그대로 (weapons[6]: 피해 500, 사거리 260 / 반경 90, 0.8초 후 폭발)
const GRENADE = { max: 3, perPickup: 1, gap: 0.6, weaponId: 6, radius: 90, fuse: 0.8 };

// ===== 체력 회복 아이템 =====
// amount: 회복량(최대 HP 대비 비율), 획득 즉시 회복. 체력이 가득 차 있으면 줍지 않음
const HEAL = { ratio: 0.25 };

// ===== 타격감 (그림·소리만, 판정과 무관) =====
// dur: 공격 모션 길이(초), sound: 효과음 이름(js/data/sounds.js), kick: 내 화면 반동 세기(px), swing: 근접 휘두르기 각도(라디안)
const WEAPON_FEEL = [
  { dur: 0.16, sound: "punch", swing: 0.9 },              // 맨손
  { dur: 0.2, sound: "sword", swing: 1.6 },               // 검
  { dur: 0.32, sound: "hammer", swing: 2.0, kick: 5 },    // 망치
  { dur: 0.12, sound: "pistol", recoil: 6 },              // 권총
  { dur: 0.22, sound: "shotgun", recoil: 10, kick: 4 },   // 산탄총
  { dur: 0.3, sound: "sniper", recoil: 12, kick: 6 },     // 저격총
  { dur: 0.3, sound: "grenade_throw" },                   // 수류탄
];

// ===== 무기 손 그림 (교체 가능) =====
// 지금은 아이콘(assets/weapons)을 손에 든 모습으로 사용. 손 전용 그림이 오면 src 만 바꾸면 됨
// angle: 그림 속 무기가 가리키는 방향(라디안, 오른쪽=0, 위=-π/2), size: 그릴 크기(px)
// grip: 그림 안에서 손으로 잡는 지점 (0~1 비율)
const WEAPON_ART = [
  null, // 맨손
  { src: "assets/weapons/sword.webp", angle: -0.86, size: 34, grip: [0.3, 0.74] },
  { src: "assets/weapons/hammer.webp", angle: -0.95, size: 36, grip: [0.34, 0.8] },
  { src: "assets/weapons/pistol.webp", angle: -0.3, size: 26, grip: [0.42, 0.72] },
  { src: "assets/weapons/shotgun.webp", angle: -0.42, size: 38, grip: [0.3, 0.68] },
  { src: "assets/weapons/sniper.webp", angle: -0.4, size: 42, grip: [0.3, 0.7] },
  { src: "assets/weapons/grenade.webp", angle: -1.2, size: 20, grip: [0.5, 0.6] },
];
