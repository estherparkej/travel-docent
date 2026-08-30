/* API 키는 이 기기의 브라우저에만 저장한다.
   코드에는 절대 넣지 않는다 — 배포 파일에 키가 남지 않게. */

const KEYS = 'apikeys';

export function getKeys() {
  try { return JSON.parse(localStorage.getItem(KEYS) || '{}'); }
  catch (_) { return {}; }
}

export function getKey(name) {
  const v = (getKeys()[name] || '').trim();
  return v.length >= 20 ? v : '';
}

export function setKey(name, value) {
  const all = getKeys();
  const v = (value || '').trim();
  if (v) all[name] = v; else delete all[name];
  localStorage.setItem(KEYS, JSON.stringify(all));
}

/* 지역 이름처럼 짧은 값은 길이로 거를 수 없다. 그대로 돌려준다. */
export function getPlain(name, fallback = '') {
  return (getKeys()[name] || '').trim() || fallback;
}

export function provider() {
  return getKey('gemini') ? 'gemini' : 'wiki';
}
