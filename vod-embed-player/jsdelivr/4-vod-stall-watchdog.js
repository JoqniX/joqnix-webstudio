/* Generated from 4-vod-stall-watchdog.html - edit the .html, then regenerate. */
(function () {
  "use strict";

  /* ==========================================
     CONFIG
  ========================================== */

  const CHECK_INTERVAL = 5000;

  // Reload if the player has not been PLAYING for this long
  // (covers paused, buffering, unstarted, cued and ended).
  const NOT_PLAYING_LIMIT = 10 * 60 * 1000;

  // Shorter limit used until the player has PLAYED once after page
  // load. Covers the player never being created (YouTube API did
  // not load) or never starting playback.
  const STARTUP_LIMIT = 45 * 1000;

  // Reload if this many unavailable-video errors happen
  // within ERROR_WINDOW (the playlist is likely broken
  // or the player is in a bad state).
  const ERROR_BURST_COUNT = 5;
  const ERROR_WINDOW = 60 * 1000;

  // Loop guard: never reload more than MAX_RELOADS times
  // within RELOAD_WINDOW.
  const MAX_RELOADS = 5;
  const RELOAD_WINDOW = 30 * 60 * 1000;

  const RELOAD_LOG_KEY = "joqnix_vod_watchdog_reloads";

  // YT.PlayerState values (kept numeric so this script
  // does not depend on the YT global).
  const STATE_PLAYING = 1;

  let debugEnabled = false;
  let started = false;
  let reloadStarted = false;

  // Counts from page load, so "player never appeared" is timed too.
  let notPlayingSince = Date.now();
  let hasPlayed = false;
  let errorTimes = [];

  /* ==========================================
     LOGGING
  ========================================== */

  function log(...args) {
    if (debugEnabled) {
      console.log("[VODWatchdog]", ...args);
    }
  }

  function warn(...args) {
    console.warn("[VODWatchdog]", ...args);
  }

  /* ==========================================
     RELOAD LOOP GUARD
  ========================================== */

  function readReloadLog() {
    try {
      const raw = sessionStorage.getItem(RELOAD_LOG_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const cutoff = Date.now() - RELOAD_WINDOW;

      return Array.isArray(parsed)
        ? parsed.filter(function (t) { return t > cutoff; })
        : [];
    } catch (err) {
      return [];
    }
  }

  function writeReloadLog(times) {
    try {
      sessionStorage.setItem(RELOAD_LOG_KEY, JSON.stringify(times));
    } catch (err) {
      // sessionStorage unavailable; guard degrades to per-load only.
    }
  }

  function reloadPage(reason) {
    if (reloadStarted) {
      return;
    }

    const recent = readReloadLog();

    if (recent.length >= MAX_RELOADS) {
      warn(
        "Reload blocked by loop guard (" +
        recent.length + " reloads in the last " +
        Math.round(RELOAD_WINDOW / 60000) + " min). Reason was:",
        reason
      );

      // Restart the timers so we retry after another full window
      // instead of re-triggering every check.
      notPlayingSince = Date.now();
      errorTimes = [];
      return;
    }

    reloadStarted = true;

    recent.push(Date.now());
    writeReloadLog(recent);

    warn("Reloading page:", reason);

    location.reload();
  }

  /* ==========================================
     PLAYER ACCESS
  ========================================== */

  function getPlayer() {
    const player = window.player;

    if (
      !player ||
      typeof player.getPlayerState !== "function"
    ) {
      return null;
    }

    return player;
  }

  /* ==========================================
     ERROR BURST DETECTION
  ========================================== */

  window.__joqnixVODWatchdogOnError = function (event) {
    if (!event || typeof event.data !== "number") {
      return;
    }

    // 100: not found / private, 101 & 150: embedding blocked.
    if (![100, 101, 150].includes(event.data)) {
      return;
    }

    const now = Date.now();

    errorTimes.push(now);
    errorTimes = errorTimes.filter(function (t) {
      return now - t <= ERROR_WINDOW;
    });

    log("Unavailable-video error:", event.data, "recent:", errorTimes.length);

    if (errorTimes.length >= ERROR_BURST_COUNT) {
      reloadPage(
        errorTimes.length + " unavailable-video errors within " +
        Math.round(ERROR_WINDOW / 1000) + "s"
      );
    }
  };

  function attachErrorHandler(player) {
    if (player.__joqnixWatchdogAttached) {
      return;
    }

    try {
      if (typeof player.addEventListener !== "function") {
        return;
      }

      player.addEventListener(
        "onError",
        "__joqnixVODWatchdogOnError"
      );

      player.__joqnixWatchdogAttached = true;

      log("Error handler attached.");
    } catch (err) {
      warn("Could not attach error handler:", err);
    }
  }

  /* ==========================================
     NOT-PLAYING MONITOR
  ========================================== */

  function check() {
    const now = Date.now();
    const limit = hasPlayed ? NOT_PLAYING_LIMIT : STARTUP_LIMIT;
    const player = getPlayer();

    let state = null;

    if (player) {
      attachErrorHandler(player);

      try {
        state = player.getPlayerState();
      } catch (err) {
        state = null;
      }
    }

    if (state === STATE_PLAYING) {
      if (!hasPlayed) {
        hasPlayed = true;

        // Healthy start: give future failures a fresh reload budget.
        writeReloadLog([]);

        log("Playback confirmed.");
      }

      notPlayingSince = null;
      return;
    }

    if (notPlayingSince === null) {
      notPlayingSince = now;
      log("Player left PLAYING state:", state);
      return;
    }

    const elapsed = now - notPlayingSince;

    log(
      "Not playing for", Math.round(elapsed / 1000), "s, state:",
      state === null ? "no player" : state
    );

    if (elapsed >= limit) {
      reloadPage(
        (hasPlayed ? "Player stalled" : "Player never started") +
        " for " + Math.round(elapsed / 1000) + "s (" +
        (state === null ? "no player" : "state " + state) + ")"
      );
    }
  }

  /* ==========================================
     PUBLIC CONTROLS
  ========================================== */

  window.VODWatchdog = {
    ready: false,

    debug(value) {
      if (typeof value === "boolean") {
        debugEnabled = value;
      }

      console.log(
        "[VODWatchdog] Debug:",
        debugEnabled ? "ON" : "OFF"
      );

      return debugEnabled;
    },

    status() {
      const result = {
        ready: this.ready,
        debug: debugEnabled,
        hasPlayed: hasPlayed,
        notPlayingForSeconds:
          notPlayingSince === null
            ? 0
            : Math.round((Date.now() - notPlayingSince) / 1000),
        recentErrors: errorTimes.length,
        recentReloads: readReloadLog().length
      };

      console.log("[VODWatchdog] Status:", result);
      return result;
    }
  };

  /* ==========================================
     STARTUP
  ========================================== */

  function start() {
    if (started) {
      return;
    }

    started = true;
    window.VODWatchdog.ready = true;

    setInterval(check, CHECK_INTERVAL);

    log("Watchdog started.");
  }

  // Start immediately; check() handles the player not existing yet.
  start();

})();
