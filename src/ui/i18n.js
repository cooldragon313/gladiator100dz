/**
 * i18n.js — Internationalization framework
 *
 * Part D.1.14 實作
 * ─────────────────
 * 為未來多語言鋪路的基礎框架。**目前不做任何翻譯工作**。
 *
 * 設計原則：
 *   1. 預設語言 zh-TW，其他語言慢慢補
 *   2. 現有硬編碼文字**保留不動**
 *   3. 新寫的系統可以開始用 I18N.t()
 *   4. 模組可以透過 I18N.addStrings(lang, obj) 註冊自己的文字
 *   5. 找不到的 key 回傳 key 本身（不會讓 UI 消失）
 *
 * 使用範例：
 *   // 在模組初始化時註冊
 *   I18N.addStrings('zh-TW', {
 *     'ui.attack':       '攻擊',
 *     'ui.special':      '絕招',
 *     'event.greet':     '{name} 對你點了點頭。',
 *   });
 *
 *   // 使用
 *   I18N.t('ui.attack');                          // '攻擊'
 *   I18N.t('event.greet', { name: '卡西烏斯' });   // '卡西烏斯 對你點了點頭。'
 *   I18N.t('missing.key');                        // 'missing.key' (fallback)
 *
 * 切換語言：
 *   I18N.setLang('en');    // 切換到英文
 *   I18N.getLang();         // 'en'
 *
 * 載入順序：在 flags.js 等基礎設施之後即可，無嚴格依賴。
 */
const I18N = (() => {

  // ══════════════════════════════════════════════════
  // 內部儲存
  // ══════════════════════════════════════════════════
  /**
   * _strings[lang][key] = '翻譯文字'
   *
   * 範例：
   *   _strings = {
   *     'zh-TW': { 'ui.attack': '攻擊', ... },
   *     'zh-CN': { 'ui.attack': '攻击', ... },
   *     'en':    { 'ui.attack': 'Attack', ... },
   *     'ja':    { 'ui.attack': '攻撃', ... },
   *   }
   */
  const _strings = {
    'zh-TW': {},
    'zh-CN': {},
    'en':    {},
    'ja':    {},
  };

  let _currentLang    = 'zh-TW';
  const _fallbackLang = 'zh-TW';    // 翻譯缺失時回退到此語言

  // ══════════════════════════════════════════════════
  // 核心 API
  // ══════════════════════════════════════════════════

  /**
   * 翻譯查詢。
   *
   * @param {string} key   翻譯 key（例如 'ui.attack'）
   * @param {Object} vars  變數替換（例如 {name: '卡西烏斯'}）
   * @returns {string}     翻譯後的文字，找不到時回傳 key 本身
   *
   * @example
   *   I18N.t('ui.attack');
   *   I18N.t('event.greet', { name: '卡西烏斯' });
   */
  function t(key, vars) {
    if (typeof key !== 'string') return '';

    // 依序嘗試：當前語言 → 回退語言 → key 本身
    let str = _strings[_currentLang]?.[key]
           ?? _strings[_fallbackLang]?.[key]
           ?? key;

    // 變數替換 {name} / {count} 等
    if (vars && typeof vars === 'object') {
      str = str.replace(/\{(\w+)\}/g, (match, k) => {
        return vars[k] !== undefined ? vars[k] : match;
      });
    }

    return str;
  }

  /**
   * 檢查某個 key 是否在當前語言有翻譯。
   *
   * @param {string} key
   * @returns {boolean}
   */
  function has(key) {
    return _strings[_currentLang]?.[key] !== undefined;
  }

  // ══════════════════════════════════════════════════
  // 註冊字串
  // ══════════════════════════════════════════════════

  /**
   * 為指定語言註冊一批翻譯字串。
   * 模組可在載入時呼叫此函式註冊自己用到的 key。
   *
   * @param {string} lang  語言代碼（'zh-TW', 'zh-CN', 'en', 'ja'）
   * @param {Object} obj   { key: 'translated text', ... }
   *
   * @example
   *   I18N.addStrings('zh-TW', {
   *     'battle.attack': '攻擊',
   *     'battle.defend': '防禦',
   *   });
   *   I18N.addStrings('en', {
   *     'battle.attack': 'Attack',
   *     'battle.defend': 'Defend',
   *   });
   */
  function addStrings(lang, obj) {
    if (!_strings[lang]) {
      _strings[lang] = {};
    }
    if (obj && typeof obj === 'object') {
      Object.assign(_strings[lang], obj);
    }
  }

  /**
   * 批次註冊多個語言的同一組 key。
   * 方便在一個地方定義所有語言版本。
   *
   * @param {Object} bundle  { key: { 'zh-TW': '...', 'en': '...' } }
   *
   * @example
   *   I18N.addBundle({
   *     'ui.attack': { 'zh-TW': '攻擊', 'zh-CN': '攻击', 'en': 'Attack', 'ja': '攻撃' },
   *     'ui.defend': { 'zh-TW': '防禦', 'zh-CN': '防御', 'en': 'Defend', 'ja': '防御' },
   *   });
   */
  function addBundle(bundle) {
    if (!bundle || typeof bundle !== 'object') return;
    for (const key of Object.keys(bundle)) {
      const langMap = bundle[key];
      for (const lang of Object.keys(langMap)) {
        if (!_strings[lang]) _strings[lang] = {};
        _strings[lang][key] = langMap[lang];
      }
    }
  }

  // ══════════════════════════════════════════════════
  // 語言切換
  // ══════════════════════════════════════════════════

  /**
   * 取得當前語言代碼。
   */
  function getLang() {
    return _currentLang;
  }

  /**
   * 切換當前語言。
   *
   * @param {string} lang
   * @returns {boolean} 是否切換成功
   */
  function setLang(lang) {
    if (!_strings[lang]) {
      console.warn('[I18N] Unknown language:', lang);
      return false;
    }
    _currentLang = lang;
    return true;
  }

  /**
   * 取得所有可用的語言代碼。
   */
  function listLanguages() {
    return Object.keys(_strings);
  }

  // ══════════════════════════════════════════════════
  // Debug
  // ══════════════════════════════════════════════════

  /**
   * 列出某個語言的所有已註冊 key（debug 用）。
   */
  function dump(lang) {
    lang = lang || _currentLang;
    console.group(`[I18N] Strings for ${lang}`);
    const strs = _strings[lang] || {};
    const keys = Object.keys(strs).sort();
    console.log(`Total: ${keys.length} keys`);
    keys.forEach(k => console.log(`  ${k}: ${strs[k]}`));
    console.groupEnd();
  }

  /**
   * 檢查翻譯覆蓋率（每個語言有多少 key）。
   */
  function coverage() {
    const result = {};
    Object.keys(_strings).forEach(lang => {
      result[lang] = Object.keys(_strings[lang] || {}).length;
    });
    console.table(result);
    return result;
  }

  // ══════════════════════════════════════════════════
  // 公開介面
  // ══════════════════════════════════════════════════
  return {
    // 核心
    t,
    has,
    // 註冊
    addStrings,
    addBundle,
    // 語言
    getLang,
    setLang,
    listLanguages,
    // Debug
    dump,
    coverage,
  };
})();
