# Battle Lab

사방에서 몰려오는 봇과 싸우는 탑다운 배틀로얄 웹 게임 (PC + 모바일).

## 실행

- **그냥 열기**: `index.html`을 브라우저로 열면 됩니다 (일반 `<script>`라 `file://`에서도 동작).
- **GitHub Pages**: 저장소 설정 → Pages → 브랜치 선택 후 `index.html` 주소로 접속.
- **파일 하나로 공유**: `python3 tools/build_single.py` → `dist/index.html` (이미지까지 모두 포함, `dist/`는 git에 올리지 않음)

## 폴더 구조와 담당

| 경로 | 내용 | 담당 |
|---|---|---|
| `index.html` | 마크업 (캔버스, HUD, 터치 버튼) | ChatGPT (UI) |
| `css/game.css` | 화면 배치·스타일 | ChatGPT (UI) |
| `assets/` | 캐릭터 시트(96px × 8프레임 × 8방향), 맵, 소품, 초상화 | ChatGPT (그래픽) |
| `js/data/` | 맵·무기·장비·포켓몬·스킬 이름 등 수치 데이터 | 공동 (변경 이유를 PR에 기재) |
| `js/engine/` | 이미지 로딩, 입력, 지형·충돌·이동 | Claude |
| `js/game/` | 전투, 스킬, 소환, 봇 AI(경로 탐색), 라운드 진행 | Claude |
| `js/render/` | 그리기, 이펙트, HUD 갱신 | Claude |
| `js/ui/` | 덱 편집, 모바일 터치 조작 | Claude (로직) / ChatGPT (배치) |
| `tools/`, `tests/` | 빌드·추출 도구, 시뮬레이션 테스트 | Claude |
| `docs/` | 기술 검토, 설계 문서 | 공동 |

`index.html`의 `<script>` 순서가 곧 로딩 순서입니다. 새 JS 파일을 추가할 때는 의존하는 파일 뒤에 넣어 주세요.

## 브랜치 규칙

- `main`: 승인된 버전만 병합
- `claude-dev`: 엔진·전투·AI·성능
- `chatgpt-dev`: 기획·캐릭터·그래픽·맵·UI

## 교체 가능한 데이터 (코드 수정 없이 바꾸는 곳)

| 무엇 | 파일 |
|---|---|
| 효과음·배경음 경로·음량 | `js/data/sounds.js` |
| 상자 드롭 확률, 수류탄·회복 수치, 기능 스위치(액세서리) | `js/data/combat.js` |
| 손에 든 무기 그림, 무기별 모션·반동·효과음 | `js/data/combat.js` (`WEAPON_ART`, `WEAPON_FEEL`) |
| 공격 모션 스프라이트, 캐릭터 설명, 곰 질주 시트 사용 여부 | `js/data/characters.js` |

## 테스트

```bash
python3 tests/sim.py index.html                 # 캐릭터 8종 시드 고정 시뮬레이션
python3 tests/sim.py old.html index.html        # 두 버전의 게임 상태가 같은지 비교
python3 tests/sim.py index.html --mobile --fps  # 터치 모드 + 프레임 처리 시간
python3 tests/rules.py                          # 전투 규칙·QA 회귀 테스트 (60개 항목)
```

자세한 분석과 변경 이력은 [docs/TECH_REVIEW.md](docs/TECH_REVIEW.md)를 참고하세요.
