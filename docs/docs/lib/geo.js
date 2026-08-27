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
  // 전체 주소는 너무 길다. 앞쪽 세 마디만.
  const short = (d.display_name || '').split(',').slice(0, 3).join(',').trim();
  return { place, address: short };
}
