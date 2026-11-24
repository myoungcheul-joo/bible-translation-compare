# 역본대조 (Bible Translation Compare)

옵시디언에서 성경 구절(예: `요 4:14`)에 커서를 두거나 선택하면, 여러 번역본을 나란히 대조해 보고 원하는 번역본만 골라 노트에 한 번에 넣어 주는 플러그인입니다.

> 소스는 열람할 수 있지만 오픈소스가 아닙니다. 저작권은 주명철에게 있고, 설치해서 쓰는 것은 무료입니다. 자세한 내용은 [LICENSE](LICENSE)를 보세요.

## 할 수 있는 일

- 본문 참조(책 이름 약어 포함)를 인식하여 번역본별 본문을 한 창에 대조
- 번역본을 골라 노트에 삽입 (일반 글 / 인용문 / 콜아웃)
- 번역본 조합(프리셋)과 단축키
- 여러 절 삽입 시 절 번호 표시, 출처 문구 자동 붙이기

인터넷에 연결하지 않으며 AI도 쓰지 않습니다. 모든 것은 내 볼트 안에서만 처리됩니다.

## 성경 본문 준비 (중요)

이 플러그인에는 성경 본문이 들어 있지 않습니다. 본문 파일을 볼트에 직접 두어야 합니다. 기본 위치는 `성경본문` 폴더이고, 설정에서 바꿀 수 있습니다.

```
성경본문/
  개역한글/
    01창세기.json
    02출애굽기.json
    ...
    66요한계시록.json
```

- 파일 이름은 `책번호(두 자리) + 책 이름 + .json` 입니다. (예: `43요한복음.json`)
- 파일 안은 이런 모양입니다.

```json
{"book":"창세기","translation":"개역한글","chapters":{"1":{"1":"태초에 하나님이 천지를 창조하시니라"}}}
```

- 개역한글판은 대한성서공회 안내에 따라 저작재산권 보호기간이 끝났습니다. 그 밖의 번역본은 저작권자의 이용 조건을 확인한 뒤 본인의 볼트에만 두고 쓰세요.
- 다른 번역본을 쓰려면 같은 모양으로 폴더를 만든 뒤, 플러그인 설정의 번역본 추가에서 표시 이름과 폴더 이름을 입력하면 됩니다.

## 설치

- 옵시디언 설정 → 커뮤니티 플러그인에서 "Bible Translation Compare"를 검색해 설치합니다. (등록 심사가 끝난 뒤)
- 수동 설치: 최신 릴리스의 `main.js`, `manifest.json`, `styles.css`를 볼트의 `.obsidian/plugins/bible-translation-compare/` 폴더에 넣고 플러그인을 켭니다.

## 만든 사람

주명철 · 목회자 PKM 연구소 — https://pkm-institute.netlify.app

---

## English

Look up the Bible reference at your cursor or in your selection, compare it across several translations side by side, and insert the ones you choose into your note. Works offline; no network access and no AI.

This plugin does not ship any Bible text. Place per-book JSON files in your vault (default folder `성경본문/<translation>/<NN><book>.json`) and add the translation in settings. See the section above for the file layout.

License: all rights reserved. Free to install and use for personal, church and non-profit purposes. Source is viewable but this is not open-source software. See [LICENSE](LICENSE).
