# 정용 영입 컷신 적용 요청
- 승인된 7컷을 분리한 WebP 및 timeline.json, 임시 합성 효과음, 독립 HTML 미리보기.
- 게임 assets/cutscenes/jeongyong/01.webp~07.webp에 연결하고, RECRUIT_STORIES.jeongyong 및 CUTSCENE_VOICES.jeongyong 추가. reward bear. 기존 현곤 음성 설정 유지.
- 현재 실제 WAV 대사 파일 없음. voice 파일 경로 null로 설정하고 기존 ko-KR Web Speech API 임시 TTS 사용. 정용 pitch 0.72 rate 1.0, 현곤 pitch 1.25 rate 1.09. 음성 종료 전 장면 전환되지 않도록 최대 5초 여유, 무음/오류 시 진행, 스킵 시 즉시 취소. 15초는 목표.
- 기존 car/ding/huff/impact/fanfare/BGM 사용 가능. 음성은 추후 실제 녹음 파일로 교체. 이미지 원본 말풍선 유지, 중복 자막은 게임에서 생략. 이미지 contain 표시. 원본 편집용 시간 태그는 국소 보정으로 제거하여 일부 배경 질감이 달라질 수 있음.
- 기존 5개 컷신도 현곤 15초, 은숙 19초, 기섭 15초, 상훈 14초, 경수 15초 목표로 단축. 영입 연출 2초, 전환 0.15초, 실제 음성 길이 우선.
- 정용 영입 성공 저장 후 컷신, 스킵 및 완료 시 기존 영입 결과 UI 연결. 마지막 캐릭터 영입 완료 처리 유지.
- HTML 미리보기는 독립 실행용이며 게임 저장/영입 기능 미연결. 브라우저의 설치된 한국어 음성에 따라 음색 및 재생 시간이 달라짐.
