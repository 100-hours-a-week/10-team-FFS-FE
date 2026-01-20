/* ==============================================
   유틸리티 함수들
   ============================================== */

// 숫자 포맷팅 (1000 -> 1k, 1000000 -> 1M)
export const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  
  const n = Number(num);
  
  if (n >= 1000000) {
    const formatted = (n / 1000000).toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'M' : formatted + 'M';
  }
  
  if (n >= 1000) {
    const formatted = (n / 1000).toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'k' : formatted + 'k';
  }
  
  return n.toString();
};

// 날짜 포맷팅
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  // 1분 이내
  if (diff < 60 * 1000) {
    return '방금 전';
  }
  
  // 1시간 이내
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}분 전`;
  }
  
  // 24시간 이내
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}시간 전`;
  }
  
  // 7일 이내
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}일 전`;
  }
  
  // 그 외
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}.${month}.${day}`;
};

// 날짜 시간 포맷팅 (댓글 등에 사용)
export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}.${month}.${day} ${hours}:${minutes}`;
};

// 파일 크기 포맷팅
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 이미지 파일 유효성 검사
export const isValidImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(file.type);
};

// 이미지 파일 확장자 검사 (업로드용)
export const isValidUploadImage = (file) => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  return validTypes.includes(file.type);
};

// 파일을 Data URL로 변환
export const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 이미지 압축/리사이즈
export const resizeImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 닉네임 유효성 검사
export const validateNickname = (nickname) => {
  const errors = [];
  
  if (!nickname || nickname.trim() === '') {
    errors.push('닉네임을 입력해주세요.');
    return { isValid: false, errors };
  }
  
  // 길이 검사 (16자 미만)
  if (nickname.length >= 16) {
    errors.push('닉네임은 16자 미만으로 입력해주세요.');
  }
  
  // 공백 검사
  if (/\s/.test(nickname)) {
    errors.push('닉네임에 공백을 사용할 수 없습니다.');
  }
  
  // 특수문자 검사 (영문, 한글, 숫자만 허용)
  if (!/^[a-zA-Z가-힣0-9]+$/.test(nickname)) {
    errors.push('닉네임은 영문, 한글, 숫자만 사용할 수 있습니다.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// 클립보드에 복사
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // 폴백: 구형 브라우저 지원
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
};

// 이미지 다운로드
export const downloadImage = async (imageUrl, filename = 'download.png') => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Download failed:', error);
    return false;
  }
};

// 공유 URL 생성
export const generateShareUrl = (path) => {
  return `${window.location.origin}${path}`;
};

// 디바운스 함수
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// 스로틀 함수
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// 로컬 스토리지 헬퍼
export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

// 세션 스토리지 헬퍼
export const sessionStorage = {
  get: (key, defaultValue = null) => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: (key, value) => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove: (key) => {
    try {
      window.sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

// 년도 목록 생성 (현재년도부터 10년 전까지)
export const generateYearOptions = (count = 10) => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => currentYear - i);
};

// 월 목록 생성
export const generateMonthOptions = () => {
  return Array.from({ length: 12 }, (_, i) => i + 1);
};
