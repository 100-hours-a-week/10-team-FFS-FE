/* ==============================================
   목업 데이터
   백엔드 API 연동 전까지 사용할 테스트 데이터
   ============================================== */

// 현재 로그인 사용자
export const mockCurrentUser = {
  id: 1,
  nickname: 'sample_nickname',
  profileImage: null, // 기본 이미지
  birthday: '1995-03-15',
  gender: '여성',
  isNewUser: false,
};

// 다른 사용자들
export const mockUsers = [
  {
    id: 'user_002',
    nickname: 'fashion_lover',
    profileImage: null,
  },
  {
    id: 'user_003',
    nickname: 'style_master',
    profileImage: null,
  },
  {
    id: 'user_004',
    nickname: 'trendy_kim',
    profileImage: null,
  },
];

// 카테고리 목록
export const categories = [
  { id: 'ALL', label: 'ALL' },
  { id: 'TOP', label: '상의' },
  { id: 'BOTTOM', label: '하의' },
  { id: 'ONEPIECE', label: '원피스' },
  { id: 'SHOES', label: '신발' },
  { id: 'ACCESSORY', label: '악세사리' },
  { id: 'ETC', label: '기타' },
];

// 옷 목록 (내 옷장)
export const mockClothes = [
  {
    id: 'clothes_001',
    images: ['/placeholder-clothes.jpg'],
    productName: '베이직 화이트 티셔츠',
    brand: '무인양품',
    price: '29,000',
    size: 'M',
    purchaseYear: '2024',
    purchaseMonth: '3',
    category: 'TOP',
    materials: ['면', '폴리에스터'],
    colors: ['화이트'],
    styleTags: ['#캐주얼', '#베이직'],
  },
  {
    id: 'clothes_002',
    images: ['/placeholder-clothes.jpg'],
    productName: '슬림핏 청바지',
    brand: '리바이스',
    price: '89,000',
    size: '30',
    purchaseYear: '2024',
    purchaseMonth: '1',
    category: 'BOTTOM',
    materials: ['데님', '스판덱스'],
    colors: ['인디고'],
    styleTags: ['#캐주얼', '#데일리'],
  },
  {
    id: 'clothes_003',
    images: ['/placeholder-clothes.jpg'],
    productName: '오버사이즈 후드티',
    brand: '나이키',
    price: '79,000',
    size: 'L',
    purchaseYear: '2023',
    purchaseMonth: '11',
    category: 'TOP',
    materials: ['면', '폴리에스터'],
    colors: ['블랙', '그레이'],
    styleTags: ['#스트릿', '#오버핏'],
  },
  {
    id: 'clothes_004',
    images: ['/placeholder-clothes.jpg'],
    productName: '플리츠 미디 스커트',
    brand: 'COS',
    price: '129,000',
    size: 'S',
    purchaseYear: '2024',
    purchaseMonth: '5',
    category: 'BOTTOM',
    materials: ['폴리에스터'],
    colors: ['베이지'],
    styleTags: ['#페미닌', '#미니멀'],
  },
  {
    id: 'clothes_005',
    images: ['/placeholder-clothes.jpg'],
    productName: '린넨 셔츠',
    brand: '자라',
    price: '59,000',
    size: 'M',
    purchaseYear: '2024',
    purchaseMonth: '6',
    category: 'TOP',
    materials: ['린넨'],
    colors: ['스카이블루'],
    styleTags: ['#캐주얼', '#여름'],
  },
  {
    id: 'clothes_006',
    images: ['/placeholder-clothes.jpg'],
    productName: '캔버스 스니커즈',
    brand: '컨버스',
    price: '65,000',
    size: '250',
    purchaseYear: '2024',
    purchaseMonth: '2',
    category: 'SHOES',
    materials: ['캔버스', '고무'],
    colors: ['화이트'],
    styleTags: ['#캐주얼', '#클래식'],
  },
  {
    id: 'clothes_007',
    images: ['/placeholder-clothes.jpg'],
    productName: '니트 카디건',
    brand: '유니클로',
    price: '49,900',
    size: 'M',
    purchaseYear: '2023',
    purchaseMonth: '10',
    category: 'TOP',
    materials: ['울', '아크릴'],
    colors: ['크림'],
    styleTags: ['#모던', '#레이어드'],
  },
  {
    id: 'clothes_008',
    images: ['/placeholder-clothes.jpg'],
    productName: '실버 목걸이',
    brand: '판도라',
    price: '89,000',
    size: 'FREE',
    purchaseYear: '2024',
    purchaseMonth: '4',
    category: 'ACCESSORY',
    materials: ['실버'],
    colors: ['실버'],
    styleTags: ['#미니멀', '#데일리'],
  },
  {
    id: 'clothes_009',
    images: ['/placeholder-clothes.jpg'],
    productName: '와이드 슬랙스',
    brand: '8 seconds',
    price: '45,000',
    size: 'M',
    purchaseYear: '2024',
    purchaseMonth: '3',
    category: 'BOTTOM',
    materials: ['폴리에스터', '레이온'],
    colors: ['블랙'],
    styleTags: ['#오피스', '#미니멀'],
  },
  {
    id: 'clothes_010',
    images: ['/placeholder-clothes.jpg'],
    productName: '플로럴 원피스',
    brand: '에잇세컨즈',
    price: '79,000',
    size: 'S',
    purchaseYear: '2024',
    purchaseMonth: '5',
    category: 'ONEPIECE',
    materials: ['폴리에스터', '쉬폰'],
    colors: ['네이비', '핑크'],
    styleTags: ['#로맨틱', '#데이트'],
  },
  {
    id: 'clothes_011',
    images: ['/placeholder-clothes.jpg'],
    productName: '레더 벨트',
    brand: '카시오',
    price: '35,000',
    size: 'FREE',
    purchaseYear: '2023',
    purchaseMonth: '8',
    category: 'ACCESSORY',
    materials: ['가죽'],
    colors: ['브라운'],
    styleTags: ['#클래식', '#포멀'],
  },
  {
    id: 'clothes_012',
    images: ['/placeholder-clothes.jpg'],
    productName: '데님 자켓',
    brand: '리바이스',
    price: '139,000',
    size: 'M',
    purchaseYear: '2024',
    purchaseMonth: '4',
    category: 'TOP',
    materials: ['데님'],
    colors: ['라이트블루'],
    styleTags: ['#캐주얼', '#레이어드'],
  },
];

// 피드 목록
export const mockFeeds = [
  {
    id: 'feed_001',
    author: mockUsers[0],
    images: ['/placeholder-feed.jpg', '/placeholder-feed.jpg'],
    content: '오늘의 데일리룩! 날씨가 좋아서 가볍게 입었어요 ☀️',
    clothes: [mockClothes[0], mockClothes[1]],
    likeCount: 124,
    commentCount: 18,
    isLiked: false,
    createdAt: '2024-12-20 14:30',
  },
  {
    id: 'feed_002',
    author: mockUsers[1],
    images: ['/placeholder-feed.jpg'],
    content: '결혼식 하객룩으로 골랐어요. 어울리나요?',
    clothes: [mockClothes[3], mockClothes[7]],
    likeCount: 89,
    commentCount: 12,
    isLiked: true,
    createdAt: '2024-12-19 18:45',
  },
  {
    id: 'feed_003',
    author: mockUsers[2],
    images: ['/placeholder-feed.jpg', '/placeholder-feed.jpg', '/placeholder-feed.jpg'],
    content: '새로 산 카디건이랑 슬랙스 조합! 오피스룩으로 딱이에요 👔',
    clothes: [mockClothes[6], mockClothes[8]],
    likeCount: 256,
    commentCount: 34,
    isLiked: false,
    createdAt: '2024-12-18 09:15',
  },
  {
    id: 'feed_004',
    author: mockUsers[0],
    images: ['/placeholder-feed.jpg'],
    content: '주말 나들이룩~ 편하면서 예쁘게!',
    clothes: [mockClothes[2], mockClothes[1], mockClothes[5]],
    likeCount: 178,
    commentCount: 22,
    isLiked: true,
    createdAt: '2024-12-17 16:20',
  },
  {
    id: 'feed_005',
    author: mockCurrentUser,
    images: ['/placeholder-feed.jpg', '/placeholder-feed.jpg'],
    content: '오랜만에 원피스 입었어요! 봄 느낌 물씬 🌸',
    clothes: [mockClothes[9]],
    likeCount: 312,
    commentCount: 45,
    isLiked: false,
    createdAt: '2024-12-16 12:00',
  },
  {
    id: 'feed_006',
    author: mockUsers[1],
    images: ['/placeholder-feed.jpg'],
    content: '스트릿 무드로 꾸며봤어요',
    clothes: [mockClothes[2], mockClothes[5]],
    likeCount: 445,
    commentCount: 67,
    isLiked: false,
    createdAt: '2024-12-15 20:30',
  },
];

// 댓글 목록
export const mockComments = [
  {
    id: 'comment_001',
    feedId: 'feed_001',
    author: mockUsers[1],
    content: '너무 예뻐요! 어디서 사셨어요?',
    likeCount: 5,
    isLiked: false,
    createdAt: '2024-12-20 15:30',
    replies: [
      {
        id: 'reply_001',
        author: mockUsers[0],
        content: '무인양품이요! 세일할 때 샀어요 ㅎㅎ',
        likeCount: 2,
        isLiked: false,
        createdAt: '2024-12-20 15:45',
      },
    ],
  },
  {
    id: 'comment_002',
    feedId: 'feed_001',
    author: mockUsers[2],
    content: '색감 조합이 넘 좋네요 👍',
    likeCount: 3,
    isLiked: true,
    createdAt: '2024-12-20 16:00',
    replies: [],
  },
  {
    id: 'comment_003',
    feedId: 'feed_001',
    author: mockCurrentUser,
    content: '저도 이런 스타일 좋아해요!',
    likeCount: 1,
    isLiked: false,
    createdAt: '2024-12-20 17:30',
    replies: [],
  },
];

// AI 코디 검색 기록
export const mockSearchHistory = [
  '내일 결혼식장 갈건데 무슨 옷 입을까?',
  '지금 비온다',
  '어쩌고 저쩌고 어쩌고저쩌고',
];

// AI 코디 추천 결과
export const mockCoordinationResult = {
  id: 'coord_001',
  userQuery: '결혼식에 어울리는 코디입니다.',
  description: '연출에 맞는 바지가 없어서 어쩌고 저쩌고 캐주얼한 코디를 추천드려요.',
  images: ['/placeholder-coordination.jpg', '/placeholder-coordination.jpg', '/placeholder-coordination.jpg'],
  clothes: [
    { ...mockClothes[4], position: 'top' },
    { ...mockClothes[8], position: 'bottom' },
    { ...mockClothes[5], position: 'shoes' },
  ],
  isLiked: false,
};

// 추천 문장 (AI 코디 입력)
export const suggestedQueries = [
  '내일 결혼식장 갈건데 무슨 옷 입을까?',
  '지금 비온다',
  '어쩌고 저쩌고 어쩌고저쩌고',
];

// 좋아요 누른 사용자 목록
export const mockLikedUsers = [
  { id: 'user_002', nickname: 'fashion_lover', profileImage: null },
  { id: 'user_003', nickname: 'style_master', profileImage: null },
  { id: 'user_004', nickname: 'trendy_kim', profileImage: null },
  { id: 'user_005', nickname: 'daily_look', profileImage: null },
  { id: 'user_006', nickname: 'ootd_lover', profileImage: null },
  { id: 'user_007', nickname: 'fashionista_99', profileImage: null },
  { id: 'user_008', nickname: 'style_diary', profileImage: null },
];

// 내 피드 목록
export const mockMyFeeds = mockFeeds.filter(feed => feed.author.id === mockCurrentUser.id);

// 사용자별 피드 조회 함수
export const getUserFeeds = (userId) => {
  return mockFeeds.filter(feed => feed.author.id === userId);
};

// 사용자별 옷장 조회 함수 (타인 옷장은 랜덤하게 일부만)
export const getOtherUserClothes = (userId) => {
  // 타인의 옷장은 목업으로 일부 아이템만 반환
  return mockClothes.slice(0, 8).map(item => ({
    ...item,
    id: `${userId}_${item.id}`,
  }));
};
