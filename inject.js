(function () {
    // Current game ID from page URL, e.g. https://www.geoguessr.com/game/zCzmScNr4ThNiau8
    const getCurrentGameId = () => {
      const m = (window.location.pathname || "").match(/^\/game\/([^/?#]+)/);
      return m ? m[1] : null;
    };

    // Match POST responses from /api/v3/games/<gameId> and only for current page's game
    const isCurrentGamePost = (url) => {
      const gameId = getCurrentGameId();
      if (!gameId) return false;
      const s = (url || "").toString();
      return s.includes("v3/games") && s.includes(gameId);
    };

    // Only treat as guess-result when response has player.guesses (the POST that runs after perform-guess)
    const isGuessResultResponse = (data) =>
      data != null &&
      typeof data === "object" &&
      Array.isArray(data.player?.guesses) &&
      data.player.guesses.length > 0;

    const origFetch = window.fetch;
    console.log("Starting inject");
    window.fetch = async (...args) => {
      const res = await origFetch(...args);

      try {
        const url = args[0]?.toString?.() || "";
        const method = args[1]?.method || "GET";

        if (method === "POST" && isCurrentGamePost(url)) {
          const clone = res.clone();
          const data = await clone.json();
          if (isGuessResultResponse(data)) {
            window.dispatchEvent(
              new CustomEvent("geoguessr-guess-result", {
                detail: { ...data, gameId: getCurrentGameId() }
              })
            );
          }
        }
      } catch {}

      return res;
    };
    console.log("WINDOW.FETCH IS: ", window.fetch);

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._gg_method = method;
      this._gg_url = url;
      return origOpen.call(this, method, url, ...rest);
    };

    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      this.addEventListener("load", function () {
        try {
          if (this._gg_method === "POST" && isCurrentGamePost(this._gg_url)) {
            const data = JSON.parse(this.responseText);
            if (isGuessResultResponse(data)) {
              window.dispatchEvent(
                new CustomEvent("geoguessr-guess-result", {
                  detail: { ...data, gameId: getCurrentGameId() }
                })
              );
            }
          }
        } catch {}
      });

      return origSend.apply(this, arguments);
    };
  })();
  