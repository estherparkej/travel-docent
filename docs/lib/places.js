/* 홈에 쓰는 장소 목록.
   방문객이 많고 이야기가 남아 있는 곳을 지역별로 다섯 곳까지 골랐다.
   이름은 한국어 위키백과 표제어에 맞춰야 해설을 찾을 수 있다. */

export const KR = {
  '전체': ['경주 불국사', '경복궁', '수원 화성', '성산일출봉', '안동 하회마을'],
  '서울': ['경복궁', '창덕궁', '종묘', '북촌한옥마을', '숭례문'],
  '경기': ['수원 화성', '남한산성', '행주산성', '용주사', '한국민속촌'],
  '강원': ['오죽헌', '낙산사', '월정사', '강릉 선교장', '청간정'],
  '충청': ['공산성', '부소산성', '무령왕릉', '법주사', '독립기념관'],
  '전라': ['전주 한옥마을', '금산사', '내소사', '선운사', '무위사'],
  '경상': ['경주 불국사', '석굴암', '첨성대', '해인사', '안동 하회마을'],
  '제주': ['성산일출봉', '만장굴', '한라산', '제주 용두암', '천지연폭포'],
};

export const WW = {
  '전체': ['에펠탑', '콜로세움', '만리장성', '타지마할', '기자의 대피라미드'],
  '일본': ['금각사', '도다이지', '히메지성', '센소지', '이쓰쿠시마 신사'],
  '중국': ['만리장성', '자금성', '병마용', '천단', '이화원'],
  '프랑스': ['에펠탑', '루브르 박물관', '베르사유 궁전', '노트르담 대성당', '몽생미셸'],
  '이탈리아': ['콜로세움', '피사의 사탑', '폼페이', '트레비 분수', '밀라노 대성당'],
  '영국': ['스톤헨지', '웨스트민스터 궁전', '타워 브리지', '웨스트민스터 사원', '버킹엄 궁전'],
  '미국': ['자유의 여신상', '그랜드캐니언', '금문교', '러시모어산', '백악관'],
  '이집트': ['기자의 대피라미드', '스핑크스', '카르나크 신전', '아부심벨 신전', '룩소르 신전'],
};

/* 배너 8장 — 국내·해외를 번갈아.
   lead 는 사진 위에 얹는 한 줄 수식어다. */
/* 배너 후보. 매일 아침 7시에 여기서 여덟 장을 새로 뽑는다.
   lead 는 제목 앞에 붙는 수식어, desc 는 사진 아래 한 줄이다. */
export const BANNERS = [
  { place: '경주 불국사', lead: '천 년을 견딘 돌', tag: '국내', query: 'Bulguksa temple Korea',
    desc: '돌 하나에 한 사람의 평생이 담긴 이야기' },
  { place: '경복궁', lead: '조선이 시작된 마당', tag: '국내', query: 'Gyeongbokgung palace Seoul',
    desc: '불타고 다시 세우기를 거듭하며 버텨온 이야기' },
  { place: '수원 화성', lead: '아버지를 향한 성', tag: '국내', query: 'Hwaseong fortress Suwon',
    desc: '아들이 아버지를 그리며 성벽을 쌓아 올린 이야기' },
  { place: '창덕궁', lead: '숲을 품은 궁', tag: '국내', query: 'Changdeokgung palace Seoul',
    desc: '산세를 거스르지 않으려 땅을 깎지 않은 이야기' },
  { place: '종묘', lead: '침묵으로 지은 집', tag: '국내', query: 'Jongmyo shrine Seoul',
    desc: '스물한 칸 기둥이 침묵으로 이어지는 이야기' },
  { place: '석굴암', lead: '어둠 속의 미소', tag: '국내', query: 'Seokguram grotto Korea',
    desc: '동짓날 첫 햇살이 부처의 이마에 닿도록 계산한 이야기' },
  { place: '첨성대', lead: '별을 세던 자리', tag: '국내', query: 'Cheomseongdae Gyeongju',
    desc: '돌 삼백예순두 개로 일 년을 세운 이야기' },
  { place: '안동 하회마을', lead: '물이 감아 도는 마을', tag: '국내', query: 'Hahoe folk village Andong',
    desc: '강이 마을을 안고 육백 년을 돌아 나간 이야기' },
  { place: '성산일출봉', lead: '바다가 밀어 올린 봉우리', tag: '국내', query: 'Seongsan Ilchulbong Jeju',
    desc: '오천 년 전 바닷속에서 불이 솟아오른 이야기' },
  { place: '한라산', lead: '섬을 만든 산', tag: '국내', query: 'Hallasan Jeju',
    desc: '산 하나가 곧 섬이 된 이야기' },
  { place: '남한산성', lead: '겨울을 버틴 성', tag: '국내', query: 'Namhansanseong fortress',
    desc: '임금이 사십칠 일을 버틴 겨울 이야기' },
  { place: '해인사', lead: '나무에 새긴 팔만 자', tag: '국내', query: 'Haeinsa temple Korea',
    desc: '바람이 지나가도록 지어 팔백 년을 견딘 이야기' },
  { place: '에펠탑', lead: '철로 그린 곡선', tag: '해외', query: 'Eiffel Tower Paris',
    desc: '이십 년 뒤 헐기로 하고 세웠다가 백 년을 남은 이야기' },
  { place: '콜로세움', lead: '함성이 남은 자리', tag: '해외', query: 'Colosseum Rome',
    desc: '오만 명의 함성이 바람 소리로 남은 이야기' },
  { place: '만리장성', lead: '산등성이를 걷는 담', tag: '해외', query: 'Great Wall of China',
    desc: '한 사람의 두려움이 이천 년의 담을 쌓은 이야기' },
  { place: '기자의 대피라미드', lead: '사천 년의 각도', tag: '해외', query: 'Pyramids of Giza Egypt',
    desc: '사천 년 전에 손가락 두 마디까지 맞춘 이야기' },
  { place: '타지마할', lead: '슬픔이 지은 흰 집', tag: '해외', query: 'Taj Mahal India',
    desc: '아내를 잃은 남자가 이십이 년을 바친 이야기' },
  { place: '앙코르 와트', lead: '숲이 삼킨 도시', tag: '해외', query: 'Angkor Wat Cambodia',
    desc: '사백 년 동안 나무뿌리가 대신 지켜온 이야기' },
  { place: '사그라다 파밀리아', lead: '아직 끝나지 않은 성당', tag: '해외', query: 'Sagrada Familia Barcelona',
    desc: '설계자가 떠난 뒤에도 백사십 년째 자라는 이야기' },
  { place: '마추픽추', lead: '구름 위의 도시', tag: '해외', query: 'Machu Picchu Peru',
    desc: '시멘트 없이 돌 사이에 종이 한 장 남기지 않은 이야기' },
  { place: '자금성', lead: '문이 아홉 겹', tag: '해외', query: 'Forbidden City Beijing',
    desc: '구천 개의 방을 평생 다 보지 못한 이야기' },
  { place: '루브르 박물관', lead: '왕이 살던 창고', tag: '해외', query: 'Louvre museum Paris',
    desc: '한 점에 삼십 초씩 봐도 백 일이 걸리는 이야기' },
  { place: '자유의 여신상', lead: '바다를 보는 얼굴', tag: '해외', query: 'Statue of Liberty New York',
    desc: '삼백오십 조각으로 나뉘어 바다를 건너온 이야기' },
  { place: '피사의 사탑', lead: '기울어서 유명해진 탑', tag: '해외', query: 'Leaning Tower of Pisa',
    desc: '짓는 도중 기울기 시작해 이백 년이 걸린 이야기' },
];

/* 오늘이 며칠째인가 — 아침 7시를 하루의 시작으로 본다.
   새벽에 앱을 열었을 때 어제 것이 그대로 보여야 자연스럽다. */
export function dayIndex(now = new Date()) {
  const t = new Date(now);
  t.setHours(t.getHours() - 7);
  /* UTC 기준으로 나누면 우리 시간대(+9)가 어긋나 경계가 엉뚱한 때에 걸린다.
     일곱 시간을 뺀 뒤 그 날짜(연·월·일)만 취해서 하루를 센다. */
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round(d.getTime() / 86400000);
}

/* 날마다 자리를 옮겨 가며 뽑는다. 목록이 한 바퀴 다 돌고 나서 반복된다. */
export function pickForDay(list, count, offset = 0) {
  const n = list.length;
  const start = ((dayIndex() * count + offset) % n + n) % n;
  return Array.from({ length: Math.min(count, n) }, (_, i) => list[(start + i) % n]);
}

/* ── 아이와 함께 ─────────────────────────────────────────
   국내만. 학년에 따라 갈 만한 곳도, 들려줄 이야기의 깊이도 달라진다. */
export const KIDS = {
  elementary: {
    label: '초등학생',
    tone: '초등학교 저학년도 알아듣게. 어려운 말은 쉬운 말로 바꾸고, 숫자는 손으로 셀 수 있는 만큼만. 질문을 던져 상상하게 하세요.',
    places: ['경복궁', '수원 화성', '첨성대', '국립중앙박물관', '남산골한옥마을',
             '전쟁기념관', '해인사', '안동 하회마을', '불국사', '국립민속박물관'],
  },
  middle: {
    label: '중학생',
    tone: '중학생 눈높이로. 교과서에 나오는 사건과 이어 주되, 연도를 나열하지 말고 왜 그렇게 되었는지를 짚어 주세요.',
    places: ['경복궁', '창덕궁', '종묘', '수원 화성', '남한산성',
             '독립기념관', '서대문형무소역사관', '국립경주박물관', '석굴암', '공산성'],
  },
  high: {
    label: '고등학생',
    tone: '고등학생에게. 사건의 배경과 결과를 인과로 엮고, 서로 다른 해석이 있다면 그것도 함께 알려 주세요.',
    places: ['경복궁', '덕수궁', '서대문형무소역사관', '독립기념관', '종묘',
             '남한산성', '강화도 초지진', '국립중앙박물관', '수원 화성', '병산서원'],
  },
};



/* 추천 도슨트 1~10위.
   순서는 지어낸 것이 아니라 한국어 위키백과의 최근 1년 월평균 조회수로 매겼다.
   (경복궁 5,149 · 첨성대 2,990 · 에펠탑 4,959 · 콜로세움 2,890 …)
   사람들이 실제로 궁금해한 만큼을 순위로 삼는 편이 가장 정직하다. */
export const TOP_KR = [
  '경복궁', '첨성대', '수원 화성', '불국사', '종묘',
  '창덕궁', '한라산', '남한산성', '석굴암', '해인사',
];

export const TOP_WW = [
  '에펠탑', '콜로세움', '자유의 여신상', '만리장성', '사그라다 파밀리아',
  '타지마할', '자금성', '피사의 사탑', '루브르 박물관', '앙코르 와트',
];
