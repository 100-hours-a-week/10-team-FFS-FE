# KlosetLab - AI 기반 옷장 관리 & 패션 커뮤니티

## 📦 프로젝트 실행 방법

```bash
# 1. 압축 해제 후 폴더로 이동
cd kloset-lab

# 2. 패키지 설치
npm install

# 3. 개발 서버 실행
npm start
```

브라우저에서 `http://localhost:3000` 으로 접속하세요.

## 🗂️ 프로젝트 구조

```
src/
├── api/
│   └── index.js          # 모든 API 함수 관리 (// TODO: API 연동 필요 주석 포함)
├── components/
│   ├── common/           # 공통 컴포넌트 (Button, Modal, Toast, Loading 등)
│   └── layout/           # 레이아웃 (AppLayout, BottomNav, Header)
├── pages/                # 페이지 컴포넌트
│   ├── LoginPage         # 로그인 (카카오)
│   ├── AdditionalInfoPage# 추가정보 입력
│   ├── ClosetListPage    # 내 옷장 목록
│   ├── ClosetDetailPage  # 옷 상세
│   ├── ClosetUploadPage  # 옷 등록
│   ├── AICoordPage       # AI 코디 추천
│   ├── FeedListPage      # 피드 목록
│   ├── FeedDetailPage    # 피드 상세
│   ├── FeedCreatePage    # 피드 작성
│   ├── ProfilePage       # 타인 프로필
│   ├── OtherClosetListPage   # 타인 옷장 목록
│   ├── OtherClosetDetailPage # 타인 옷 상세
│   ├── MyPage            # 마이페이지
│   └── MyPageEdit        # 프로필 수정
├── hooks/                # 커스텀 훅 (useInfiniteScroll)
├── contexts/             # Context API (Auth, Toast)
├── utils/                # 유틸리티 함수
├── styles/               # 글로벌 CSS 및 변수
└── mocks/                # 목업 데이터
```

## 🎨 색상 변경 방법

`src/styles/variables.css` 파일에서 CSS 변수를 수정하면 전체 앱의 색상이 변경됩니다.

```css
:root {
  /* Primary Colors - 메인 브랜드 색상 */
  --color-primary: #1a1a1a;        /* 여기를 원하는 색상으로 변경 */
  --color-primary-light: #333333;
  --color-primary-dark: #000000;
  
  /* Accent Colors - 강조 색상 */
  --color-accent: #1a1a1a;
  
  /* 좋아요 색상 */
  --color-like: #ff4757;
}
```

## 🔗 API 연동 방법

`src/api/index.js` 파일에서 `// API 연동 필요` 주석이 달린 부분을 실제 API로 교체하세요.

```javascript
// 예시: 카카오 로그인
export const kakaoLogin = async (authCode) => {
  return apiRequest('/auth/kakao', {
    method: 'POST',
    body: JSON.stringify({ code: authCode }),
  });
};
```

## 📱 주요 기능

### 1. 인증
- 카카오 로그인
- 추가정보 입력 (닉네임, 생일, 성별, 프로필 사진)
- JWT 토큰 기반 인증 (Refresh Token은 쿠키)

### 2. 옷장 (Closet)
- 옷 등록 (사진 최대 10장, AI 자동 분석)
- 카테고리별 필터링
- 소재/색상 태그 수정 가능
- 스타일 태그 (AI 분석, 수정 불가)

### 3. AI 코디 추천
- TPO 기반 코디 추천
- 검색 기록 (최근 3개)
- 좋아요 / 저장(PNG 다운로드) / 공유(피드로)

### 4. 피드
- 무한 스크롤
- 다중 이미지 (최대 10장)
- 착용한 옷 태그 (최대 10개)
- 좋아요, 댓글, 대댓글

### 5. 프로필
- 마이페이지
- 프로필 수정
- 타인 프로필 / 옷장 보기
- 로그아웃 / 회원탈퇴

## 📝 참고사항

- 현재는 **목업 데이터**로 동작합니다
- 모든 API 호출 부분에 `// TODO: API 연동 필요` 주석이 있습니다
- 웹 반응형: 430px 이상에서는 가운데 정렬 + 양쪽 여백
- iOS 스타일 모달/액션시트 적용

## 🛠️ 기술 스택

- React 18
- React Router v6
- react-icons
- CSS (프레임워크 없음)
