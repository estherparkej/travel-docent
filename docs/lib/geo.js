/* 좌표 → 지명. 화면 표시용. 키가 필요 없다. */

export async function reverse(lat, lon) {
  const q = new URLSearchParams({
    format: 'jsonv2', lat, lon, zoom: 18, addressdetails: 1, 'accept-language': 'ko',
  });
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${q}`);
  if (!r.ok) throw new Error('지명 조회 실패');
  const d = await r.json();
  const a = d.address || {};
  const place = d.name || a.tourism || a.historic || a.building || a.attraction
    || a.amenity || a.neighbourhood || a.suburb || a.village || a.town || a.city || '';
  /* display_name 은 작은 단위부터 온다 — '공산성, 280, 웅진로, …'.
     우리말 주소는 큰 단위부터 읽으므로 필요한 마디만 골라 다시 세운다. */
  /* 도로명 주소가 있으면 '시도 시군구 도로명 건물번호'로 끝난다.
     여기에 법정동까지 끼워 넣으면 두 체계가 섞여 어색해진다. */
  const big = [a.province || a.state, a.city || a.county || a.town,
               a.borough || a.city_district].filter(Boolean);
  const parts = a.road
    ? [...big, a.road, a.house_number]
    : [...big, a.suburb || a.village || a.quarter];
  // 같은 말이 두 번 나오면 한 번만
  const seen = new Set();
  const address = parts.filter(Boolean).filter(p => !seen.has(p) && seen.add(p)).join(' ');
  return { place, address: address || d.display_name || '' };
}
