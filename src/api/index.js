/* ==============================================
   API 관리 파일
   모든 API 함수를 여기서 관리합니다.
   TODO: 백엔드 API 연동 시 BASE_URL 및 각 엔드포인트 수정 필요
   ============================================== */

// API 연동 필요: 실제 백엔드 URL로 변경
const BASE_URL = '/api';

// 토큰 관리
const getAccessToken = () => localStorage.getItem('accessToken');
const setAccessToken = (token) => localStorage.setItem('accessToken', token);
const removeAccessToken = () => localStorage.removeItem('accessToken');

// API 요청 헬퍼 함수
const apiRequest = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  const accessToken = getAccessToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  if (accessToken) {
    defaultHeaders['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, config);
    
    // API 연동 필요: 토큰 만료 시 리프레시 토큰으로 갱신 로직
    if (response.status === 401) {
      // 리프레시 토큰으로 액세스 토큰 갱신 시도
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // 갱신 성공 시 원래 요청 재시도
        config.headers['Authorization'] = `Bearer ${getAccessToken()}`;
        const retryResponse = await fetch(url, config);
        return handleResponse(retryResponse);
      } else {
        // 갱신 실패 시 로그아웃
        removeAccessToken();
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }
    }
    
    return handleResponse(response);
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// API 연동 필요: 리프레시 토큰으로 액세스 토큰 갱신
const refreshAccessToken = async () => {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // 쿠키에 있는 refresh token 포함
    });
    
    if (response.ok) {
      const data = await response.json();
      setAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
};

/* ==============================================
   인증 관련 API
   ============================================== */

// API 연동 필요: 카카오 로그인
export const kakaoLogin = async (authCode) => {
  return apiRequest('/auth/kakao', {
    method: 'POST',
    body: JSON.stringify({ code: authCode }),
  });
};

// API 연동 필요: 추가 정보 입력 (첫 로그인 시)
export const submitAdditionalInfo = async (data) => {
  const formData = new FormData();
  if (data.profileImage) {
    formData.append('profileImage', data.profileImage);
  }
  formData.append('nickname', data.nickname);
  formData.append('birthday', data.birthday);
  formData.append('gender', data.gender);
  
  return apiRequest('/auth/additional-info', {
    method: 'POST',
    headers: {}, // Content-Type은 FormData가 자동 설정
    body: formData,
  });
};

// API 연동 필요: 닉네임 중복 확인
export const checkNickname = async (nickname) => {
  return apiRequest(`/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`);
};

// API 연동 필요: 로그아웃
export const logout = async () => {
  const result = await apiRequest('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  removeAccessToken();
  return result;
};

// API 연동 필요: 회원 탈퇴
export const deleteAccount = async () => {
  const result = await apiRequest('/auth/withdraw', {
    method: 'DELETE',
    credentials: 'include',
  });
  removeAccessToken();
  return result;
};

// API 연동 필요: 현재 사용자 정보 조회
export const getCurrentUser = async () => {
  return apiRequest('/users/me');
};

/* ==============================================
   옷장 관련 API
   ============================================== */

// API 연동 필요: 내 옷장 목록 조회
export const getMyClothes = async (category = 'ALL', cursor = null, limit = 12) => {
  let url = `/closet?category=${category}&limit=${limit}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  return apiRequest(url);
};

// API 연동 필요: 옷 등록 (이미지 업로드 포함)
export const uploadClothes = async (clothesData) => {
  const formData = new FormData();
  
  // 이미지 파일들 추가
  clothesData.images.forEach((image, index) => {
    formData.append('images', image);
  });
  
  // 옷 정보 추가
  formData.append('productName', clothesData.productName);
  formData.append('brand', clothesData.brand || '');
  formData.append('price', clothesData.price || '');
  formData.append('size', clothesData.size || '');
  formData.append('purchaseYear', clothesData.purchaseYear);
  formData.append('purchaseMonth', clothesData.purchaseMonth);
  formData.append('category', clothesData.category);
  formData.append('materials', JSON.stringify(clothesData.materials || []));
  formData.append('colors', JSON.stringify(clothesData.colors || []));
  formData.append('styleTags', JSON.stringify(clothesData.styleTags || []));
  
  return apiRequest('/closet', {
    method: 'POST',
    headers: {},
    body: formData,
  });
};

// API 연동 필요: 옷 상세 조회
export const getClothesDetail = async (clothesId) => {
  return apiRequest(`/closet/${clothesId}`);
};

// API 연동 필요: 옷 정보 수정
export const updateClothes = async (clothesId, clothesData) => {
  return apiRequest(`/closet/${clothesId}`, {
    method: 'PUT',
    body: JSON.stringify(clothesData),
  });
};

// API 연동 필요: 옷 삭제
export const deleteClothes = async (clothesId) => {
  return apiRequest(`/closet/${clothesId}`, {
    method: 'DELETE',
  });
};

// API 연동 필요: AI 옷 분석 요청
export const analyzeClothesImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  return apiRequest('/ai/analyze-clothes', {
    method: 'POST',
    headers: {},
    body: formData,
  });
};

/* ==============================================
   타인 옷장 관련 API
   ============================================== */

// API 연동 필요: 타인 옷장 목록 조회
export const getOtherUserClothes = async (userId, category = 'ALL', cursor = null, limit = 12) => {
  let url = `/users/${userId}/closet?category=${category}&limit=${limit}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  return apiRequest(url);
};

// API 연동 필요: 타인 옷 상세 조회
export const getOtherUserClothesDetail = async (userId, clothesId) => {
  return apiRequest(`/users/${userId}/closet/${clothesId}`);
};

/* ==============================================
   AI 코디 추천 관련 API
   ============================================== */

// API 연동 필요: AI 코디 추천 요청
export const getAICoordination = async (tpo) => {
  return apiRequest('/ai/coordination', {
    method: 'POST',
    body: JSON.stringify({ tpo }),
  });
};

// API 연동 필요: 코디 검색 기록 조회
export const getSearchHistory = async () => {
  return apiRequest('/ai/coordination/history');
};

// API 연동 필요: 코디 좋아요
export const likeCoordination = async (coordinationId) => {
  return apiRequest(`/ai/coordination/${coordinationId}/like`, {
    method: 'POST',
  });
};

// API 연동 필요: 코디 좋아요 취소
export const unlikeCoordination = async (coordinationId) => {
  return apiRequest(`/ai/coordination/${coordinationId}/like`, {
    method: 'DELETE',
  });
};

// API 연동 필요: 코디 이미지 저장 (PNG)
export const saveCoordinationImage = async (coordinationId) => {
  return apiRequest(`/ai/coordination/${coordinationId}/save`, {
    method: 'POST',
  });
};

/* ==============================================
   피드 관련 API
   ============================================== */

// API 연동 필요: 피드 목록 조회 (무한 스크롤)
export const getFeeds = async (cursor = null, limit = 12) => {
  let url = `/feeds?limit=${limit}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  return apiRequest(url);
};

// API 연동 필요: 피드 상세 조회
export const getFeedDetail = async (feedId) => {
  return apiRequest(`/feeds/${feedId}`);
};

// API 연동 필요: 피드 작성
export const createFeed = async (feedData) => {
  const formData = new FormData();
  
  // 이미지 파일들 추가
  feedData.images.forEach((image) => {
    formData.append('images', image);
  });
  
  formData.append('content', feedData.content);
  formData.append('clothesIds', JSON.stringify(feedData.clothesIds || []));
  
  return apiRequest('/feeds', {
    method: 'POST',
    headers: {},
    body: formData,
  });
};

// API 연동 필요: 피드 수정
export const updateFeed = async (feedId, feedData) => {
  return apiRequest(`/feeds/${feedId}`, {
    method: 'PUT',
    body: JSON.stringify(feedData),
  });
};

// API 연동 필요: 피드 삭제
export const deleteFeed = async (feedId) => {
  return apiRequest(`/feeds/${feedId}`, {
    method: 'DELETE',
  });
};

// API 연동 필요: 피드 좋아요
export const likeFeed = async (feedId) => {
  return apiRequest(`/feeds/${feedId}/like`, {
    method: 'POST',
  });
};

// API 연동 필요: 피드 좋아요 취소
export const unlikeFeed = async (feedId) => {
  return apiRequest(`/feeds/${feedId}/like`, {
    method: 'DELETE',
  });
};

// API 연동 필요: 피드 좋아요 목록 조회
export const getFeedLikes = async (feedId) => {
  return apiRequest(`/feeds/${feedId}/likes`);
};

/* ==============================================
   댓글 관련 API
   ============================================== */

// API 연동 필요: 댓글 목록 조회
export const getComments = async (feedId, cursor = null, limit = 10) => {
  let url = `/feeds/${feedId}/comments?limit=${limit}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  return apiRequest(url);
};

// API 연동 필요: 댓글 작성
export const createComment = async (feedId, content, parentId = null) => {
  return apiRequest(`/feeds/${feedId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parentId }),
  });
};

// API 연동 필요: 댓글 삭제
export const deleteComment = async (feedId, commentId) => {
  return apiRequest(`/feeds/${feedId}/comments/${commentId}`, {
    method: 'DELETE',
  });
};

// API 연동 필요: 댓글 좋아요
export const likeComment = async (feedId, commentId) => {
  return apiRequest(`/feeds/${feedId}/comments/${commentId}/like`, {
    method: 'POST',
  });
};

// API 연동 필요: 댓글 좋아요 취소
export const unlikeComment = async (feedId, commentId) => {
  return apiRequest(`/feeds/${feedId}/comments/${commentId}/like`, {
    method: 'DELETE',
  });
};

/* ==============================================
   프로필 관련 API
   ============================================== */

// API 연동 필요: 사용자 프로필 조회
export const getUserProfile = async (userId) => {
  return apiRequest(`/users/${userId}/profile`);
};

// API 연동 필요: 사용자의 피드 목록 조회
export const getUserFeeds = async (userId, cursor = null, limit = 12) => {
  let url = `/users/${userId}/feeds?limit=${limit}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  return apiRequest(url);
};

// API 연동 필요: 내 프로필 수정
export const updateMyProfile = async (profileData) => {
  const formData = new FormData();
  if (profileData.profileImage) {
    formData.append('profileImage', profileData.profileImage);
  }
  if (profileData.nickname) {
    formData.append('nickname', profileData.nickname);
  }
  
  return apiRequest('/users/me/profile', {
    method: 'PUT',
    headers: {},
    body: formData,
  });
};

/* ==============================================
   유틸리티 함수들
   ============================================== */

// 숫자 포맷팅 (1000 -> 1k, 1000000 -> 1M)
export const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
};

// 토큰 관련 함수 export
export { getAccessToken, setAccessToken, removeAccessToken };
