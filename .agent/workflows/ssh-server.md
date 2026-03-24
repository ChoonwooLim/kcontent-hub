---
description: SSH로 Orbitron 리눅스 서버에 접속하여 Docker 컨테이너 관리
---

# Orbitron 리눅스 서버 SSH 접속

## 서버 정보
- **호스트**: 192.168.219.101
- **계정**: stevenlim
- **인증**: SSH 키 (비밀번호 없이 자동 접속)
- **Docker 컨테이너**: orbitron-kcontentshub-mn58ktns

## SSH 키 인증 설정 완료
- 공개키가 서버의 `~/.ssh/authorized_keys`에 등록됨
- 비밀번호 입력 없이 즉시 접속 가능

## 자주 사용하는 명령어

### 1. 서버 상태 확인
// turbo
```
ssh stevenlim@192.168.219.101 "docker ps --format '{{.Names}} {{.Status}}'"
```

### 2. 컨테이너 내부 파일 확인
// turbo
```
ssh stevenlim@192.168.219.101 "docker exec orbitron-kcontentshub-mn58ktns ls -la /app/media/downloads/saved/"
```

### 3. 컨테이너 로그 확인
// turbo
```
ssh stevenlim@192.168.219.101 "docker logs orbitron-kcontentshub-mn58ktns --tail 50"
```

### 4. 컨테이너 내부 셸 접속
```
ssh stevenlim@192.168.219.101 "docker exec -it orbitron-kcontentshub-mn58ktns sh"
```

### 5. MP4 파일 전체 검색
// turbo
```
ssh stevenlim@192.168.219.101 "docker exec orbitron-kcontentshub-mn58ktns find /app/media -name '*.mp4' -type f"
```

### 6. 디스크 사용량 확인
// turbo
```
ssh stevenlim@192.168.219.101 "docker exec orbitron-kcontentshub-mn58ktns du -sh /app/media/downloads/"
```

## 볼륨 마운트 정보
| 컨테이너 경로 | 호스트 경로 | 영구 보존 |
|--------------|-----------|:---:|
| /app/uploads | _volumes/uploads | ✅ |
| /app/media | _volumes/media | ✅ |
| /app/data | _volumes/data | ✅ |
| /app/public/uploads | _volumes/public_uploads | ✅ |

## 주의사항
- `tmp_downloads`는 볼륨 마운트가 없어 재빌드 시 삭제됨
- 영상 파일은 반드시 `/app/media/downloads/`에 저장해야 영구 보존
- SSH 포트(22)가 닫혀있으면 서버에서 수동으로 열어야 함
