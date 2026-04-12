/**
 * sound.js — Sound manager (skeleton)
 *
 * Part D.1.13 實作：空殼版本
 * ─────────────────────────────
 * 這個模組目前所有播放呼叫都是 no-op（不實際播放音效）。
 * 目的是在戰鬥/行動/UI 等關鍵位置「預留呼叫點」，
 * 未來加入音效時只需要把 no-op 改為實際的 Audio 呼叫，不用改遊戲邏輯。
 *
 * 當要啟用時：
 *   1. 把音效檔案放進 asset/audio/（見 DESIGN.md D.11.2）
 *   2. 在 ACTIONS / FIELDS / NPC 等資料模板的 assets 欄位填入路徑
 *   3. 把本檔的 _isStub 改為 false
 *   4. 填入 _playSfxReal / _playBgmReal 的實作
 *
 * 載入順序：在 flags.js / game_state.js 之後即可，無其他依賴。
 */
const SoundManager = (() => {
  // ── Stub 開關 ─────────────────────────────────────
  // 設為 true：所有播放都是 no-op
  // 設為 false：未來切換為實際播放模式
  const _isStub = true;

  // ── 音效快取（預留）──────────────────────────────
  const _sfxCache = {};      // { id: HTMLAudioElement }
  const _bgmCache = {};
  let _currentBgmId = null;
  let _currentBgmEl = null;

  // ── 音量（0.0 ~ 1.0）──────────────────────────────
  let _masterVol = 1.0;
  let _sfxVol    = 1.0;
  let _bgmVol    = 0.7;
  let _muted     = false;

  // 從 localStorage 讀取使用者設定
  function _loadUserSettings() {
    try {
      const saved = localStorage.getItem('sound_settings');
      if (saved) {
        const s = JSON.parse(saved);
        _masterVol = s.master ?? 1.0;
        _sfxVol    = s.sfx    ?? 1.0;
        _bgmVol    = s.bgm    ?? 0.7;
        _muted     = !!s.muted;
      }
    } catch (e) { /* ignore */ }
  }

  function _saveUserSettings() {
    try {
      localStorage.setItem('sound_settings', JSON.stringify({
        master: _masterVol,
        sfx:    _sfxVol,
        bgm:    _bgmVol,
        muted:  _muted,
      }));
    } catch (e) { /* ignore */ }
  }

  _loadUserSettings();

  // ══════════════════════════════════════════════════
  // 播放 API（空殼階段：全部 no-op）
  // ══════════════════════════════════════════════════

  /**
   * 播放一個短音效。可以重疊播放（同時播多個 sword_swing）。
   *
   * @param {string} id    音效 ID（例如 'sword_swing', 'hit_flesh'）
   * @param {number} [vol] 額外音量乘數（0~1）
   *
   * @example
   *   SoundManager.playSfx('sword_swing');
   *   SoundManager.playSfx('hit_crit', 1.2);  // 稍微放大
   */
  function playSfx(id, vol = 1.0) {
    if (_muted || _isStub) return;
    _playSfxReal(id, vol);
  }

  /**
   * 播放背景音樂（循環）。會 crossfade 切換。
   *
   * @param {string}  id           BGM ID
   * @param {boolean} [fadeIn=true] 是否淡入
   */
  function playBgm(id, fadeIn = true) {
    if (_muted || _isStub) { _currentBgmId = id; return; }
    _playBgmReal(id, fadeIn);
  }

  /**
   * 停止當前 BGM。
   * @param {boolean} [fadeOut=true] 是否淡出
   */
  function stopBgm(fadeOut = true) {
    if (_muted || _isStub) { _currentBgmId = null; return; }
    _stopBgmReal(fadeOut);
  }

  /**
   * 取得當前正在播放的 BGM ID（或 null）。
   */
  function getCurrentBgm() {
    return _currentBgmId;
  }

  // ══════════════════════════════════════════════════
  // 預載（空殼階段：不實際載入）
  // ══════════════════════════════════════════════════

  /**
   * 預載一個音效。避免第一次播放時的延遲。
   * @param {string} id
   * @param {string} path 相對路徑（如 'asset/audio/sfx/combat/sword_swing.ogg'）
   */
  function preloadSfx(id, path) {
    if (_isStub) return;
    if (_sfxCache[id]) return;
    const audio = new Audio(path);
    audio.preload = 'auto';
    _sfxCache[id] = audio;
  }

  /**
   * 預載一首 BGM。
   * @param {string} id
   * @param {string} path
   */
  function preloadBgm(id, path) {
    if (_isStub) return;
    if (_bgmCache[id]) return;
    const audio = new Audio(path);
    audio.preload = 'auto';
    audio.loop = true;
    _bgmCache[id] = audio;
  }

  // ══════════════════════════════════════════════════
  // 音量控制
  // ══════════════════════════════════════════════════

  function setMasterVol(v) {
    _masterVol = Math.max(0, Math.min(1, v));
    _saveUserSettings();
    _applyVolumesToCurrent();
  }
  function setSfxVol(v) {
    _sfxVol = Math.max(0, Math.min(1, v));
    _saveUserSettings();
  }
  function setBgmVol(v) {
    _bgmVol = Math.max(0, Math.min(1, v));
    _saveUserSettings();
    _applyVolumesToCurrent();
  }
  function mute(b)   {
    _muted = !!b;
    _saveUserSettings();
    if (_muted && _currentBgmEl) _currentBgmEl.volume = 0;
    else _applyVolumesToCurrent();
  }
  function isMuted() { return _muted; }

  function getVolumes() {
    return {
      master: _masterVol,
      sfx:    _sfxVol,
      bgm:    _bgmVol,
      muted:  _muted,
    };
  }

  function _applyVolumesToCurrent() {
    if (_currentBgmEl) {
      _currentBgmEl.volume = _muted ? 0 : _bgmVol * _masterVol;
    }
  }

  // ══════════════════════════════════════════════════
  // 實作層（空殼階段不會被呼叫，僅留框架）
  // 未來啟用時把 _isStub 設 false，這些就會生效
  // ══════════════════════════════════════════════════

  function _playSfxReal(id, vol) {
    const audio = _sfxCache[id];
    if (!audio) return;
    // 複製節點以支援重疊播放
    const clone = audio.cloneNode();
    clone.volume = _sfxVol * _masterVol * vol;
    clone.play().catch(() => { /* ignore autoplay errors */ });
  }

  function _playBgmReal(id, fadeIn) {
    if (_currentBgmId === id) return;
    // 淡出舊的
    if (_currentBgmEl) _fadeAndStop(_currentBgmEl);
    // 播新的
    const newEl = _bgmCache[id];
    if (!newEl) { _currentBgmId = null; _currentBgmEl = null; return; }
    _currentBgmId = id;
    _currentBgmEl = newEl;
    newEl.currentTime = 0;
    newEl.volume = fadeIn ? 0 : (_bgmVol * _masterVol);
    newEl.play().catch(() => { /* ignore */ });
    if (fadeIn) _fadeIn(newEl, _bgmVol * _masterVol);
  }

  function _stopBgmReal(fadeOut) {
    if (!_currentBgmEl) return;
    if (fadeOut) _fadeAndStop(_currentBgmEl);
    else         { _currentBgmEl.pause(); _currentBgmEl.currentTime = 0; }
    _currentBgmId = null;
    _currentBgmEl = null;
  }

  function _fadeIn(el, targetVol, duration = 1000) {
    const steps = 20;
    const stepVol = targetVol / steps;
    const stepTime = duration / steps;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      el.volume = Math.min(targetVol, stepVol * i);
      if (i >= steps) clearInterval(timer);
    }, stepTime);
  }

  function _fadeAndStop(el, duration = 800) {
    const initialVol = el.volume;
    const steps = 20;
    const stepVol = initialVol / steps;
    const stepTime = duration / steps;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      el.volume = Math.max(0, initialVol - stepVol * i);
      if (i >= steps) {
        clearInterval(timer);
        el.pause();
        el.currentTime = 0;
      }
    }, stepTime);
  }

  // ══════════════════════════════════════════════════
  // 公開介面
  // ══════════════════════════════════════════════════
  return {
    // 播放
    playSfx,
    playBgm,
    stopBgm,
    getCurrentBgm,
    // 預載
    preloadSfx,
    preloadBgm,
    // 音量
    setMasterVol,
    setSfxVol,
    setBgmVol,
    mute,
    isMuted,
    getVolumes,
    // 狀態查詢
    isStub: () => _isStub,
  };
})();
