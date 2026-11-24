'use strict';

const { Plugin, Modal, ItemView, Notice, PluginSettingTab, Setting, MarkdownView, normalizePath } = require('obsidian');

const VIEW_TYPE = 'btc-compare-view';

// ── 성경 66권 (파일명 번호 순서와 동일) ──────────────────────────
const BOOK_ORDER = [
  '창세기', '출애굽기', '레위기', '민수기', '신명기', '여호수아', '사사기', '룻기',
  '사무엘상', '사무엘하', '열왕기상', '열왕기하', '역대기상', '역대기하', '에스라', '느헤미야',
  '에스더', '욥기', '시편', '잠언', '전도서', '아가', '이사야', '예레미야',
  '예레미야애가', '에스겔', '다니엘', '호세아', '요엘', '아모스', '오바댜', '요나',
  '미가', '나훔', '하박국', '스바냐', '학개', '스가랴', '말라기',
  '마태복음', '마가복음', '누가복음', '요한복음', '사도행전', '로마서', '고린도전서', '고린도후서',
  '갈라디아서', '에베소서', '빌립보서', '골로새서', '데살로니가전서', '데살로니가후서',
  '디모데전서', '디모데후서', '디도서', '빌레몬서', '히브리서', '야고보서',
  '베드로전서', '베드로후서', '요한일서', '요한이서', '요한삼서', '유다서', '요한계시록',
];

// ── 흔히 쓰는 약칭 → 정식 책이름 ──────────────────────────────
const BOOK_ALIASES = {
  창: '창세기', 출: '출애굽기', 레: '레위기', 민: '민수기', 신: '신명기', 수: '여호수아',
  삿: '사사기', 룻: '룻기', 삼상: '사무엘상', 삼하: '사무엘하', 왕상: '열왕기상', 왕하: '열왕기하',
  대상: '역대기상', 대하: '역대기하', 스: '에스라', 느: '느헤미야', 에: '에스더', 욥: '욥기',
  시: '시편', 잠: '잠언', 전: '전도서', 아: '아가', 사: '이사야', 렘: '예레미야',
  애: '예레미야애가', 겔: '에스겔', 단: '다니엘', 호: '호세아', 욜: '요엘', 암: '아모스',
  옵: '오바댜', 욘: '요나', 미: '미가', 나: '나훔', 합: '하박국', 습: '스바냐',
  학: '학개', 슥: '스가랴', 말: '말라기', 마: '마태복음', 막: '마가복음', 눅: '누가복음',
  요: '요한복음', 행: '사도행전', 롬: '로마서', 고전: '고린도전서', 고후: '고린도후서',
  갈: '갈라디아서', 엡: '에베소서', 빌: '빌립보서', 골: '골로새서',
  살전: '데살로니가전서', 살후: '데살로니가후서', 딤전: '디모데전서', 딤후: '디모데후서',
  딛: '디도서', 몬: '빌레몬서', 히: '히브리서', 약: '야고보서',
  벧전: '베드로전서', 벧후: '베드로후서', 요일: '요한일서', 요이: '요한이서',
  요삼: '요한삼서', 유: '유다서', 계: '요한계시록',
};

const REF_RE = /([가-힣]{1,7})\s*(\d{1,3})\s*장?\s*(?:[:]?\s*(\d{1,3})\s*절?(?:\s*[-~]\s*(\d{1,3})\s*절?)?)?/;

// 출처 문구 기본값 (설정에서 번역본마다 고칠 수 있음)
const SOURCE_DEFAULTS = {
  krh: '개역한글판, 대한성서공회',
  krv: '대한성서공회',
  standard: '대한성서공회',
  modern: '생명의말씀사',
  nrsv: 'National Council of Churches',
  esv: 'Crossway',
  niv: 'Biblica',
};

// 번역본 표시 순서 (2026-09-04 확정): 개역개정 → 표준새번역 → 새한글성경 → 공동번역 → 현대인의성경 → NRSV → ESV → NIV
// (현대어성경·원어 제외)
const DEFAULT_SETTINGS = {
  modalSize: null, // { width, height } — 사용자가 조절한 마지막 크기
  modalPos: null, // { left, top } — 사용자가 드래그로 옮긴 마지막 위치 (없으면 화면 오른쪽에 기본 배치)
  insertPosition: 'below', // 'below' 참조가 적힌 줄 아래에 / 'cursor' 커서(선택) 위치에
  insertStyle: 'plain', // 'plain' 일반 글 / 'quote' 인용문 / 'callout' 콜아웃
  showVerseNumbers: true, // 여러 절을 넣을 때 절 번호 표시
  joinVerses: false, // true면 절을 줄바꿈 없이 이어 붙임
  showSource: false, // 출처 문구 자동 붙이기
  warnVerseLimit: 30, // 한 번역본에서 이 절 수를 넘으면 알림 (0이면 끔)
  presets: [
    { name: '개역한글', keys: ['krh'] },
  ],
  translationRoot: '성경본문',
  translations: [
    { key: 'krh', label: '개역한글', folder: '개역한글', enabled: true },
  ],
};

function resolveBookName(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (BOOK_ORDER.indexOf(s) !== -1) return s;
  if (BOOK_ALIASES[s]) return BOOK_ALIASES[s];
  return null;
}

function bookNumber(name) {
  const idx = BOOK_ORDER.indexOf(name);
  return idx === -1 ? null : idx + 1;
}

function parseReference(text) {
  if (!text) return null;
  const m = text.match(REF_RE);
  if (!m) return null;
  const book = resolveBookName(m[1]);
  if (!book) return null;
  const chapter = parseInt(m[2], 10);
  const verseStart = m[3] ? parseInt(m[3], 10) : null;
  const verseEnd = m[4] ? parseInt(m[4], 10) : verseStart;
  return { book, chapter, verseStart, verseEnd, matched: m[0] };
}

function sortedChapterNumbers(chapterObj) {
  return Object.keys(chapterObj).map(Number).sort((a, b) => a - b);
}

function extractVerses(chapterObj, vStart, vEnd) {
  if (!chapterObj) return null;
  const verses = [];
  if (vStart == null) {
    for (const n of sortedChapterNumbers(chapterObj)) verses.push({ v: n, t: chapterObj[String(n)] });
  } else {
    const end = vEnd || vStart;
    for (let v = vStart; v <= end; v++) {
      const t = chapterObj[String(v)];
      if (t !== undefined) verses.push({ v, t });
    }
  }
  return verses.length ? verses : null;
}

// 절 목록 → 글. 절이 둘 이상일 때만 절 번호를 붙인다.
function formatVerses(verses, showNumbers, join) {
  const num = showNumbers && verses.length > 1;
  const parts = verses.map((x) => (num ? `${x.v} ${x.t}` : x.t));
  return parts.join(join ? ' ' : '\n');
}

function formatRefLabel(ref) {
  return (
    ref.book +
    ' ' +
    ref.chapter +
    (ref.verseStart
      ? ':' + ref.verseStart + (ref.verseEnd && ref.verseEnd !== ref.verseStart ? '-' + ref.verseEnd : '')
      : '')
  );
}

async function readJson(app, filePath) {
  try {
    const exists = await app.vault.adapter.exists(filePath);
    if (!exists) return null;
    const raw = await app.vault.adapter.read(filePath);
    // 윈도우 메모장 등이 앞에 붙이는 BOM(\uFEFF)을 떼고 읽는다 — 안 떼면 JSON.parse가 실패해 본문이 안 나온다
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (e) {
    return null;
  }
}

// keys를 주면 그 번역본만(설정의 순서대로), 안 주면 켜 둔 번역본 전부
async function lookupReference(app, settings, ref, keys) {
  const num = bookNumber(ref.book);
  if (!num) return [];
  const padded = String(num).padStart(2, '0');
  const results = [];

  for (const t of settings.translations) {
    if (keys) {
      if (keys.indexOf(t.key) === -1) continue;
    } else if (!t.enabled) continue;
    const filePath = normalizePath(`${settings.translationRoot}/${t.folder}/${padded}${ref.book}.json`);
    const data = await readJson(app, filePath);
    const chapterObj = data && data.chapters ? data.chapters[String(ref.chapter)] : null;
    const verses = extractVerses(chapterObj, ref.verseStart, ref.verseEnd);
    results.push({ key: t.key, label: t.label, source: t.source || '', verses });
  }

  return results;
}

// 삽입할 글 만들기 — 모양(일반 글/인용문/콜아웃), 절 번호, 줄바꿈, 출처 문구
function buildInsertion(blocks, refLabel, settings) {
  const style = settings.insertStyle || 'plain';
  const chunks = blocks.map((b) => {
    const body = formatVerses(b.verses, settings.showVerseNumbers !== false, !!settings.joinVerses);
    const quoted = body
      .split('\n')
      .map((l) => '> ' + l)
      .join('\n');
    if (style === 'callout') return `> [!quote] ${b.label}${refLabel ? ` (${refLabel})` : ''}\n${quoted}`;
    const head = refLabel ? `**${b.label}** (${refLabel})` : `**${b.label}**`;
    if (style === 'quote') return `> ${head}\n${quoted}`;
    return `${head}\n${body}`;
  });
  let out = chunks.join('\n\n');
  if (settings.showSource) {
    const srcs = blocks.filter((b) => b.source).map((b) => `${b.label}, ${b.source}`);
    if (srcs.length) out += `\n\n*출처: ${srcs.join(' / ')}*`;
  }
  return out;
}

// ── 대조 화면(모달·별도 창 공용) ────────────────────────────────
class ComparePanel {
  constructor(app, plugin, containerEl, opts) {
    this.app = app;
    this.plugin = plugin;
    this.opts = opts || {};
    this.build(containerEl);
  }

  build(root) {
    const opts = this.opts;
    this.headerEl = root.createDiv({ cls: 'btc-header' });

    if (opts.showTitle !== false) {
      const bar = this.headerEl.createDiv({ cls: 'btc-titlebar' });
      bar.createEl('h3', { text: '역본대조', cls: 'btc-drag-handle' });
      const tools = bar.createDiv({ cls: 'btc-tools' });
      const mk = (label, tip, fn) => {
        const b = tools.createEl('button', { text: label, cls: 'btc-tool-btn' });
        b.setAttr('title', tip);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
        });
        return b;
      };
      if (opts.onCollapse) this.collapseBtn = mk('―', '접기 / 펼치기', opts.onCollapse);
      if (opts.onPopout) mk('⧉', 'Obsidian 밖으로 — 별도 창으로 열기', opts.onPopout);
      if (opts.onClose) mk('✕', '닫기', opts.onClose);
    }

    const inputRow = this.headerEl.createDiv({ cls: 'btc-input-row btc-collapsible' });
    this.inputEl = inputRow.createEl('input', {
      type: 'text',
      placeholder: '예: 요 4:14  /  마 15:21-28  /  창 1',
    });
    this.inputEl.value = opts.initialQuery || '';
    const searchBtn = inputRow.createEl('button', { text: '찾기' });

    this.selected = new Set();
    this.checkEls = [];
    this.lastResults = [];
    const bar = root.createDiv({ cls: 'btc-select-bar btc-collapsible' });
    this.presetSel = bar.createEl('select', { cls: 'btc-preset-select' });
    this.refreshPresetSelect();
    this.presetSel.addEventListener('change', () => {
      const p = this.plugin.settings.presets[parseInt(this.presetSel.value, 10)];
      if (p) this.applyPreset(p);
    });
    const allBtn = bar.createEl('button', { text: '전체' });
    allBtn.setAttr('title', '지금 보이는 번역본 전부 체크');
    allBtn.addEventListener('click', () => {
      this.lastResults.forEach((r) => r.verses && this.selected.add(r.key));
      this.syncChecks();
    });
    const noneBtn = bar.createEl('button', { text: '해제' });
    noneBtn.addEventListener('click', () => {
      this.selected.clear();
      this.presetSel.value = '';
      this.syncChecks();
    });
    const saveBtn = bar.createEl('button', { text: '프리셋 저장' });
    saveBtn.setAttr('title', '지금 체크한 번역본 조합을 프리셋으로 저장');
    saveBtn.addEventListener('click', () => this.saveCurrentPreset());
    this.insertBtn = bar.createEl('button', { text: '선택 삽입 (0)', cls: 'mod-cta' });
    this.insertBtn.addEventListener('click', () => this.insertSelected());

    this.resultsEl = root.createDiv({ cls: 'btc-results btc-collapsible' });

    const run = () => this.runSearch();
    searchBtn.addEventListener('click', run);
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') run();
    });
  }

  start() {
    if (this.inputEl.value) this.runSearch();
    else this.inputEl.focus();
  }

  getQuery() {
    return this.inputEl.value.trim();
  }

  setQuery(q) {
    this.inputEl.value = q || '';
    if (q) this.runSearch();
  }

  async runSearch() {
    const query = this.inputEl.value.trim();
    this.resultsEl.empty();
    if (!query) return;
    const ref = parseReference(query);
    if (!ref) {
      this.resultsEl.createEl('p', {
        text: '본문 참조를 알아볼 수 없습니다. 예: 요 4:14',
        cls: 'btc-error',
      });
      return;
    }
    const refLabel =
      ref.book +
      ' ' +
      ref.chapter +
      (ref.verseStart
        ? ':' + ref.verseStart + (ref.verseEnd && ref.verseEnd !== ref.verseStart ? '-' + ref.verseEnd : '')
        : '');
    this.currentRefLabel = refLabel;
    this.resultsEl.createEl('p', { text: refLabel, cls: 'btc-ref-title' });
    const loading = this.resultsEl.createEl('p', { text: '불러오는 중…' });

    const results = await lookupReference(this.app, this.plugin.settings, ref);
    loading.remove();
    this.lastResults = results;
    this.checkEls = [];

    if (!results.length) {
      this.resultsEl.createEl('p', {
        text: '설정에서 사용할 번역본을 하나 이상 켜주세요.',
        cls: 'btc-error',
      });
      this.updateCount();
      return;
    }

    for (const r of results) {
      const block = this.resultsEl.createDiv({ cls: 'btc-block' });
      const head = block.createDiv({ cls: 'btc-label-row' });
      if (r.verses) {
        const cb = head.createEl('input', { type: 'checkbox' });
        cb.checked = this.selected.has(r.key);
        cb.setAttr('title', '체크해 두었다가 위의 "선택 삽입"으로 한 번에 넣습니다');
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', () => {
          if (cb.checked) this.selected.add(r.key);
          else this.selected.delete(r.key);
          this.updateCount();
        });
        this.checkEls.push({ key: r.key, cb });
      }
      head.createEl('span', { text: r.label, cls: 'btc-label' });
      block.createEl('div', {
        text: r.verses ? formatVerses(r.verses, true, false) : '— 본문 없음 —',
        cls: 'btc-body',
      });
      if (r.verses) {
        block.addClass('btc-clickable');
        block.setAttr('title', '블록을 클릭하면 이 번역본 하나만 노트에 삽입합니다 (여러 개는 체크 후 "선택 삽입")');
        block.addEventListener('click', () => this.insertBlocks([r]));
      }
    }
    this.updateCount();
  }

  updateCount() {
    if (!this.insertBtn) return;
    const n = (this.lastResults || []).filter((r) => r.verses && this.selected.has(r.key)).length;
    this.insertBtn.setText(`선택 삽입 (${n})`);
  }

  syncChecks() {
    this.checkEls.forEach(({ key, cb }) => {
      cb.checked = this.selected.has(key);
    });
    this.updateCount();
  }

  refreshPresetSelect() {
    const sel = this.presetSel;
    sel.empty();
    sel.createEl('option', { text: '프리셋…', value: '' });
    (this.plugin.settings.presets || []).forEach((p, i) => {
      sel.createEl('option', { text: `${i + 1}. ${p.name}`, value: String(i) });
    });
  }

  applyPreset(p) {
    this.selected = new Set(p.keys);
    this.syncChecks();
  }

  saveCurrentPreset() {
    const keys = this.plugin.settings.translations.map((t) => t.key).filter((k) => this.selected.has(k));
    if (!keys.length) {
      new Notice('먼저 저장할 번역본을 체크하세요.');
      return;
    }
    new NamePromptModal(this.app, '프리셋 이름', async (name) => {
      this.plugin.settings.presets.push({ name, keys });
      await this.plugin.saveSettings();
      this.refreshPresetSelect();
      new Notice(`프리셋 "${name}" 저장 (${keys.length}개 번역본)`);
    }).open();
  }

  insertBlocks(blocks) {
    const ok = this.plugin.insertBlocks(blocks, this.currentRefLabel);
    if (ok && this.opts.closeOnInsert && this.opts.onClose) this.opts.onClose();
  }

  insertSelected() {
    const blocks = (this.lastResults || []).filter((r) => r.verses && this.selected.has(r.key));
    if (!blocks.length) {
      new Notice('체크한 번역본이 없습니다.');
      return;
    }
    this.insertBlocks(blocks);
  }
}

// 이름 입력용 작은 창 (옵시디언 안에서는 window.prompt가 안 되므로)
class NamePromptModal extends Modal {
  constructor(app, title, onSubmit) {
    super(app);
    this.titleText = title;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: this.titleText });
    const input = contentEl.createEl('input', { type: 'text' });
    input.style.width = '100%';
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      this.close();
      this.onSubmit(v);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    const btn = contentEl.createEl('button', { text: '저장', cls: 'mod-cta' });
    btn.style.marginTop = '8px';
    btn.addEventListener('click', submit);
    setTimeout(() => input.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
}

// ── 별도 창(팝아웃)으로 띄우는 뷰 — Obsidian 밖으로 자유롭게 이동·크기조절 ──
class CompareView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return '역본대조';
  }
  getIcon() {
    return 'book-open';
  }
  async onOpen() {
    const c = this.contentEl;
    c.empty();
    c.addClass('btc-modal');
    c.addClass('btc-view');
    const q = this.plugin.pendingQuery || '';
    this.plugin.pendingQuery = '';
    this.panel = new ComparePanel(this.app, this.plugin, c, {
      initialQuery: q,
      showTitle: false,
      closeOnInsert: false,
    });
    this.panel.start();
  }
  async onClose() {
    this.contentEl.empty();
  }
}

class CompareModal extends Modal {
  constructor(app, plugin, initialQuery) {
    super(app);
    this.plugin = plugin;
    this.initialQuery = initialQuery || '';
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.addClass('btc-modal');
    modalEl.addClass('btc-modal-shell');

    this.panel = new ComparePanel(this.app, this.plugin, contentEl, {
      initialQuery: this.initialQuery,
      closeOnInsert: true,
      onClose: () => this.close(),
      onCollapse: () => this.toggleCollapse(),
      onPopout: () => {
        const q = this.panel.getQuery();
        this.close();
        this.plugin.openPopout(q);
      },
    });
    this.makeDraggable();
    this.applyPosition();
    this.panel.start();
  }

  toggleCollapse() {
    const collapsed = this.modalEl.classList.toggle('btc-collapsed');
    if (collapsed) {
      this.savedHeight = this.modalEl.style.height;
      this.modalEl.style.height = '';
    } else if (this.savedHeight) {
      this.modalEl.style.height = this.savedHeight;
    }
    if (this.panel.collapseBtn) this.panel.collapseBtn.setText(collapsed ? '▢' : '―');
  }

  applyPosition() {
    const modalEl = this.modalEl;
    modalEl.style.position = 'fixed';
    modalEl.style.margin = '0';
    modalEl.style.transform = 'none';

    const size = this.plugin.settings.modalSize;
    if (size && size.width > 0 && size.height > 0) {
      modalEl.style.width = Math.min(size.width, window.innerWidth - 8) + 'px';
      modalEl.style.height = Math.min(size.height, window.innerHeight - 8) + 'px';
    }

    const rect = modalEl.getBoundingClientRect();
    const clamp = (left, top) => ({
      left: Math.min(Math.max(4, left), Math.max(4, window.innerWidth - rect.width - 4)),
      top: Math.min(Math.max(4, top), Math.max(4, window.innerHeight - 60)),
    });
    const saved = this.plugin.settings.modalPos;
    const pos =
      saved && typeof saved.left === 'number' && typeof saved.top === 'number'
        ? clamp(saved.left, saved.top)
        : clamp(window.innerWidth - rect.width - 24, 56);
    modalEl.style.left = pos.left + 'px';
    modalEl.style.top = pos.top + 'px';
  }

  makeDraggable() {
    const modalEl = this.modalEl;
    let drag = null;
    // 입력창·버튼·본문 블록(클릭하면 삽입)·닫기 버튼은 드래그 시작점에서 제외
    const isBlocked = (t) =>
      t && t.closest && t.closest('input, button, textarea, select, a, .btc-block, .modal-close-button');

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (isBlocked(e.target)) return;
      const rect = modalEl.getBoundingClientRect();
      // 스크롤바 위 → 스크롤 동작 그대로 둠
      if (e.clientX > rect.left + modalEl.clientWidth) return;
      // 오른쪽 아래 모서리 → 브라우저 기본 크기조절 동작 그대로 둠
      if (rect.right - e.clientX < 22 && rect.bottom - e.clientY < 22) {
        modalEl.ownerDocument.addEventListener(
          'pointerup',
          () => {
            const r = modalEl.getBoundingClientRect();
            if (!modalEl.classList.contains('btc-collapsed')) {
              this.plugin.settings.modalSize = { width: r.width, height: r.height };
              this.plugin.settings.modalPos = { left: r.left, top: r.top };
              this.plugin.saveSettings();
            }
          },
          { once: true }
        );
        return;
      }
      drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, id: e.pointerId };
      try { modalEl.setPointerCapture(e.pointerId); } catch (_) {}
      modalEl.addClass('btc-dragging');
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!drag) return;
      const rect = modalEl.getBoundingClientRect();
      const maxLeft = Math.max(4, window.innerWidth - rect.width - 4);
      const maxTop = Math.max(4, window.innerHeight - 60);
      modalEl.style.left = Math.min(Math.max(4, drag.left + (e.clientX - drag.x)), maxLeft) + 'px';
      modalEl.style.top = Math.min(Math.max(4, drag.top + (e.clientY - drag.y)), maxTop) + 'px';
    };

    const onUp = () => {
      if (!drag) return;
      try { modalEl.releasePointerCapture(drag.id); } catch (_) {}
      drag = null;
      modalEl.removeClass('btc-dragging');
      const rect = modalEl.getBoundingClientRect();
      this.plugin.settings.modalPos = { left: rect.left, top: rect.top };
      this.plugin.saveSettings();
    };

    modalEl.addEventListener('pointerdown', onDown);
    modalEl.addEventListener('pointermove', onMove);
    modalEl.addEventListener('pointerup', onUp);
    modalEl.addEventListener('pointercancel', onUp);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class BTCSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: '역본대조 설정' });

    new Setting(containerEl)
      .setName('번역본 JSON 루트 폴더')
      .setDesc('예: 30-39 Biblical Studies/35 성경번역본/번역본JSON')
      .addText((text) =>
        text.setValue(this.plugin.settings.translationRoot).onChange(async (value) => {
          this.plugin.settings.translationRoot = value.trim();
          await this.plugin.saveSettings();
        })
      );

    const st = this.plugin.settings;
    containerEl.createEl('h3', { text: '삽입 방법' });
    new Setting(containerEl)
      .setName('삽입 위치')
      .setDesc('"참조 줄 아래"는 본문 참조가 적힌 줄 바로 아래에 넣고 참조 글은 그대로 둡니다. "커서(선택) 위치"는 예전 방식으로, 선택한 글을 대체합니다.')
      .addDropdown((d) =>
        d
          .addOption('below', '참조 줄 아래')
          .addOption('cursor', '커서(선택) 위치')
          .setValue(st.insertPosition || 'below')
          .onChange(async (v) => {
            st.insertPosition = v;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName('삽입 모양')
      .setDesc('일반 글 / 인용문(> ) / 콜아웃(> [!quote])')
      .addDropdown((d) =>
        d
          .addOption('plain', '일반 글')
          .addOption('quote', '인용문')
          .addOption('callout', '콜아웃')
          .setValue(st.insertStyle || 'plain')
          .onChange(async (v) => {
            st.insertStyle = v;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName('절 번호 표시')
      .setDesc('여러 절을 넣을 때 각 절 앞에 번호를 붙입니다. (한 절만 넣을 때는 붙이지 않음)')
      .addToggle((tg) =>
        tg.setValue(st.showVerseNumbers !== false).onChange(async (v) => {
          st.showVerseNumbers = v;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('절을 한 단락으로 이어 붙이기')
      .setDesc('끄면 절마다 줄을 바꿉니다.')
      .addToggle((tg) =>
        tg.setValue(!!st.joinVerses).onChange(async (v) => {
          st.joinVerses = v;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('출처 문구 붙이기')
      .setDesc('삽입한 본문 끝에 "출처: 개역개정, 대한성서공회" 같은 줄을 붙입니다. 출처 글자는 아래 번역본마다 고칠 수 있습니다.')
      .addToggle((tg) =>
        tg.setValue(!!st.showSource).onChange(async (v) => {
          st.showSource = v;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName('인용 분량 알림 (절 수)')
      .setDesc('한 번역본에서 이 절 수를 넘겨 넣으면 알림을 띄웁니다. 0이면 끕니다.')
      .addText((text) =>
        text.setValue(String(st.warnVerseLimit == null ? 30 : st.warnVerseLimit)).onChange(async (v) => {
          const n = parseInt(v, 10);
          st.warnVerseLimit = isNaN(n) || n < 0 ? 0 : n;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl('h3', { text: '사용할 번역본' });
    containerEl.createEl('p', {
      text: '위·아래 화살표로 순서를 바꾸고, 토글로 켜고 끌 수 있습니다. 대조 창에는 이 순서 그대로 표시됩니다.',
      cls: 'setting-item-description',
    });

    const translations = this.plugin.settings.translations;
    translations.forEach((t, idx) => {
      const setting = new Setting(containerEl).setName(t.label).setDesc(`폴더: ${t.folder}`);

      setting.addExtraButton((btn) =>
        btn
          .setIcon('arrow-up')
          .setTooltip('위로')
          .setDisabled(idx === 0)
          .onClick(async () => {
            if (idx === 0) return;
            const tmp = translations[idx - 1];
            translations[idx - 1] = translations[idx];
            translations[idx] = tmp;
            await this.plugin.saveSettings();
            this.display();
          })
      );

      setting.addExtraButton((btn) =>
        btn
          .setIcon('arrow-down')
          .setTooltip('아래로')
          .setDisabled(idx === translations.length - 1)
          .onClick(async () => {
            if (idx === translations.length - 1) return;
            const tmp = translations[idx + 1];
            translations[idx + 1] = translations[idx];
            translations[idx] = tmp;
            await this.plugin.saveSettings();
            this.display();
          })
      );

      setting.addText((text) =>
        text
          .setPlaceholder('출처 (예: 대한성서공회)')
          .setValue(t.source || '')
          .onChange(async (value) => {
            t.source = value.trim();
            await this.plugin.saveSettings();
          })
      );

      setting.addToggle((toggle) =>
        toggle.setValue(t.enabled).onChange(async (value) => {
          t.enabled = value;
          await this.plugin.saveSettings();
        })
      );

      setting.addExtraButton((btn) =>
        btn
          .setIcon('trash')
          .setTooltip('목록에서 제거 (JSON 데이터 파일은 삭제되지 않습니다)')
          .onClick(async () => {
            translations.splice(idx, 1);
            await this.plugin.saveSettings();
            this.display();
          })
      );
    });

    containerEl.createEl('h3', { text: '프리셋 (번역본 조합)' });
    containerEl.createEl('p', {
      text: '대조 창에서 번역본을 체크하고 "프리셋 저장"을 누르면 여기에 생깁니다. 1~5번 프리셋은 단축키 명령 "프리셋 N 즉시 삽입"에 연결됩니다 (옵시디언 설정 → 단축키에서 지정). 본문 참조가 적힌 줄에 커서를 두고 누르면 창 없이 바로 그 줄 아래에 들어갑니다.',
      cls: 'setting-item-description',
    });
    const presets = this.plugin.settings.presets;
    const labelOf = (key) => {
      const tr = translations.find((x) => x.key === key);
      return tr ? tr.label : key;
    };
    const movePreset = async (i, d) => {
      const j = i + d;
      if (j < 0 || j >= presets.length) return;
      const tmp = presets[j];
      presets[j] = presets[i];
      presets[i] = tmp;
      await this.plugin.saveSettings();
      this.display();
    };
    presets.forEach((p, i) => {
      const ps = new Setting(containerEl)
        .setName(`프리셋 ${i + 1}`)
        .setDesc(p.keys.map(labelOf).join(' + ') || '(비어 있음)');
      ps.addText((text) =>
        text.setValue(p.name).onChange(async (v) => {
          p.name = v.trim() || p.name;
          await this.plugin.saveSettings();
        })
      );
      ps.addExtraButton((btn) => btn.setIcon('arrow-up').setTooltip('위로').setDisabled(i === 0).onClick(() => movePreset(i, -1)));
      ps.addExtraButton((btn) =>
        btn.setIcon('arrow-down').setTooltip('아래로').setDisabled(i === presets.length - 1).onClick(() => movePreset(i, 1))
      );
      ps.addExtraButton((btn) =>
        btn
          .setIcon('trash')
          .setTooltip('프리셋 삭제')
          .onClick(async () => {
            presets.splice(i, 1);
            await this.plugin.saveSettings();
            this.display();
          })
      );
    });

    containerEl.createEl('h3', { text: '번역본 추가' });
    containerEl.createEl('p', {
      text: '번역본 JSON 폴더를 이미 만들어 두셨다면, 표시 이름과 폴더 이름을 입력해 목록에 추가하세요. (예: 표시 이름 "KJV", 폴더 이름 "KJV")',
      cls: 'setting-item-description',
    });

    let newLabel = '';
    let newFolder = '';
    new Setting(containerEl)
      .setName('새 번역본')
      .addText((text) => {
        text.setPlaceholder('표시 이름 (예: KJV)').onChange((value) => {
          newLabel = value.trim();
        });
      })
      .addText((text) => {
        text.setPlaceholder('폴더 이름 (예: KJV)').onChange((value) => {
          newFolder = value.trim();
        });
      })
      .addButton((btn) =>
        btn
          .setButtonText('추가')
          .setCta()
          .onClick(async () => {
            if (!newLabel || !newFolder) {
              new Notice('표시 이름과 폴더 이름을 모두 입력하세요.');
              return;
            }
            if (translations.some((t) => t.folder === newFolder)) {
              new Notice('이미 같은 폴더의 번역본이 목록에 있습니다.');
              return;
            }
            const key = 'custom_' + Date.now();
            translations.push({ key, label: newLabel, folder: newFolder, enabled: true });
            await this.plugin.saveSettings();
            this.display();
          })
      );

    containerEl.createEl('p', {
      text: '단축키는 옵시디언 설정 → 단축키(Hotkeys)에서 "역본대조 열기 / 삽입" 명령을 검색해 지정하세요.',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('창 위치 초기화')
      .setDesc('역본대조 창 제목을 드래그해 옮긴 위치를 기억합니다. 화면 밖으로 나갔거나 다시 오른쪽 기본 위치로 두고 싶으면 초기화하세요.')
      .addButton((btn) =>
        btn.setButtonText('초기화').onClick(async () => {
          this.plugin.settings.modalPos = null;
          this.plugin.settings.modalSize = null;
          await this.plugin.saveSettings();
          new Notice('창 위치·크기를 초기화했습니다. 다음에 열면 화면 오른쪽에 뜹니다.');
        })
      );
  }
}

module.exports = class BibleTranslationComparePlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.pendingQuery = '';
    this.lastMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView) || null;

    this.registerView(VIEW_TYPE, (leaf) => new CompareView(leaf, this));

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf && leaf.view instanceof MarkdownView) this.lastMarkdownView = leaf.view;
      })
    );

    this.addCommand({
      id: 'bible-translation-compare-open',
      name: '역본대조 열기 / 삽입',
      callback: () => {
        const editor = this.getTargetEditor();
        const query = editor ? this.detectReference(editor) : '';
        new CompareModal(this.app, this, query).open();
      },
    });

    this.addCommand({
      id: 'bible-translation-compare-popout',
      name: '역본대조 별도 창으로 열기 (Obsidian 밖으로)',
      callback: () => {
        const editor = this.getTargetEditor();
        this.openPopout(editor ? this.detectReference(editor) : '');
      },
    });

    for (let i = 0; i < 5; i++) {
      this.addCommand({
        id: `bible-translation-compare-preset-${i + 1}`,
        name: `프리셋 ${i + 1} 즉시 삽입 (참조 줄 아래에)`,
        callback: () => this.insertPreset(i),
      });
    }

    this.addSettingTab(new BTCSettingTab(this.app, this));
  }

  // 다른 플러그인(맥체인 성경읽기)이 본문 참조로 바로 열 때 쓴다
  openWith(query) {
    new CompareModal(this.app, this, query).open();
  }

  async openPopout(query) {
    try {
      const ws = this.app.workspace;
      const existing = ws.getLeavesOfType(VIEW_TYPE)[0];
      if (existing) {
        ws.revealLeaf(existing);
        if (existing.view && existing.view.panel && query) existing.view.panel.setQuery(query);
        return;
      }
      this.pendingQuery = query || '';
      const leaf = ws.openPopoutLeaf({ size: { width: 480, height: 780 } });
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    } catch (e) {
      console.error(e);
      new Notice('별도 창을 열지 못했습니다: ' + (e && e.message ? e.message : e));
    }
  }

  detectReference(editor) {
    const sel = editor.getSelection();
    if (sel && sel.trim()) return sel.trim();
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    // 줄 안에서 실제 책 이름으로 풀리는 첫 참조를 찾는다
    const re = new RegExp(REF_RE.source, 'g');
    let m;
    while ((m = re.exec(line))) {
      if (parseReference(m[0])) return m[0].trim();
    }
    return '';
  }

  // 삽입 대상: 지금 활성 노트, 없으면(별도 창이 활성일 때) 마지막으로 쓰던 노트
  getTargetEditor() {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) return active.editor;
    const v = this.lastMarkdownView;
    if (v && this.app.workspace.getLeavesOfType('markdown').some((l) => l.view === v)) return v.editor;
    return null;
  }

  getActiveEditor() {
    return this.getTargetEditor();
  }

  // 고른 번역본 블록들을 노트에 넣는다. 성공하면 true
  insertBlocks(blocks, refLabel) {
    const editor = this.getTargetEditor();
    if (!editor) {
      new Notice('삽입할 노트가 열려 있지 않습니다.');
      return false;
    }
    const st = this.settings;
    const text = buildInsertion(blocks, refLabel, st);
    if (st.insertPosition === 'cursor') {
      editor.replaceSelection(text + '\n');
    } else {
      // 참조가 적힌 줄(선택이 있으면 선택이 끝나는 줄) 아래에 넣는다
      const line = editor.getCursor('to').line;
      const lineText = editor.getLine(line);
      if (lineText.trim() === '') editor.replaceRange(text + '\n', { line, ch: 0 });
      else editor.replaceRange('\n\n' + text + '\n', { line, ch: lineText.length });
    }
    const lim = st.warnVerseLimit;
    if (lim > 0) {
      const over = blocks.filter((b) => b.verses.length > lim);
      if (over.length) {
        new Notice(`⚠ 인용 분량이 많습니다 (${over[0].label} ${over[0].verses.length}절). 저작권 허용 범위를 확인하세요.`, 8000);
      }
    }
    new Notice(blocks.length === 1 ? `${blocks[0].label} 삽입 완료` : `${blocks.length}개 번역본 삽입 완료`);
    return true;
  }

  // 창을 열지 않고, 커서 줄(또는 선택)의 참조를 프리셋 조합으로 바로 삽입
  async insertPreset(i) {
    const p = (this.settings.presets || [])[i];
    if (!p) {
      new Notice(`프리셋 ${i + 1}이(가) 없습니다. 역본대조 설정에서 만들어 주세요.`);
      return;
    }
    const editor = this.getTargetEditor();
    if (!editor) {
      new Notice('삽입할 노트가 열려 있지 않습니다.');
      return;
    }
    const ref = parseReference(this.detectReference(editor));
    if (!ref) {
      new Notice('커서가 있는 줄(또는 선택한 글)에서 본문 참조를 찾지 못했습니다.');
      return;
    }
    const results = await lookupReference(this.app, this.settings, ref, p.keys);
    const blocks = results.filter((r) => r.verses);
    if (!blocks.length) {
      new Notice('프리셋의 번역본에서 본문을 찾지 못했습니다.');
      return;
    }
    this.insertBlocks(blocks, formatRefLabel(ref));
  }

  async loadSettings() {
    this.settings = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), (await this.loadData()) || {});
    // 이전 버전(0.2.x) 설정에는 출처가 없다 — 기본 출처를 채워 준다
    for (const t of this.settings.translations) {
      if (t.source === undefined) t.source = SOURCE_DEFAULTS[t.key] || '';
    }
    if (!Array.isArray(this.settings.presets)) this.settings.presets = [];
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};
