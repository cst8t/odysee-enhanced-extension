import { loopIconMarkup, theatreIconMarkup } from './icons.js';

(() => {
  const VIDEO_SELECTOR = '.file-page__video-container video, .odysee-skin video, .video-js-parent video';
  const FLOATING_MODIFIER = 'content__viewer--floating';
  const LOOP_BUTTON_ID = 'oee-loop-btn';
  const BUTTON_ID = 'oee-theatre-btn';
  const CONTROL_ROW_ID = 'oee-theatre-controls';
  const OVERLAY_ID = 'oee-theatre-overlay';
  const OVERLAY_CLASS = 'oee-overlay';
  const OVERLAY_LIGHT_THEME_CLASS = 'oee-overlay--light-theme';
  const VISIBLE_CLASS = 'oee-overlay--visible';
  const BTN_CLASS = 'oee-btn';
  const CONTROL_ROW_CLASS = 'oee-controls';
  const CONTROL_PANEL_CLASS = 'oee-controls__panel';
  const CONTROL_DIVIDER_CLASS = 'oee-controls__divider';
  const CONTROL_ROW_LOOP_OPEN_CLASS = 'oee-controls--loop-open';
  const BTN_ACTIVE_CLASS = 'oee-btn--active';
  const PLAYER_THEATRE_CLASS = 'oee-theatre-player';
  const SCOPE_THEATRE_CLASS = 'oee-theatre-scope';
  const SCOPE_CONTROLS_CLASS = 'oee-theatre-controls-host';
  const CONTROL_ROW_ACTIVE_CLASS = 'oee-controls--active';
  const BTN_THEATRE_CLASS = 'oee-theatre-active';
  const LOOP_POPOVER_ID = 'oee-loop-popover';
  const LOOP_POPOVER_CLASS = 'oee-loop-popover';
  const LOOP_POPOVER_OPEN_CLASS = 'oee-loop-popover--open';
  const POINTER_EVENT_NAMES = ['pointerdown', 'mousedown', 'mouseup'];
  const CLICK_EVENT_NAMES = [...POINTER_EVENT_NAMES, 'click'];
  const MEDIA_EVENT_HANDLERS = [
    ['timeupdate', handleLoopTimeUpdate],
    ['loadedmetadata', handleLoopMetadata],
    ['durationchange', handleLoopMetadata],
    ['ended', handleLoopEnded],
  ];
  const MAX_INIT_ATTEMPTS = 80;
  const INIT_RETRY_MS = 400;
  const URL_CHECK_MS = 800;

  let active = false;
  let button = null;
  let loopButton = null;
  let controlRow = null;
  let overlay = null;
  let playerContainer = null;
  let loopPopover = null;
  let mediaElement = null;
  let loopEnabled = false;
  let loopPopoverOpen = false;
  let loopRangeCustomised = false;
  let loopStartSeconds = 0;
  let loopEndSeconds = null;
  let removalTimer = null;
  let urlCheckTimer = null;
  let lastUrl = '';
  let initAttempts = 0;
  let initTimer = null;
  let observer = null;
  let ensureMountScheduled = false;
  const svgParser = new DOMParser();

  function isVisible(rect) {
    return rect.width > 0 && rect.height > 0;
  }

  function getScore(rect) {
    return rect.width * rect.height;
  }

  function findPlayerContainer() {
    const videos = Array.from(document.querySelectorAll(VIDEO_SELECTOR));
    let bestMatch = null;
    let bestScore = 0;

    videos.forEach((video) => {
      const container = video.closest('.content__viewer');
      const scope = video.closest('.file-page__video-container') || container;

      if (!container || !scope) {
        return;
      }

      if (container.classList.contains(FLOATING_MODIFIER) || container.closest('.shorts-page, .shorts__viewer')) {
        return;
      }

      const rect = scope.getBoundingClientRect();
      if (!isVisible(rect)) {
        return;
      }

      const score = getScore(rect);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          container,
          scope,
        };
      }
    });

    return bestMatch;
  }

  function createOverlay() {
    const el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = OVERLAY_CLASS;
    el.addEventListener('click', deactivate);
    syncOverlayTheme(el);
    return el;
  }

  function isLightThemeToggleButton(button) {
    const label = button?.getAttribute('aria-label') || button?.getAttribute('title') || '';
    return label.trim().toLowerCase() === 'dark';
  }

  function isOdyseeLightTheme() {
    const rootTheme = document.documentElement.getAttribute('theme');
    if (rootTheme === 'light') {
      return true;
    }

    if (rootTheme === 'dark') {
      return false;
    }

    const themeButton = document.querySelector('button[aria-label="Dark"], button[title="Dark"], button[aria-label="Light"], button[title="Light"]');
    return isLightThemeToggleButton(themeButton);
  }

  function syncOverlayTheme(overlayElement = overlay) {
    overlayElement?.classList.toggle(OVERLAY_LIGHT_THEME_CLASS, isOdyseeLightTheme());
  }

  function createIconNode(iconMarkup) {
    if (!iconMarkup) {
      return null;
    }

    const iconDocument = svgParser.parseFromString(iconMarkup, 'image/svg+xml');
    const iconNode = iconDocument.documentElement;

    if (!iconNode || iconNode.tagName === 'parsererror') {
      return null;
    }

    return document.importNode(iconNode, true);
  }

  function createButton(id, label, onClick, iconMarkup = '') {
    const btn = document.createElement('button');
    const iconNode = createIconNode(iconMarkup);
    const labelNode = document.createElement('span');

    btn.id = id;
    btn.className = BTN_CLASS;
    btn.type = 'button';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    labelNode.className = 'oee-btn__label';
    labelNode.textContent = label;

    if (iconNode) {
      btn.appendChild(iconNode);
    }

    btn.appendChild(labelNode);

    addStoppedEventListeners(btn, POINTER_EVENT_NAMES, stopAndPreventEvent);
    btn.addEventListener('click', (event) => {
      stopAndPreventEvent(event);
      onClick(event);
    });
    return btn;
  }

  function stopEvent(event) {
    event.stopPropagation();
  }

  function stopAndPreventEvent(event) {
    event.preventDefault();
    stopEvent(event);
  }

  function addStoppedEventListeners(element, eventNames, handler) {
    eventNames.forEach((eventName) => {
      element.addEventListener(eventName, handler);
    });
  }

  function getTheatreScope() {
    return playerContainer?.closest('.file-page__video-container') || playerContainer;
  }

  function getVideoElement() {
    return getTheatreScope()?.querySelector('video') || null;
  }

  function createControlRow() {
    const row = document.createElement('div');
    row.id = CONTROL_ROW_ID;
    row.className = CONTROL_ROW_CLASS;
    return row;
  }

  function createControlPanel() {
    const panel = document.createElement('div');
    panel.className = CONTROL_PANEL_CLASS;
    return panel;
  }

  function createControlDivider() {
    const divider = document.createElement('span');
    divider.className = CONTROL_DIVIDER_CLASS;
    divider.setAttribute('aria-hidden', 'true');
    return divider;
  }

  function createLoopInput(name) {
    const input = document.createElement('input');
    input.className = 'oee-loop-popover__input';
    input.name = name;
    input.type = 'text';
    input.inputMode = 'text';
    input.placeholder = '0:00';
    return input;
  }

  function createLoopField(labelText, name) {
    const field = document.createElement('label');
    const label = document.createElement('span');
    const input = createLoopInput(name);

    field.className = 'oee-loop-popover__field';
    label.className = 'oee-loop-popover__label';
    label.textContent = labelText;

    field.append(label, input);
    return field;
  }

  function createLoopPopover() {
    const popover = document.createElement('div');
    const rangeRow = document.createElement('div');
    const toggleRow = document.createElement('label');
    const toggleLabel = document.createElement('span');
    const toggle = document.createElement('span');
    const toggleInput = document.createElement('input');
    const toggleTrack = document.createElement('span');

    popover.id = LOOP_POPOVER_ID;
    popover.className = LOOP_POPOVER_CLASS;

    rangeRow.className = 'oee-loop-popover__row';
    rangeRow.append(createLoopField('Start', 'start'), createLoopField('End', 'end'));

    toggleRow.className = 'oee-loop-popover__row oee-loop-popover__row--toggle';
    toggleLabel.className = 'oee-loop-popover__label';
    toggleLabel.textContent = 'Loop';
    toggle.className = 'oee-loop-toggle';
    toggleInput.className = 'oee-loop-toggle__input';
    toggleInput.name = 'enabled';
    toggleInput.type = 'checkbox';
    toggleTrack.className = 'oee-loop-toggle__track';
    toggle.append(toggleInput, toggleTrack);
    toggleRow.append(toggleLabel, toggle);

    popover.append(rangeRow, toggleRow);

    addStoppedEventListeners(popover, CLICK_EVENT_NAMES, stopEvent);

    popover.querySelector('[name="start"]')?.addEventListener('change', updateLoopRangeFromInputs);
    popover.querySelector('[name="end"]')?.addEventListener('change', updateLoopRangeFromInputs);
    popover.querySelector('[name="enabled"]')?.addEventListener('change', onLoopToggleChange);

    return popover;
  }

  function getLoopFields() {
    return {
      startInput: loopPopover?.querySelector('[name="start"]') || null,
      endInput: loopPopover?.querySelector('[name="end"]') || null,
      enabledInput: loopPopover?.querySelector('[name="enabled"]') || null,
    };
  }

  function isFocusedElement(element) {
    return Boolean(element) && document.activeElement === element;
  }

  function formatLoopSeconds(value) {
    if (!Number.isFinite(value)) {
      return '';
    }

    const roundedTotal = Math.max(0, Math.round(value * 10) / 10);
    let hours = Math.floor(roundedTotal / 3600);
    let minutes = Math.floor((roundedTotal % 3600) / 60);
    let seconds = Math.round((roundedTotal - hours * 3600 - minutes * 60) * 10) / 10;

    if (seconds >= 60) {
      seconds = 0;
      minutes += 1;
    }

    if (minutes >= 60) {
      minutes = 0;
      hours += 1;
    }

    const wholeSeconds = Math.floor(seconds);
    const hasFraction = !Number.isInteger(seconds);
    const secondsText = hasFraction
      ? `${String(wholeSeconds).padStart(2, '0')}.${String(Math.round((seconds - wholeSeconds) * 10))}`
      : String(wholeSeconds).padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${secondsText}`;
    }

    return `${minutes}:${secondsText}`;
  }

  function parseLoopSeconds(value) {
    const normalisedValue = value.trim();
    if (!normalisedValue) {
      return Number.NaN;
    }

    if (!normalisedValue.includes(':')) {
      const numericValue = Number.parseFloat(normalisedValue);
      return Number.isFinite(numericValue) ? numericValue : Number.NaN;
    }

    const parts = normalisedValue.split(':').map((part) => part.trim());
    if (parts.some((part) => part === '')) {
      return Number.NaN;
    }

    let multiplier = 1;
    let total = 0;

    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const partValue = Number.parseFloat(parts[index]);
      if (!Number.isFinite(partValue) || partValue < 0) {
        return Number.NaN;
      }

      total += partValue * multiplier;
      multiplier *= 60;
    }

    return total;
  }

  function getVideoDuration(video) {
    return Number.isFinite(video?.duration) ? video.duration : 0;
  }

  function isPastLoopRange(video, range) {
    return video.currentTime < range.start || (Number.isFinite(range.end) && video.currentTime > range.end);
  }

  function seekToLoopStart(video, range) {
    video.currentTime = range.start;
  }

  function updateMediaEventBindings(video, methodName) {
    MEDIA_EVENT_HANDLERS.forEach(([eventName, handler]) => {
      video[methodName](eventName, handler);
    });
  }

  function ensureLoopRange(video) {
    const duration = getVideoDuration(video);

    if (!loopRangeCustomised) {
      loopStartSeconds = 0;
      loopEndSeconds = duration > 0 ? duration : null;

      return {
        start: loopStartSeconds,
        end: loopEndSeconds,
      };
    }

    if (duration > 0 && loopEndSeconds == null) {
      loopEndSeconds = duration;
    }

    loopStartSeconds = Math.max(0, loopStartSeconds);

    if (!Number.isFinite(loopEndSeconds)) {
      loopEndSeconds = duration > 0 ? duration : loopStartSeconds + 1;
    }

    if (duration > 0) {
      loopStartSeconds = Math.min(loopStartSeconds, duration);
      loopEndSeconds = Math.min(Math.max(loopEndSeconds, 0), duration);

      if (loopEndSeconds <= loopStartSeconds) {
        if (loopStartSeconds >= duration) {
          loopStartSeconds = Math.max(0, duration - 0.1);
        }

        loopEndSeconds = duration;

        if (loopEndSeconds <= loopStartSeconds) {
          loopEndSeconds = Math.min(duration, loopStartSeconds + 0.1);
        }
      }
    } else if (loopEndSeconds <= loopStartSeconds) {
      loopEndSeconds = loopStartSeconds + 1;
    }

    return {
      start: loopStartSeconds,
      end: loopEndSeconds,
    };
  }

  function syncLoopUiState() {
    controlRow?.classList.toggle(CONTROL_ROW_LOOP_OPEN_CLASS, loopPopoverOpen);

    if (!loopButton && !loopPopover) {
      return;
    }

    const fields = getLoopFields();
    const video = mediaElement || getVideoElement();
    const range = ensureLoopRange(video);

    loopPopover?.classList.toggle(LOOP_POPOVER_OPEN_CLASS, loopPopoverOpen);

    if (loopButton) {
      loopButton.classList.toggle(BTN_ACTIVE_CLASS, loopEnabled);
      loopButton.setAttribute('aria-pressed', loopEnabled ? 'true' : 'false');
      loopButton.setAttribute('aria-expanded', loopPopoverOpen ? 'true' : 'false');
    }

    if (fields.startInput && !isFocusedElement(fields.startInput)) {
      fields.startInput.value = formatLoopSeconds(range.start);
    }

    if (fields.endInput && !isFocusedElement(fields.endInput)) {
      fields.endInput.value = formatLoopSeconds(range.end);
    }

    if (fields.enabledInput) {
      fields.enabledInput.checked = loopEnabled;
    }
  }

  function setLoopPopoverOpen(isOpen) {
    loopPopoverOpen = isOpen;
    syncLoopUiState();
  }

  function toggleLoopPopover() {
    setLoopPopoverOpen(!loopPopoverOpen);
  }

  function updateLoopRangeFromInputs() {
    const { startInput, endInput } = getLoopFields();
    if (!startInput || !endInput) {
      return;
    }

    const startValue = parseLoopSeconds(startInput.value);
    const endValue = parseLoopSeconds(endInput.value);

    loopRangeCustomised = true;
    loopStartSeconds = Number.isFinite(startValue) ? Math.max(0, startValue) : 0;
    loopEndSeconds = Number.isFinite(endValue) ? Math.max(0, endValue) : getVideoDuration(mediaElement) || loopStartSeconds + 1;

    if (mediaElement && loopEnabled) {
      const range = ensureLoopRange(mediaElement);
      if (isPastLoopRange(mediaElement, range)) {
        seekToLoopStart(mediaElement, range);
      }
    }

    syncLoopUiState();
  }

  function onLoopToggleChange(event) {
    loopEnabled = Boolean(event.target.checked);

    if (mediaElement) {
      const range = ensureLoopRange(mediaElement);
      mediaElement.loop = false;

      if (loopEnabled && isPastLoopRange(mediaElement, range)) {
        seekToLoopStart(mediaElement, range);
      }
    }

    syncLoopUiState();
  }

  function handleLoopTimeUpdate() {
    if (!loopEnabled || !mediaElement) {
      return;
    }

    const range = ensureLoopRange(mediaElement);

    if (!Number.isFinite(range.end)) {
      return;
    }

    if (mediaElement.currentTime < range.start) {
      seekToLoopStart(mediaElement, range);
      return;
    }

    if (mediaElement.currentTime >= Math.max(range.start, range.end - 0.05)) {
      seekToLoopStart(mediaElement, range);
    }
  }

  function handleLoopMetadata() {
    if (!mediaElement) {
      return;
    }

    ensureLoopRange(mediaElement);
    syncLoopUiState();
  }

  function handleLoopEnded() {
    if (!loopEnabled || !mediaElement) {
      return;
    }

    const range = ensureLoopRange(mediaElement);
    seekToLoopStart(mediaElement, range);
    mediaElement.play().catch(() => {});
  }

  function bindVideoEvents() {
    const nextVideo = getVideoElement();
    if (!nextVideo || nextVideo === mediaElement) {
      return;
    }

    if (mediaElement) {
      updateMediaEventBindings(mediaElement, 'removeEventListener');
      mediaElement.loop = false;
    }

    mediaElement = nextVideo;
    mediaElement.loop = false;
    updateMediaEventBindings(mediaElement, 'addEventListener');
    handleLoopMetadata();
  }

  function unbindVideoEvents() {
    if (!mediaElement) {
      return;
    }

    updateMediaEventBindings(mediaElement, 'removeEventListener');
    mediaElement.loop = false;
    mediaElement = null;
  }

  function syncControlDividers(panel) {
    panel.querySelectorAll(`.${CONTROL_DIVIDER_CLASS}`).forEach((divider) => divider.remove());

    const buttons = Array.from(panel.querySelectorAll(`.${BTN_CLASS}`));
    buttons.slice(0, -1).forEach((btn) => {
      btn.insertAdjacentElement('afterend', createControlDivider());
    });
  }

  function normaliseButtonPosition(position, buttonCount) {
    if (!Number.isInteger(position)) {
      return buttonCount;
    }

    return Math.max(0, Math.min(position, buttonCount));
  }

  function addPanelButton(panel, { id, text, onClick, iconMarkup = '', position } = {}) {
    if (!panel || !text || typeof onClick !== 'function') {
      return null;
    }

    const btn = createButton(id, text, onClick, iconMarkup);
    const buttons = Array.from(panel.querySelectorAll(`.${BTN_CLASS}`));
    const insertAt = normaliseButtonPosition(position, buttons.length);
    const nextButton = buttons[insertAt];

    if (nextButton) {
      panel.insertBefore(btn, nextButton);
    } else {
      panel.appendChild(btn);
    }

    syncControlDividers(panel);
    return btn;
  }

  function syncActiveState() {
    const scope = getTheatreScope();

    scope?.classList.add(SCOPE_CONTROLS_CLASS);
    scope?.classList.toggle(SCOPE_THEATRE_CLASS, active);
    playerContainer?.classList.toggle(PLAYER_THEATRE_CLASS, active);
    controlRow?.classList.toggle(CONTROL_ROW_ACTIVE_CLASS, active);

    if (button) {
      button.classList.toggle(BTN_ACTIVE_CLASS, active);
      button.classList.toggle(BTN_THEATRE_CLASS, active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    syncOverlayTheme();
    syncLoopUiState();
  }

  function ensureMounted() {
    ensureMountScheduled = false;

    if (!playerContainer || !document.contains(playerContainer)) {
      return;
    }

    const scope = getTheatreScope();
    if (!scope || !scope.parentElement) {
      return;
    }

    bindVideoEvents();

    const rowIsMounted =
      controlRow &&
      document.contains(controlRow) &&
      controlRow.parentElement === scope;
    const buttonIsMounted = button && document.contains(button) && controlRow?.contains(button);
    const loopButtonIsMounted = loopButton && document.contains(loopButton) && controlRow?.contains(loopButton);
    const loopPopoverIsMounted = loopPopover && document.contains(loopPopover) && loopPopover.parentElement === controlRow;

    if (!rowIsMounted || !buttonIsMounted || !loopButtonIsMounted || !loopPopoverIsMounted) {
      injectButton();
    }

    syncActiveState();
  }

  function scheduleEnsureMounted() {
    if (ensureMountScheduled) {
      return;
    }

    ensureMountScheduled = true;
    requestAnimationFrame(ensureMounted);
  }

  function startDomObserver() {
    if (observer) {
      return;
    }

    observer = new MutationObserver(() => {
      scheduleEnsureMounted();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function toggle() {
    if (active) deactivate();
    else activate();
  }

  function activate() {
    if (!playerContainer) return;
    active = true;

    if (removalTimer) {
      clearTimeout(removalTimer);
      removalTimer = null;
    }

    overlay?.remove();
    overlay = createOverlay();
    document.body.appendChild(overlay);

    // Force the initial transparent state to commit before fading in.
    overlay.getBoundingClientRect();
    requestAnimationFrame(() => overlay.classList.add(VISIBLE_CLASS));

    syncActiveState();
  }

  function deactivate() {
    if (overlay) {
      overlay.classList.remove(VISIBLE_CLASS);
      const o = overlay;
      removalTimer = setTimeout(() => {
        o.remove();
        active = false;
        syncActiveState();
        removalTimer = null;
      }, 300);
      return;
    }

    active = false;
    syncActiveState();
  }

  function injectButton() {
    const scope = getTheatreScope();
    if (!scope || !scope.parentElement) {
      return;
    }

    bindVideoEvents();

    const existingLoopButton = document.getElementById(LOOP_BUTTON_ID);
    const existingButton = document.getElementById(BUTTON_ID);
    const existingRow = document.getElementById(CONTROL_ROW_ID);
    const existingPanel = existingRow?.querySelector(`.${CONTROL_PANEL_CLASS}`);
    const existingLoopPopover = document.getElementById(LOOP_POPOVER_ID);

    if (
      existingRow &&
      existingRow.parentElement === scope &&
      existingLoopButton &&
      existingButton &&
      existingPanel &&
      existingLoopPopover
    ) {
      controlRow = existingRow;
      loopButton = existingLoopButton;
      button = existingButton;
      loopPopover = existingLoopPopover;
      scope.classList.add(SCOPE_CONTROLS_CLASS);
      syncActiveState();
      return;
    }

    existingLoopButton?.remove();
    existingButton?.remove();
    existingLoopPopover?.remove();
    existingRow?.remove();

    controlRow = createControlRow();
    const controlPanel = createControlPanel();
    loopButton = addPanelButton(controlPanel, {
      id: LOOP_BUTTON_ID,
      text: 'Loop',
      onClick: () => toggleLoopPopover(),
      iconMarkup: loopIconMarkup,
      position: 0,
    });
    button = addPanelButton(controlPanel, {
      id: BUTTON_ID,
      text: 'Theatre',
      onClick: () => toggle(),
      iconMarkup: theatreIconMarkup,
      position: 1,
    });
    loopButton?.setAttribute('aria-pressed', 'false');
    loopButton?.setAttribute('aria-expanded', 'false');
    button?.setAttribute('aria-pressed', 'false');
    loopPopover = createLoopPopover();
    controlRow.appendChild(controlPanel);
    controlRow.appendChild(loopPopover);
    scope.classList.add(SCOPE_CONTROLS_CLASS);
    scope.appendChild(controlRow);
    syncActiveState();
  }

  function removeButton() {
    loopPopoverOpen = false;
    getTheatreScope()?.classList.remove(SCOPE_CONTROLS_CLASS);
    loopPopover?.remove();
    loopPopover = null;
    controlRow?.remove();
    controlRow = null;
    loopButton?.remove();
    loopButton = null;
    button?.remove();
    button = null;
  }

  function fullCleanup() {
    if (active) deactivate();
    if (removalTimer) {
      clearTimeout(removalTimer);
      removalTimer = null;
    }
    if (urlCheckTimer) {
      clearInterval(urlCheckTimer);
      urlCheckTimer = null;
    }
    if (initTimer) {
      clearTimeout(initTimer);
      initTimer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    unbindVideoEvents();
    overlay?.remove();
    overlay = null;
    removeButton();
    playerContainer = null;
    loopEnabled = false;
    loopPopoverOpen = false;
    loopRangeCustomised = false;
    loopStartSeconds = 0;
    loopEndSeconds = null;
  }

  function tryInit() {
    const player = findPlayerContainer();
    if (player) {
      playerContainer = player.container;
      bindVideoEvents();
      injectButton();
      startUrlMonitor();
      startDomObserver();
      return;
    }

    initAttempts++;
    if (initAttempts < MAX_INIT_ATTEMPTS) {
      initTimer = setTimeout(tryInit, INIT_RETRY_MS);
    }
  }

  function startUrlMonitor() {
    lastUrl = location.href;
    urlCheckTimer = setInterval(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        onUrlChange();
        return;
      }

      if (playerContainer && !document.contains(playerContainer)) {
        onUrlChange();
        return;
      }

      const player = findPlayerContainer();
      const nextContainer = player?.container || null;

      if (playerContainer && nextContainer && nextContainer !== playerContainer) {
        onUrlChange();
        return;
      }

      if (!nextContainer && playerContainer) {
        onUrlChange();
        return;
      }

      bindVideoEvents();
      scheduleEnsureMounted();
    }, URL_CHECK_MS);
  }

  function onUrlChange() {
    fullCleanup();
    initAttempts = 0;
    tryInit();
  }

  document.addEventListener('click', (event) => {
    if (loopPopoverOpen && controlRow && !controlRow.contains(event.target)) {
      setLoopPopoverOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && loopPopoverOpen) {
      setLoopPopoverOpen(false);
      return;
    }

    if (e.key === 'Escape' && active) {
      deactivate();
    }
  });

  tryInit();
})();
