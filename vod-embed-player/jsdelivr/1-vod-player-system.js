/* Generated from 1-vod-player-system.html - edit the .html, then regenerate. */
(function () {

  /* =========================
     PLAYER DEBUG SYSTEM
  ========================= */

  let debugEnabled = false;

  function debugLog(...args) {

    if (!debugEnabled) return;

    console.log(
      "[VODPlayer]",
      ...args
    );

  }

  function debugWarn(...args) {

    if (!debugEnabled) return;

    console.warn(
      "[VODPlayer]",
      ...args
    );

  }


  function fixYouTubeIframe() {

    const iframe =
      document.querySelector("#youtube_embedplayer iframe") ||
      document.querySelector("iframe#youtube_embedplayer");

    if (!iframe) {

      debugLog(
        "YouTube iframe not found yet"
      );

      return false;
    }

    let src = iframe.src;


    /* Replace nocookie domain */

    if (src.includes("youtube-nocookie.com")) {

      src = src.replace(
        "youtube-nocookie.com",
        "youtube.com"
      );

    }


    /* Enable JavaScript API */

    if (src.includes("enablejsapi=0")) {

      src = src.replace(
        "enablejsapi=0",
        "enablejsapi=1"
      );

    } else if (!src.includes("enablejsapi=")) {

      const joiner =
        src.includes("?") ? "&" : "?";

      src +=
        joiner + "enablejsapi=1";

    }


    if (iframe.src !== src) {

      console.log(
        "[VODPlayer] Updating iframe parameters"
      );

      iframe.src = src;

    }

    return true;

  }


  /* Retry until Webstudio has rendered the iframe (up to 30s).
     Harmless once fixed: src only changes when it differs. */

  let fixAttempts = 0;

  const fixInterval =
    setInterval(
      function () {

        fixAttempts++;

        fixYouTubeIframe();

        if (fixAttempts >= 60) {
          clearInterval(fixInterval);
        }

      },
      500
    );

})();
(function () {

  /* =========================
     CONFIG
  ========================= */

  const STORAGE_KEY =
    "joqnix_vod_playback";


  /* =========================
     DEBUG SYSTEM
  ========================= */

  let debugEnabled = false;


  function debugLog(...args) {

    if (!debugEnabled) return;

    console.log(
      "[VODPlayer]",
      ...args
    );

  }


  function debugWarn(...args) {

    if (!debugEnabled) return;

    console.warn(
      "[VODPlayer]",
      ...args
    );

  }


  function debugError(...args) {

    if (!debugEnabled) return;

    console.error(
      "[VODPlayer]",
      ...args
    );

  }


  /* =========================
     INTERNAL STATE
  ========================= */

  let iframeReadyInterval = null;
  let progressInterval = null;

  let restorePending = false;
  let restoreAttempted = false;

  let savedPlayback = null;

  let currentVideoId = null;
  let currentPlaylistIndex = null;


  /* =========================
     GLOBAL PLAYER
  ========================= */

  window.player = null;


  /* =========================
     GLOBAL VOD STATE
  ========================= */

  window.VODPlayer = {

    ready: false,

    currentVideoId: null,

    currentPlaylistIndex: null,

    restored: false,

    storageKey: STORAGE_KEY,

    /* =========================
       DEBUG CONTROL
    ========================= */

    debug: function (value) {

      if (typeof value === "boolean") {

        debugEnabled = value;

        console.log(
          "[VODPlayer] Debug mode:",
          debugEnabled ? "ON" : "OFF"
        );

        return debugEnabled;

      }

      console.log(
        "[VODPlayer] Debug mode:",
        debugEnabled ? "ON" : "OFF"
      );

      return debugEnabled;

    }

  };


  /* =========================
     LOAD SAVED PLAYBACK
  ========================= */

  function loadSavedPlayback() {

    try {

      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {

        debugLog(
          "No saved playback state"
        );

        return null;

      }


      const parsed =
        JSON.parse(raw);


      if (!parsed || typeof parsed !== "object") {
        return null;
      }


      debugLog(
        "Saved playback found:",
        parsed
      );


      return parsed;

    } catch (error) {

      console.warn(
        "[VODPlayer] Failed to read saved playback:",
        error
      );

      return null;

    }

  }


  savedPlayback =
    loadSavedPlayback();


  /* =========================
     SAVE PLAYBACK
  ========================= */

  function savePlayback() {

    if (!window.player) return;

    try {

      const data =
        window.player.getVideoData();


      if (!data || !data.video_id) {
        return;
      }


      const videoId =
        data.video_id;


      const index =
        window.player.getPlaylistIndex();


      const timestamp =
        window.player.getCurrentTime();


      const duration =
        window.player.getDuration();


      const state = {

        cycleId:
          window.VODCycle?.cycleId || null,

        videoId:
          videoId,

        playlistIndex:
          typeof index === "number"
            ? index
            : null,

        timestamp:
          Number.isFinite(timestamp)
            ? timestamp
            : 0,

        duration:
          Number.isFinite(duration)
            ? duration
            : 0,

        savedAt:
          Date.now()

      };


      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );


      debugLog(
        "Playback saved:",
        state
      );


      window.VODPlayer.currentVideoId =
        videoId;

      window.VODPlayer.currentPlaylistIndex =
        index;


    } catch (error) {

      console.warn(
        "[VODPlayer] Failed to save playback:",
        error
      );

    }

  }


  /* =========================
     CLEAR SAVED PLAYBACK
  ========================= */

  function clearSavedPlayback() {

    try {

      localStorage.removeItem(
        STORAGE_KEY
      );

      console.log(
        "[VODPlayer] Saved playback cleared"
      );

    } catch (error) {

      console.warn(
        "[VODPlayer] Failed to clear playback:",
        error
      );

    }

  }


  window.VODPlayer.clearSavedPlayback =
    clearSavedPlayback;


  /* =========================
     CHECK CYCLE MATCH
  ========================= */

  function playbackBelongsToCurrentCycle() {

    if (!savedPlayback) {
      return false;
    }


    const currentCycle =
      window.VODCycle?.cycleId;


    if (!currentCycle) {

      debugLog(
        "Cycle not known yet"
      );

      return false;

    }


    if (
      savedPlayback.cycleId !== currentCycle
    ) {

      debugLog(
        "Saved playback belongs to old cycle"
      );

      return false;

    }


    return true;

  }


  /* =========================
     WAIT FOR CYCLE
  ========================= */

  function waitForCycleBeforeRestore() {

    if (!window.VODCycle?.ready) {

      setTimeout(
        waitForCycleBeforeRestore,
        250
      );

      return;

    }


    if (!playbackBelongsToCurrentCycle()) {

      debugLog(
        "No valid playback state for current cycle"
      );

      restoreAttempted = true;

      return;

    }


    restorePending = true;

    attemptRestore();

  }


  /* =========================
     WAIT FOR IFRAME
  ========================= */

  function waitForIframe() {

    const iframe =
      document.querySelector(
        "#youtube_embedplayer iframe"
      ) ||
      document.querySelector(
        "iframe#youtube_embedplayer"
      );


    if (!iframe) {
      return;
    }


    /* API script must be loaded */

    if (!window.YT || !window.YT.Player) {
      return;
    }


    /* iframe must already have enablejsapi=1 (set by the fixer) */

    if (!iframe.src.includes("enablejsapi=1")) {
      return;
    }


    clearInterval(
      iframeReadyInterval
    );


    console.log(
      "[VODPlayer] YouTube iframe found"
    );


    initPlayer(iframe);

  }


  /* =========================
     YOUTUBE API READY
  ========================= */

  window.onYouTubeIframeAPIReady =
    function () {

      console.log(
        "[VODPlayer] YouTube IFrame API ready"
      );


      startIframePolling();

    };


  /* Poll from page load instead of relying only on the API-ready
     callback, which can be missed or never fire. */

  function startIframePolling() {

    if (iframeReadyInterval || window.player) {
      return;
    }

    iframeReadyInterval =
      setInterval(
        waitForIframe,
        500
      );

  }

  startIframePolling();


  /* Re-inject the API script if it has not loaded (every 10s, 3 tries) */

  let apiRetries = 0;

  const apiRetryInterval =
    setInterval(
      function () {

        if (window.YT && window.YT.Player) {
          clearInterval(apiRetryInterval);
          return;
        }

        apiRetries++;

        if (apiRetries > 3) {
          clearInterval(apiRetryInterval);
          return;
        }

        console.warn(
          "[VODPlayer] YouTube API not loaded, retrying (" +
          apiRetries + ")"
        );

        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);

      },
      10000
    );


  /* =========================
     PLAYER INITIALIZATION
  ========================= */

  function initPlayer(iframe) {

    if (window.player) {

      debugLog(
        "Player already initialized"
      );

      return;

    }


    console.log(
      "[VODPlayer] Initializing player"
    );


    window.player =
      new YT.Player(
        iframe,
        {

          events: {

            onReady:
              onPlayerReady,

            onStateChange:
              onPlayerStateChange

          }

        }
      );


    debugLog(
      "Player created"
    );

  }


  /* =========================
     PLAYER READY
  ========================= */

  function onPlayerReady() {

    console.log(
      "[VODPlayer] Player ready"
    );


    window.VODPlayer.ready =
      true;


    updateVideoMeta();
    updatePlaylistPosition();


    /* Start waiting for cycle information */

    waitForCycleBeforeRestore();

  }


  /* =========================
     PLAYER STATE CHANGE
  ========================= */

  function onPlayerStateChange(event) {

    if (!window.player) {
      return;
    }


    debugLog(
      "Player state changed:",
      event.data
    );


    if (
      event.data ===
        YT.PlayerState.PLAYING ||

      event.data ===
        YT.PlayerState.CUED ||

      event.data ===
        YT.PlayerState.BUFFERING
    ) {

      updateVideoMeta();
      updatePlaylistPosition();

    }


    if (
      event.data ===
      YT.PlayerState.PLAYING
    ) {

      startProgressTracking();

      updatePlaybackState();

    }


    if (
      event.data ===
      YT.PlayerState.PAUSED
    ) {

      savePlayback();

    }


    if (
      event.data ===
      YT.PlayerState.ENDED
    ) {

      savePlayback();

    }


    /*
       Detect video changes shortly after
       YouTube advances the playlist.
    */

    setTimeout(
      updatePlaybackState,
      500
    );

  }


  /* =========================
     UPDATE PLAYBACK STATE
  ========================= */

  function updatePlaybackState() {

    if (!window.player) {
      return;
    }


    try {

      const data =
        window.player.getVideoData();


      if (!data || !data.video_id) {
        return;
      }


      const id =
        data.video_id;


      const index =
        window.player.getPlaylistIndex();


      if (
        currentVideoId !== id ||
        currentPlaylistIndex !== index
      ) {

        console.log(
          "[VODPlayer] Video state changed:",
          {
            videoId: id,
            playlistIndex: index
          }
        );


        currentVideoId =
          id;


        currentPlaylistIndex =
          index;


        window.VODPlayer.currentVideoId =
          id;


        window.VODPlayer.currentPlaylistIndex =
          index;


        updateVideoMeta();
        updatePlaylistPosition();

      }


    } catch (error) {

      console.warn(
        "[VODPlayer] Failed to update playback state:",
        error
      );

    }

  }


  /* =========================
     RESTORE PLAYBACK
  ========================= */

  function attemptRestore() {

    if (
      restoreAttempted ||
      !restorePending
    ) {
      return;
    }


    if (
      !window.player ||
      !window.VODPlayer.ready
    ) {

      setTimeout(
        attemptRestore,
        250
      );

      return;

    }


    if (
      !window.VODCycle?.ready
    ) {

      setTimeout(
        attemptRestore,
        250
      );

      return;

    }


    restoreAttempted =
      true;


    if (
      !playbackBelongsToCurrentCycle()
    ) {

      debugLog(
        "Restore skipped because cycle does not match"
      );

      return;

    }


    const playlist =
      window.player.getPlaylist();


    if (
      !playlist ||
      !playlist.length
    ) {

      debugLog(
        "Playlist not ready, retrying restore"
      );


      restoreAttempted =
        false;


      setTimeout(
        attemptRestore,
        500
      );


      return;

    }


    const targetIndex =
      Number(
        savedPlayback.playlistIndex
      );


    const targetVideoId =
      savedPlayback.videoId;


    let index =
      Number.isInteger(targetIndex)
        ? targetIndex
        : -1;


    /*
       Verify that the saved index still
       corresponds to the saved video.
    */

    if (
      index < 0 ||
      index >= playlist.length ||
      playlist[index] !== targetVideoId
    ) {

      index =
        playlist.indexOf(
          targetVideoId
        );

    }


    if (index < 0) {

      console.log(
        "[VODPlayer] Saved video is not in current playlist"
      );

      return;

    }


    const timestamp =
      Math.max(
        0,
        Number(
          savedPlayback.timestamp
        ) || 0
      );


    console.log(
      "[VODPlayer] Restoring playback:",
      {
        videoId: targetVideoId,
        playlistIndex: index,
        timestamp
      }
    );


    try {

      /*
         Jump to the saved playlist item.
      */

      window.player.playVideoAt(
        index
      );


      /*
         Seek after YouTube has switched
         to the target video.
      */

      const seekInterval =
        setInterval(
          () => {

            if (!window.player) {
              return;
            }


            const data =
              window.player.getVideoData();


            if (
              !data ||
              data.video_id !== targetVideoId
            ) {
              return;
            }


            const duration =
              window.player.getDuration();


            if (!duration) {
              return;
            }


            clearInterval(
              seekInterval
            );


            const safeTimestamp =
              Math.min(
                timestamp,
                Math.max(
                  0,
                  duration - 3
                )
              );


            window.player.seekTo(
              safeTimestamp,
              true
            );


            window.VODPlayer.restored =
              true;


            console.log(
              "[VODPlayer] Playback restored at:",
              safeTimestamp
            );


            updateVideoMeta();
            updatePlaylistPosition();
            updatePlaybackState();


          },
          250
        );


      /*
         Safety timeout.
      */

      setTimeout(
        () => {

          clearInterval(
            seekInterval
          );

        },
        10000
      );


    } catch (error) {

      console.error(
        "[VODPlayer] Restore failed:",
        error
      );

    }

  }


  /* =========================
     METADATA
  ========================= */

  function updateVideoMeta() {

    if (!window.player) {
      return;
    }


    try {

      const data =
        window.player.getVideoData();


      const title =
        data?.title ||
        "Loading Title...";


      const duration =
        window.player.getDuration();


      setText(
        "yt-title",
        title
      );


      setText(
        "yt-duration",
        formatTime(duration)
      );


    } catch (error) {

      console.warn(
        "[VODPlayer] Metadata update failed:",
        error
      );

    }

  }


  /* =========================
     PLAYLIST POSITION
  ========================= */

  function updatePlaylistPosition() {

    if (!window.player) {
      return;
    }


    try {

      const playlist =
        window.player.getPlaylist();


      const index =
        window.player.getPlaylistIndex();


      if (
        !playlist ||
        index === undefined ||
        index === null
      ) {
        return;
      }


      const position =
        index + 1;


      const total =
        playlist.length;


      setText(
        "yt-playlist-position",
        `#${position}/${total}`
      );


    } catch (error) {

      console.warn(
        "[VODPlayer] Playlist position update failed:",
        error
      );

    }

  }


  /* =========================
     PROGRESS TRACKING
  ========================= */

  function startProgressTracking() {

    clearInterval(
      progressInterval
    );


    progressInterval =
      setInterval(
        () => {

          if (!window.player) {
            return;
          }


          try {

            const current =
              window.player.getCurrentTime();


            const duration =
              window.player.getDuration();


            if (!duration) {
              return;
            }


            const remaining =
              duration - current;


            const percent =
              (current / duration) * 100;


            setText(
              "yt-current",
              formatTime(current)
            );


            setText(
              "yt-remaining",
              formatTime(remaining)
            );


            setText(
              "yt-progress-percent",
              percent.toFixed(2) + "%"
            );


            /*
               Save every 5 seconds.

               This gives us a reasonably accurate
               restore point without writing to
               localStorage every second.
            */

            if (
              Math.floor(current) % 5 === 0
            ) {

              savePlayback();

            }


          } catch (error) {

            console.warn(
              "[VODPlayer] Progress update failed:",
              error
            );

          }

        },
        1000
      );

  }


  /* =========================
     SAVE BEFORE PAGE LEAVES
  ========================= */

  function saveBeforeLeave() {

    console.log(
      "[VODPlayer] Saving playback before page leave"
    );


    savePlayback();

  }


  window.addEventListener(
    "pagehide",
    saveBeforeLeave
  );


  window.addEventListener(
    "beforeunload",
    saveBeforeLeave
  );


  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.visibilityState ===
        "hidden"
      ) {

        savePlayback();

      }

    }
  );


  /* =========================
     HELPERS
  ========================= */

  function setText(
    id,
    value
  ) {

    const el =
      document.getElementById(id);


    if (el) {
      el.innerText = value;
    }

  }


  function formatTime(sec) {

    if (
      !Number.isFinite(sec) ||
      sec < 0
    ) {

      return "0:00";

    }


    sec =
      Math.floor(sec);


    const h =
      Math.floor(
        sec / 3600
      );


    const m =
      Math.floor(
        (sec % 3600) / 60
      );


    const s =
      sec % 60;


    if (h > 0) {

      return (
        `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );

    }


    return (
      `${m}:${String(s).padStart(2, "0")}`
    );

  }


})();

/* Load the YouTube IFrame API (the .html version uses a script tag). */
(function () {
  if (window.YT && window.YT.Player) return;
  if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) return;
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
})();
