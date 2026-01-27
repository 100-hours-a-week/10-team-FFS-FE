/* ==============================================
   API 관리 파일
   모든 API 함수를 여기서 관리합니다.
   ============================================== */

const BASE_URL = 'http://localhost:8080/api/v1';

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
    credentials: 'include', // refresh_token 쿠키 포함
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  // FormData인 경우 Content-Type 헤더 제거 (브라우저가 자동 설정)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  
  try {
    const response = await fetch(url, config);
    
    // 토큰 만료 시 리프레시 토큰으로 갱신 로직
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        config.headers['Authorization'] = `Bearer ${getAccessToken()}`;
        const retryResponse = await fetch(url, config);
        return handleResponse(retryResponse);
      } else {
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
  const data = await response.json().catch(() => ({ message: 'An error occurred' }));
  
  if (!response.ok) {
    const error = new Error(data.message || `HTTP error! status: ${response.status}`);
    error.code = data.code;
    error.data = data.data;
    throw error;
  }
  
  return data;
};

// 리프레시 토큰으로 액세스 토큰 갱신
const refreshAccessToken = async () => {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      setAccessToken(data.data.accessToken);
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

/**
 * 카카오 로그인
 * POST /api/v1/auth/kakao
 * @param {string} authorizationCode - 카카오 인가 코드
 * @returns {Promise<{code: number, message: string, data: {isRegistered: boolean, accessToken: string, nickname?: string}}>}
 */
export const kakaoLogin = async (authorizationCode) => {
  return apiRequest('/auth/kakao', {
    method: 'POST',
    body: JSON.stringify({ authorizationCode }),
  });
};

/**
 * 회원가입 완료 (추가 정보 입력)
 * POST /api/v1/users
 * @param {Object} data
 * @param {string} data.nickname - 닉네임 (필수)
 * @param {string} data.birthdate - 생년월일 YYYY-MM-DD (필수)
 * @param {string} data.gender - 성별 MALE/FEMALE/OTHER (필수)
 * @param {number} [data.profileFileId] - 프로필 이미지 파일 ID (선택)
 * @returns {Promise<{code: number, message: string, data: null}>}
 */
export const registerUser = async (data) => {
  const body = {
    nickname: data.nickname,
    birthDate: data.birthdate,
    gender: data.gender,
  };

  if (data.profileFileId) {
    body.profileFileId = data.profileFileId;
  }

  return apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

/**
 * 닉네임 중복 확인
 * GET /api/v1/users/validation?nickname={nickname}
 * @param {string} nickname
 * @returns {Promise<{code: number, message: string, data: {usable: boolean}}>}
 */
export const checkNickname = async (nickname) => {
  return apiRequest(`/users/validation?nickname=${encodeURIComponent(nickname)}`);
};

/**
 * 생년월일 유효성 검사
 * GET /api/v1/users/validation/birth-date?birthDate={birthDate}
 * @param {string} birthDate
 * @returns {Promise<{code: number, message: string, data: {valid: boolean}}>}
 */
export const checkBirthDate = async (birthDate) => {
  return apiRequest(`/users/validation/birth-date?birthDate=${encodeURIComponent(birthDate)}`);
};

export const logout = async () => {
  const result = await apiRequest('/auth/logout', {
    method: 'POST',
  });
  removeAccessToken();
  return result;
};

export const deleteAccount = async () => {
  const result = await apiRequest('/auth/withdraw', {
    method: 'DELETE',
  });
  removeAccessToken();
  return result;
};

export const getCurrentUser = async () => {
  return apiRequest('/users/me');
};

/* ==============================================
   Presigned URL 관련 API
   ============================================== */

/**
 * Presigned URL 발급 요청
 * @param {string} purpose - 용도 ('FEED', 'CLOTHES' 등)
 * @param {Array<{name: string, type: string}>} files - 파일 정보 배열
 * @returns {Promise<{code: number, message: string, data: {urls: Array, expiresInSeconds: number}}>}
 */
export const getPresignedUrls = async (purpose, files) => {
  return apiRequest('/presigned-url', {
    method: 'POST',
    body: JSON.stringify({ purpose, files }),
  });
};

/**
 * Presigned URL로 S3에 파일 업로드
 * @param {string} presignedUrl - S3 presigned URL
 * @param {File} file - 업로드할 파일
 * @returns {Promise<Response>}
 */
export const uploadToS3 = async (presignedUrl, file) => {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });
  
  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status}`);
  }
  
  return response;
};

/**
 * 파일들을 S3에 업로드하고 fileId 배열 반환
 * @param {string} purpose - 용도 ('FEED', 'CLOTHES' 등)
 * @param {File[]} files - 업로드할 파일 배열
 * @returns {Promise<number[]>} - fileId 배열
 */
export const uploadFiles = async (purpose, files) => {
  // 1. Presigned URL 발급
  const fileInfos = files.map(file => ({
    name: file.name,
    type: file.type,
  }));

  const presignedResponse = await getPresignedUrls(purpose, fileInfos);
  // API 응답: { code, message, data: [{ fileId, objectKey, presignedUrl }] }
  const urlInfos = presignedResponse.data;

  // 2. 각 파일을 S3에 업로드
  const uploadPromises = urlInfos.map((urlInfo, index) =>
    uploadToS3(urlInfo.presignedUrl, files[index])
  );

  await Promise.all(uploadPromises);

  // 3. fileId 배열 반환
  return urlInfos.map(urlInfo => urlInfo.fileId);
};

/* ==============================================
   옷장 관련 API
   ============================================== */

export const getMyClothes = async (category = 'ALL', cursor = null, limit = 12) => {
  let url = `/closet?category=${category}&limit=${limit}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  return apiRequest(url);
};

export const uploadClothes = async (clothesData) => {
  const formData = new FormData();
  
  clothesData.images.forEach((image) => {
    formData.append('images', image);
  });
  
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
    body: formData,
  });
};

export const getClothesDetail = async (clothesId) => {
  return apiRequest(`/closet/${clothesId}`);
};

export const updateClothes = async (clothesId, clothesData) => {
  return apiRequest(`/closet/${clothesId}`, {
    method: 'PUT',
    body: JSON.stringify(clothesData),
  });
};

export const deleteClothes = async (clothesId) => {
  return apiRequest(`/closet/${clothesId}`, {
    method: 'DELETE',
  });
};

export const analyzeClothesImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  return apiRequest('/ai/analyze-clothes', {
    method: 'POST',
    body: formData,
  });
};

/* ==============================================
   타인 옷장 관련 API
   ============================================== */

export const getOtherUserClothes = async (userId, category = 'ALL', cursor = null, limit = 12) => {
  let url = `/users/${userId}/closet?category=${category}&limit=${limit}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  return apiRequest(url);
};

export const getOtherUserClothesDetail = async (userId, clothesId) => {
  return apiRequest(`/users/${userId}/closet/${clothesId}`);
};

/* ==============================================
   AI 코디 추천 관련 API
   ============================================== */

export const getAICoordination = async (tpo) => {
  return apiRequest('/ai/coordination', {
    method: 'POST',
    body: JSON.stringify({ tpo }),
  });
};

export const getSearchHistory = async () => {
  return apiRequest('/ai/coordination/history');
};

export const likeCoordination = async (coordinationId) => {
  return apiRequest(`/ai/coordination/${coordinationId}/like`, {
    method: 'POST',
  });
};

export const unlikeCoordination = async (coordinationId) => {
  return apiRequest(`/ai/coordination/${coordinationId}/like`, {
    method: 'DELETE',
  });
};

export const saveCoordinationImage = async (coordinationId) => {
  return apiRequest(`/ai/coordination/${coordinationId}/save`, {
    method: 'POST',
  });
};

/* ==============================================
   피드 관련 API
   ============================================== */

/**
 * 피드 홈 목록 조회 (무한 스크롤)
 * GET /api/v1/feeds?after={id}&limit={n}
 * @param {number|null} after - 커서 (feedId)
 * @param {number} limit - 조회 개수
 */
export const getFeeds = async (after = null, limit = 12) => {
  let url = `/feeds?limit=${limit}`;
  if (after) {
    url += `&after=${after}`;
  }
  return apiRequest(url);
};

/**
 * 피드 상세 조회
 * GET /api/v1/feeds/{feedId}
 * @param {number} feedId
 */
export const getFeedDetail = async (feedId) => {
  return apiRequest(`/feeds/${feedId}`);
};

/**
 * 피드 업로드
 * POST /api/v1/feeds
 * @param {Object} feedData
 * @param {number[]} feedData.fileIds - presigned URL로 업로드 후 받은 파일 ID 배열 (필수, 1~5개)
 * @param {number[]} [feedData.clothesIds] - 태그할 옷 ID 배열 (선택)
 * @param {string} [feedData.content] - 피드 내용 (선택)
 */
export const createFeed = async (feedData) => {
  const body = {
    fileIds: feedData.fileIds,
  };
  
  if (feedData.clothesIds && feedData.clothesIds.length > 0) {
    body.clothesIds = feedData.clothesIds;
  }
  
  if (feedData.content) {
    body.content = feedData.content;
  }
  
  return apiRequest('/feeds', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

/**
 * 이미지 파일로 피드 업로드 (presigned URL 발급 + S3 업로드 + 피드 생성)
 * @param {Object} feedData
 * @param {File[]} feedData.images - 이미지 파일 배열 (1~5개)
 * @param {number[]} [feedData.clothesIds] - 태그할 옷 ID 배열
 * @param {string} [feedData.content] - 피드 내용
 */
export const createFeedWithImages = async (feedData) => {
  // 1. 이미지 파일들을 S3에 업로드하고 fileId 배열 받기
  const fileIds = await uploadFiles('FEED', feedData.images);
  
  // 2. 피드 생성
  return createFeed({
    fileIds,
    clothesIds: feedData.clothesIds,
    content: feedData.content,
  });
};

/**
 * 피드 수정
 * PATCH /api/v1/feeds/{feedId}
 * @param {number} feedId
 * @param {Object} feedData
 * @param {string} [feedData.content] - 수정할 내용
 * @param {number[]} [feedData.clothesIds] - 수정할 옷 ID 배열
 */
export const updateFeed = async (feedId, feedData) => {
  const body = {};
  
  if (feedData.content !== undefined) {
    body.content = feedData.content;
  }
  
  if (feedData.clothesIds !== undefined) {
    body.clothesIds = feedData.clothesIds;
  }
  
  return apiRequest(`/feeds/${feedId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};

/**
 * 피드 삭제
 * DELETE /api/v1/feeds/{feedId}
 * @param {number} feedId
 */
export const deleteFeed = async (feedId) => {
  return apiRequest(`/feeds/${feedId}`, {
    method: 'DELETE',
  });
};

/**
 * 피드 좋아요
 * POST /api/v1/feeds/{feedId}/likes
 * @param {number} feedId
 */
export const likeFeed = async (feedId) => {
  return apiRequest(`/feeds/${feedId}/likes`, {
    method: 'POST',
  });
};

/**
 * 피드 좋아요 취소
 * DELETE /api/v1/feeds/{feedId}/likes
 * @param {number} feedId
 */
export const unlikeFeed = async (feedId) => {
  return apiRequest(`/feeds/${feedId}/likes`, {
    method: 'DELETE',
  });
};

/**
 * 피드 좋아요 목록 조회
 * GET /api/v1/feeds/{feedId}/likes?after={id}&limit={n}
 * @param {number} feedId
 * @param {number|null} after - 커서
 * @param {number} limit - 조회 개수
 */
export const getFeedLikes = async (feedId, after = null, limit = 20) => {
  let url = `/feeds/${feedId}/likes?limit=${limit}`;
  if (after) {
    url += `&after=${after}`;
  }
  return apiRequest(url);
};

/* ==============================================
   댓글 관련 API
   ============================================== */

/**
 * 댓글 목록 조회 (피드)
 * GET /api/v1/feeds/{feedId}/comments?after=xx&limit=20
 * @param {number} feedId
 * @param {string|null} after - 커서
 * @param {number} limit - 조회 개수
 */
export const getComments = async (feedId, after = null, limit = 20) => {
  let url = `/feeds/${feedId}/comments?limit=${limit}`;
  if (after) {
    url += `&after=${after}`;
  }
  return apiRequest(url);
};

/**
 * 대댓글 목록 조회
 * GET /api/v1/feeds/{feedId}/comments/{commentId}/replies?after=xx&limit=20
 * @param {number} feedId
 * @param {number} commentId - 부모 댓글 ID
 * @param {string|null} after - 커서
 * @param {number} limit - 조회 개수
 */
export const getReplies = async (feedId, commentId, after = null, limit = 20) => {
  let url = `/feeds/${feedId}/comments/${commentId}/replies?limit=${limit}`;
  if (after) {
    url += `&after=${after}`;
  }
  return apiRequest(url);
};

/**
 * 댓글 작성
 * POST /api/v1/feeds/{feedId}/comments
 * @param {number} feedId
 * @param {string} content - 댓글 내용 (필수)
 * @param {number|null} parentId - 부모 댓글 ID (대댓글인 경우)
 */
export const createComment = async (feedId, content, parentId = null) => {
  const body = { content };
  
  if (parentId) {
    body.parentId = parentId;
  }
  
  return apiRequest(`/feeds/${feedId}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

/**
 * 댓글 수정
 * PATCH /api/v1/feeds/{feedId}/comments/{commentId}
 * @param {number} feedId
 * @param {number} commentId
 * @param {string} content - 수정할 내용 (필수)
 */
export const updateComment = async (feedId, commentId, content) => {
  return apiRequest(`/feeds/${feedId}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
};

/**
 * 댓글 삭제
 * DELETE /api/v1/feeds/{feedId}/comments/{commentId}
 * @param {number} feedId
 * @param {number} commentId
 */
export const deleteComment = async (feedId, commentId) => {
  return apiRequest(`/feeds/${feedId}/comments/${commentId}`, {
    method: 'DELETE',
  });
};

/**
 * 댓글 좋아요
 * POST /api/v1/feeds/{feedId}/comments/{commentId}/likes
 * @param {number} feedId
 * @param {number} commentId
 */
export const likeComment = async (feedId, commentId) => {
  return apiRequest(`/feeds/${feedId}/comments/${commentId}/likes`, {
    method: 'POST',
  });
};

/**
 * 댓글 좋아요 취소
 * DELETE /api/v1/feeds/{feedId}/comments/{commentId}/likes
 * @param {number} feedId
 * @param {number} commentId
 */
export const unlikeComment = async (feedId, commentId) => {
  return apiRequest(`/feeds/${feedId}/comments/${commentId}/likes`, {
    method: 'DELETE',
  });
};

/* ==============================================
   프로필 관련 API
   ============================================== */

export const getUserProfile = async (userId) => {
  return apiRequest(`/users/${userId}`);
};

export const getUserFeeds = async (userId, cursor = null, limit = 12) => {
  const params = new URLSearchParams();
  params.append('limit', limit);
  if (cursor) params.append('after', cursor);

  return apiRequest(`/users/${userId}/feeds?${params}`);
};

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
    body: formData,
  });
};

/* ==============================================
   유틸리티 함수들
   ============================================== */

export const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
};

export { getAccessToken, setAccessToken, removeAccessToken };