# 배포 — GitHub Pages (무료)

`web/` 폴더만 올리면 됩니다. 파이썬 파일은 맥에서 개발용으로만 씁니다.

## 처음 한 번

```bash
cd "/Users/eunjungpark/claude/travel-docent 2"
git init
git add .
git commit -m "여행 도슨트"
```

GitHub 에서 새 저장소를 만든 뒤 (Public, README 체크 해제):

```bash
git remote add origin https://github.com/<아이디>/travel-docent.git
git branch -M main
git push -u origin main
```

## Pages 켜기

저장소 → **Settings → Pages**
- Source: `Deploy from a branch`
- Branch: `main` / 폴더: `/web`
- Save

1~2분 뒤 주소가 나옵니다:
`https://<아이디>.github.io/travel-docent/`

## 고칠 때마다

```bash
git add . && git commit -m "수정" && git push
```

## 확인 사항

- `.env` 는 `.gitignore` 에 있어 **올라가지 않습니다**
- 배포된 파일 어디에도 API 키가 없습니다
- 키는 각자의 폰 브라우저에만 저장됩니다
