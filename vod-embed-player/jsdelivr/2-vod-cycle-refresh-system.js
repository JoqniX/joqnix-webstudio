/* Generated from 2-vod-cycle-refresh-system.html - edit the .html, then regenerate. */
(function () {

  /* =========================
     CONFIG
  ========================= */

  const STATUS_URL =
    "https://api.joqnix.space/vodcycle/status";

  const POLL_INTERVAL =
    5 * 60 * 1000;


  /* =========================
     STATE
  ========================= */

  let refreshPending = false;

  let currentCycleId = null;

  let lastVideoId = null;

  let playerReady = false;

  let statusReady = false;

  let debugEnabled = false;


  /* =========================
     DEBUG LOGGER
  ========================= */

  function debugLog(...args) {

    if (!debugEnabled) {
      return;
    }

    console.log(
      "[VODCycle]",
      ...args
    );

  }


  function debugWarn(...args) {

    if (!debugEnabled) {
      return;
    }

    console.warn(
      "[VODCycle]",
      ...args
    );

  }


  function importantLog(...args) {

    console.log(
      "[VODCycle]",
      ...args
    );

  }


  function errorLog(...args) {

    console.error(
      "[VODCycle]",
      ...args
    );

  }


  /* =========================
     GLOBAL CYCLE STATE
  ========================= */

  window.VODCycle = {

    ready: false,

    cycleId: null,

    expiresAt: null,

    generatedAt: null,

    videoCount: null,

    refreshPending: false,


    /*
       Enable / disable detailed
       debugging from DevTools.

       Examples:

       VODCycle.debug(true)
       VODCycle.debug(false)
       VODCycle.debug()
    */

    debug: function (value) {

      if (
        typeof value ===
        "undefined"
      ) {

        console.log(
          "[VODCycle] Debug mode:",
          debugEnabled
            ? "ON"
            : "OFF"
        );

        return debugEnabled;

      }


      debugEnabled =
        Boolean(value);


      console.log(
        "[VODCycle] Debug mode:",
        debugEnabled
          ? "ON"
          : "OFF"
      );


      return debugEnabled;

    },


    /*
       Show current cycle state
       and player state.
    */

    status: function () {

      const status = {

        ready:
          statusReady,

        playerReady,

        cycleId:
          currentCycleId,

        refreshPending,

        lastVideoId,

        debug:
          debugEnabled,

        global:
          {
            ...window.VODCycle
          }

      };


      console.log(
        "[VODCycle] Current status:",
        status
      );


      return status;

    }

  };


  /* =========================
     BOOT
  ========================= */

  importantLog(
    "Booting"
  );


  /* =========================
     HIDE NOTICE ON INIT
  ========================= */

  function initRefreshNoticeBar() {

    const interval =
      setInterval(
        () => {

          const bar =
            document.getElementById(
              "refresh-notice-bar"
            );


          if (!bar) {
            return;
          }


          bar.style.display =
            "none";


          debugLog(
            "Notice bar hidden on init"
          );


          clearInterval(
            interval
          );

        },
        500
      );

  }


  initRefreshNoticeBar();


  /* =========================
     SHOW NOTICE
  ========================= */

  function showRefreshNotice(
    text
  ) {

    debugLog(
      "Showing refresh notice"
    );


    const interval =
      setInterval(
        () => {

          const bar =
            document.getElementById(
              "refresh-notice-bar"
            );

          const label =
            document.getElementById(
              "yt-refresh-notice"
            );


          if (!bar || !label) {
            return;
          }


          label.innerText =
            text;


          bar.style.display =
            "flex";


          clearInterval(
            interval
          );


          debugLog(
            "Refresh notice displayed"
          );

        },
        250
      );

  }


  /* =========================
     PLAYER READY WATCHER
  ========================= */

  const playerWaiter =
    setInterval(
      () => {

        if (
          window.player &&
          typeof window.player.getVideoData ===
            "function"
        ) {

          playerReady =
            true;


          debugLog(
            "API Player ready"
          );


          clearInterval(
            playerWaiter
          );

        }

      },
      500
    );


  /* =========================
     FETCH CYCLE STATUS
  ========================= */

  async function fetchCycleStatus() {

    try {

      debugLog(
        "Checking cycle status..."
      );


      const response =
        await fetch(
          STATUS_URL +
            "?t=" +
            Date.now(),
          {
            method:
              "GET",

            cache:
              "no-store",

            headers: {
              "Accept":
                "application/json"
            }
          }
        );


      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );

      }


      const data =
        await response.json();


      if (
        !data ||
        !data.ok ||
        !data.cycle
      ) {

        throw new Error(
          "Invalid VOD cycle response"
        );

      }


      const cycle =
        data.cycle;


      const newCycleId =
        cycle.cycleId;


      debugLog(
        "Cycle status:",
        cycle
      );


      /*
         First successful status check.

         We don't refresh on initial page load.
         We simply establish the current cycle.
      */

      if (!statusReady) {

        currentCycleId =
          newCycleId;


        window.VODCycle.cycleId =
          newCycleId;

        window.VODCycle.expiresAt =
          cycle.expiresAt ||
          null;

        window.VODCycle.generatedAt =
          cycle.generatedAt ||
          null;

        window.VODCycle.videoCount =
          cycle.videoCount ||
          null;


        statusReady =
          true;

        window.VODCycle.ready =
          true;


        importantLog(
          "Initial cycle established:",
          newCycleId
        );


        return;

      }


      /*
         Cycle changed.

         This means either:
         - the 14-day cycle expired
         - Notion active playlists changed
         - /run was manually triggered
      */

      if (
        newCycleId !==
        currentCycleId
      ) {

        importantLog(
          "NEW CYCLE DETECTED"
        );


        debugLog(
          "Previous cycle:",
          currentCycleId
        );


        debugLog(
          "New cycle:",
          newCycleId
        );


        currentCycleId =
          newCycleId;


        window.VODCycle.cycleId =
          newCycleId;

        window.VODCycle.expiresAt =
          cycle.expiresAt ||
          null;

        window.VODCycle.generatedAt =
          cycle.generatedAt ||
          null;

        window.VODCycle.videoCount =
          cycle.videoCount ||
          null;


        /*
           Tell the player that its existing
           localStorage state belongs to an
           older cycle.

           We intentionally do not clear it
           immediately because the player may
           still need to save its final state
           before the reload.
        */

        refreshPending =
          true;

        window.VODCycle.refreshPending =
          true;


        showRefreshNotice(
          "Playlist updating after this video..."
        );

      }

    } catch (error) {

      /*
         Errors are always logged.
         These are useful even when debug
         mode is disabled.
      */

      errorLog(
        "Status check failed:",
        error
      );

    }

  }


  /* =========================
     INITIAL STATUS CHECK
  ========================= */

  fetchCycleStatus();


  /* =========================
     STATUS POLLING
  ========================= */

  setInterval(
    fetchCycleStatus,
    POLL_INTERVAL
  );


  /* =========================
     VIDEO CHANGE DETECTION
  ========================= */

  function checkVideoChange() {

    if (
      !playerReady
    ) {
      return;
    }


    if (
      !window.player
    ) {
      return;
    }


    try {

      const data =
        window.player.getVideoData();


      if (!data) {
        return;
      }


      const id =
        data.video_id;


      const title =
        data.title;


      if (!id) {
        return;
      }


      /*
         Initial video.
      */

      if (!lastVideoId) {

        lastVideoId =
          id;


        debugLog(
          "Initial video:",
          title
        );


        return;

      }


      /*
         Video changed.
      */

      if (
        id !==
        lastVideoId
      ) {

        debugLog(
          "Video changed:",
          title
        );


        lastVideoId =
          id;


        const currentTime =
          window.player.getCurrentTime();


        /*
           If a new cycle is waiting,
           reload when YouTube advances
           into the next VOD.

           The old system used t < 5 as
           the indicator that this is the
           beginning of the next video.
        */

        if (
          refreshPending &&
          currentTime < 5
        ) {

          reloadForNewCycle();

        }

      }

    } catch (error) {

      debugWarn(
        "Video change check failed:",
        error
      );

    }

  }


  setInterval(
    checkVideoChange,
    2000
  );


  /* =========================
     ENDED EVENT FALLBACK
  ========================= */

  let lastKnownState =
    null;


  setInterval(
    () => {

      if (
        !playerReady ||
        !window.player
      ) {
        return;
      }


      try {

        const state =
          window.player.getPlayerState();


        if (
          state !==
          lastKnownState
        ) {

          lastKnownState =
            state;


          debugLog(
            "Player state changed:",
            state
          );


          if (
            state ===
            YT.PlayerState.ENDED
          ) {

            debugLog(
              "Current VOD ended"
            );


            if (
              refreshPending
            ) {

              importantLog(
                "Refresh pending, reloading after VOD ended"
              );


              setTimeout(
                reloadForNewCycle,
                250
              );

            }

          }

        }

      } catch (error) {

        debugWarn(
          "Player state check failed:",
          error
        );

      }

    },
    1000
  );


  /* =========================
     RELOAD
  ========================= */

  let reloadStarted =
    false;


  function reloadForNewCycle() {

    if (
      reloadStarted
    ) {
      return;
    }


    reloadStarted =
      true;


    importantLog(
      "Reloading for new cycle"
    );


    /*
       Save the current player state one
       final time before leaving.

       We intentionally clear the old cycle
       playback state so the new cycle starts
       from its own beginning.
    */

    try {

      if (
        typeof window.VODPlayer?.clearSavedPlayback ===
          "function"
      ) {

        debugLog(
          "Clearing old cycle playback state"
        );


        window.VODPlayer.clearSavedPlayback();

      }

    } catch (error) {

      errorLog(
        "Failed to clear old playback:",
        error
      );

    }


    location.reload();

  }


})();
