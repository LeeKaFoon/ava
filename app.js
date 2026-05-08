/* App logic: uses global rawData & mockData from data.js */
/**
 * 应用逻辑：配置、状态、题库构建、持久化、UI 与快捷键均封装在 IIFE 内，避免污染全局作用域。
 * 扩展新题型/新筛选条件：在 DataSource / FilterKind 中增加枚举，并实现 buildPool 的分支。
 */
(function () {
    'use strict';

    const CONFIG = {
        LS_FILTER_KEY: 'sanwen_train_v2_filter',
        TOAST_MS: 2800,
        RECENT_YEAR_PREFIXES: ['2026', '2025', '2024'],
    };

    const DataSource = Object.freeze({
        RAW: 'rawData',
        MOCK: 'mockData',
    });

    const FilterKind = Object.freeze({
        ALL: 'all',
        RECENT: 'recent',
        MOCK: 'mock',
    });

    const YEAR_TAG_CLASS = Object.freeze({
        active: 'inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full tracking-wide',
        done: 'inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full tracking-wide',
    });

    /** @typedef {{ y: string, q: string, a: string[] }} QuestionItem */

    /** @type {{ pool: QuestionItem[], current: QuestionItem | null, mastered: number, initialTotal: number }} */
    const state = {
        pool: [],
        current: null,
        mastered: 0,
        initialTotal: 0,
    };

    /** @type {Record<string, HTMLElement | null>} */
    const dom = {};

    function cacheDom() {
        const ids = [
            'filterGroup', 'progressWrap', 'progressBar', 'progressLabel',
            'yearTag', 'questionText', 'hintText', 'answerText',
            'startBtnContainer', 'reviewControls', 'poolSize', 'masteredCount',
            'toast', 'answerRevealBtn', 'btnStart', 'btnStuck', 'btnMastered',
        ];
        ids.forEach((id) => { dom[id] = document.getElementById(id); });
    }

    function getYearsDescending() {
        return [...new Set(rawData.map((q) => q.y.split('-')[0]))].sort((a, b) => b - a);
    }

    function filterButtonId(filterType, dataSourceName) {
        if (dataSourceName === DataSource.MOCK && filterType === FilterKind.MOCK) return 'btn-mock';
        if (filterType === FilterKind.ALL) return 'btn-all';
        if (filterType === FilterKind.RECENT) return 'btn-recent';
        return null;
    }

    function isYearFilterType(filterType) {
        return typeof filterType === 'string' && /^\d{4}$/.test(filterType);
    }

    function isPersistedFilterValid(saved, years) {
        if (!saved || !saved.type || !saved.dataSourceName) return false;
        if (saved.dataSourceName === DataSource.MOCK) return saved.type === FilterKind.MOCK;
        if (saved.type === FilterKind.ALL || saved.type === FilterKind.RECENT) return true;
        return isYearFilterType(saved.type) && years.includes(saved.type);
    }

    /**
     * 纯函数：根据筛选条件从数据源构建题目池（便于单测与扩展）。
     * @param {string} filterType
     * @param {string} dataSourceName
     * @returns {QuestionItem[]}
     */
    function buildPool(filterType, dataSourceName) {
        const source = dataSourceName === DataSource.MOCK ? mockData : rawData;
        if (filterType === FilterKind.ALL || filterType === FilterKind.MOCK) {
            return source.slice();
        }
        if (filterType === FilterKind.RECENT) {
            return source.filter((q) =>
                CONFIG.RECENT_YEAR_PREFIXES.some((prefix) => q.y.startsWith(prefix))
            );
        }
        return source.filter((q) => q.y.startsWith(filterType));
    }

    function persistFilter(filterType, dataSourceName) {
        try {
            localStorage.setItem(CONFIG.LS_FILTER_KEY, JSON.stringify({ type: filterType, dataSourceName }));
        } catch (_) { /* quota / private mode */ }
    }

    function loadPersistedFilter() {
        try {
            const raw = localStorage.getItem(CONFIG.LS_FILTER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function renderFilterButtons() {
        const years = getYearsDescending();
        const yearOptions = years
            .map((yr) => `<option value="${yr}">${yr} 年真题</option>`)
            .join('');
        dom.filterGroup.innerHTML = [
            '<div class="flex flex-wrap justify-center items-center gap-2">',
            `<button type="button" class="filter-btn" id="btn-all" data-filter-type="${FilterKind.ALL}" data-datasource="${DataSource.RAW}">全库随机</button>`,
            `<button type="button" class="filter-btn" id="btn-recent" data-filter-type="${FilterKind.RECENT}" data-datasource="${DataSource.RAW}">近3年高频</button>`,
            `<button type="button" class="filter-btn mock-special" id="btn-mock" data-filter-type="${FilterKind.MOCK}" data-datasource="${DataSource.MOCK}">全真模拟</button>`,
            '</div>',
            '<div class="flex flex-wrap justify-center items-center gap-2 sm:gap-3">',
            '<label for="yearSelect" class="text-xs text-slate-500 whitespace-nowrap">指定年份</label>',
            '<select id="yearSelect" class="filter-select" aria-label="按年份筛选真题">',
            '<option value="">选择年份真题…</option>',
            yearOptions,
            '</select>',
            '</div>',
        ].join('');
    }

    function setActiveFilterButton(filterType, dataSourceName) {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        const sel = document.getElementById('yearSelect');
        if (sel) {
            sel.classList.remove('year-active');
            if (dataSourceName === DataSource.RAW && isYearFilterType(filterType)) {
                sel.value = filterType;
                sel.classList.add('year-active');
            } else {
                sel.value = '';
            }
        }
        const bid = filterButtonId(filterType, dataSourceName);
        if (bid) {
            const btn = document.getElementById(bid);
            if (btn) btn.classList.add('active');
        }
    }

    /**
     * 切换题组：更新 state、持久化、刷新统计并出题。
     */
    function applyFilter(filterType, dataSourceName) {
        let pool = buildPool(filterType, dataSourceName);
        const years = getYearsDescending();
        const fallbackType = years[0];

        if (pool.length === 0) {
            showToast('该分组暂无题目，已切换默认题组');
            if (filterType !== fallbackType || dataSourceName !== DataSource.RAW) {
                applyFilter(fallbackType, DataSource.RAW);
                return;
            }
        }

        setActiveFilterButton(filterType, dataSourceName);
        state.pool = pool;
        state.initialTotal = pool.length;
        state.mastered = 0;
        state.current = null;
        persistFilter(filterType, dataSourceName);
        refreshStats();
        showNextQuestion();
    }

    function showToast(message) {
        dom.toast.textContent = message;
        dom.toast.style.opacity = '1';
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => { dom.toast.style.opacity = '0'; }, CONFIG.TOAST_MS);
    }

    function isAnswerRevealed() {
        return dom.answerText && !dom.answerText.classList.contains('hidden');
    }

    function renderAnswerHtml(lines) {
        return lines
            .map(
                (line) =>
                    `<div class="pl-3 border-l-2 border-blue-200 text-slate-700">${line}</div>`
            )
            .join('');
    }

    function showSessionComplete() {
        showToast('本轮题目已全部掌握，请从上方切换题组');
        state.current = null;
        dom.questionText.textContent = '本组已练完，请从上方选择其他分组继续。';
        dom.yearTag.textContent = '完成';
        dom.yearTag.className = YEAR_TAG_CLASS.done;
        dom.answerText.innerHTML = '';
        dom.answerText.classList.add('hidden');
        dom.hintText.classList.remove('hidden');
        dom.reviewControls.classList.add('hidden');
        dom.startBtnContainer.classList.add('hidden');
        renderProgress(true);
    }

    function showNextQuestion() {
        if (state.pool.length === 0) {
            showSessionComplete();
            return;
        }

        const idx = Math.floor(Math.random() * state.pool.length);
        state.current = state.pool[idx];

        const isYearPaper = /^\d{4}/.test(state.current.y);
        dom.yearTag.className = YEAR_TAG_CLASS.active;
        dom.yearTag.textContent = state.current.y + (isYearPaper ? ' · 真题' : ' · 模拟');
        dom.questionText.textContent = state.current.q;

        dom.answerText.innerHTML = '';
        dom.answerText.classList.add('hidden');
        dom.hintText.classList.remove('hidden');
        dom.startBtnContainer.classList.add('hidden');
        dom.reviewControls.classList.add('hidden');
    }

    function revealAnswer() {
        if (!state.current) return;
        dom.answerText.innerHTML = renderAnswerHtml(state.current.a);
        dom.answerText.classList.remove('hidden');
        dom.hintText.classList.add('hidden');
        dom.reviewControls.classList.remove('hidden');
    }

    function hideAnswer() {
        if (!state.current) return;
        if (dom.answerText.classList.contains('hidden')) return;
        dom.answerText.innerHTML = '';
        dom.answerText.classList.add('hidden');
        dom.hintText.classList.remove('hidden');
        dom.reviewControls.classList.add('hidden');
    }

    function markResult(mastered) {
        if (mastered && state.current) {
            state.mastered += 1;
            state.pool = state.pool.filter((q) => q !== state.current);
        }
        refreshStats();
        showNextQuestion();
    }

    function refreshStats() {
        dom.poolSize.textContent = String(state.pool.length);
        dom.masteredCount.textContent = String(state.mastered);
        renderProgress(false);
    }

    function renderProgress(forceComplete) {
        const total = state.initialTotal;
        if (!dom.progressWrap || !dom.progressBar || !dom.progressLabel) return;
        if (total === 0) {
            dom.progressWrap.classList.add('hidden');
            return;
        }
        dom.progressWrap.classList.remove('hidden');
        const pct = forceComplete
            ? 100
            : Math.min(100, Math.round((state.mastered / total) * 100));
        dom.progressBar.style.width = pct + '%';
        dom.progressLabel.textContent = `本轮进度：已掌握 ${state.mastered} / ${total} 题`;
    }

    function isTypingTarget(target) {
        if (!target || !target.tagName) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    function onKeyDown(e) {
        if (isTypingTarget(e.target)) return;

        const reviewOpen = !dom.reviewControls.classList.contains('hidden');
        const answerHidden = !isAnswerRevealed();
        const startOpen = !dom.startBtnContainer.classList.contains('hidden');

        if (e.key === 'Escape') {
            hideAnswer();
            return;
        }

        if (state.current && answerHidden && !startOpen) {
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                revealAnswer();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                revealAnswer();
                return;
            }
            if (e.code === 'Space') {
                e.preventDefault();
                revealAnswer();
                return;
            }
        }

        if (reviewOpen && state.current) {
            if (e.key === '1') {
                e.preventDefault();
                markResult(false);
            } else if (e.key === '2') {
                e.preventDefault();
                markResult(true);
            }
        }
    }

    function bindEvents() {
        dom.filterGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn || !btn.dataset.filterType) return;
            applyFilter(btn.dataset.filterType, btn.dataset.datasource);
        });

        dom.filterGroup.addEventListener('change', (e) => {
            const t = e.target;
            if (!t || t.id !== 'yearSelect') return;
            const v = t.value;
            if (v) applyFilter(v, DataSource.RAW);
        });

        dom.answerRevealBtn.addEventListener('click', revealAnswer);
        dom.btnStart.addEventListener('click', showNextQuestion);
        dom.btnStuck.addEventListener('click', () => markResult(false));
        dom.btnMastered.addEventListener('click', () => markResult(true));

        document.addEventListener('keydown', onKeyDown);
    }

    function init() {
        cacheDom();
        renderFilterButtons();
        bindEvents();

        const years = getYearsDescending();
        const saved = loadPersistedFilter();
        const defaultType = years[0];
        if (isPersistedFilterValid(saved, years)) {
            applyFilter(saved.type, saved.dataSourceName);
        } else {
            applyFilter(defaultType, DataSource.RAW);
        }
    }

    init();
})();
