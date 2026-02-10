let guessed = false;

// Inject script to listen to the post req for round data
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

window.addEventListener("geoguessr-guess-result", (e) => {
    const data = e.detail;
    const lastGuess = data?.player?.guesses?.at(-1);
    const roundScore = lastGuess?.roundScoreInPoints;
    const distance = lastGuess?.distanceInMeters;
    const roundNumber = data?.round;
    const roundCount = data?.roundCount ?? 5;

    console.log("Round result from POST:", { roundScore, distance, roundNumber, roundCount });

    chrome.runtime.sendMessage({
      type: "ROUND_RESULT",
      roundScore,
      distance,
      roundNumber,
      raw: data
    });

    // Livesplit commands from POST data (no DOM observer)
    const isPerfect = roundScore === 5000;
    const isFinalRound = roundNumber === roundCount;
    if (isPerfect) {
      send_ws(isFinalRound ? "perfect_score_final" : "perfect_score_intermediate");
    } else {
      send_ws(isFinalRound ? "missed_loc_final" : "missed_loc_intermediate");
    }
  });

// Send message through websocket
function send_ws(operation) {
    console.debug("Sending command to BG : " + operation)
    chrome.runtime.sendMessage({ type: "livesplit_command", command: operation });
}

function start() {
    setTimeout(() => { guessed = false }, 500)
    send_ws("start");
    send_ws("set_comparison");
    send_ws("unpausegametime"); // For a second seed, game time might be paused
}

function is_last_round() {
    return document.querySelector("div[data-qa='round-number']").textContent.includes("5 / 5");
}

function guess() {
    guessed = true;
    send_ws("pausegametime");
}

function next() {
    setTimeout(() => { guessed = false }, 500)
    send_ws("unpausegametime");
}

function reset_leave_game() {
    setTimeout(() => { guessed = false }, 500)
    send_ws("reset_leave_game");
}


function is_start_button(target) {
    // Start button of Solo mode
    var playButtons = document.querySelector("[class^=map-selector-mobile_playButtons]");
    if (playButtons == null) {
        playButtons = document.querySelector("[class^=map-selector_playButtons]");
    }
    if (target.textContent == "Play" && playButtons.contains(target)) {
        return true;
    }

    // Start button of Challenge mode
    if (start_list.includes(target.dataset.qa) && target.textContent != "Create challenge") {
        return true;
    }
}

let start_list = ['join-challenge-button', 'start-challenge-button', 'start-game-button', 'play-again-button'];
let guess_list = ['perform-guess'];
let next_list = ['close-round-result'];

// Event button listener (use closest() so clicking button's child still counts)
document.addEventListener('click', function (e) {
    const target = e.target;
    if (target && is_start_button(target)) {
        start();
    }
    if (target && guess_list.includes(target.dataset.qa)) {
        guess();
    }
    const nextBtn = target?.closest?.("button[data-qa='close-round-result']");
    if (nextBtn && nextBtn.textContent.trim() === "Next") {
        next();
    }
    if (target && target.textContent === "Leave game") {
        reset_leave_game();
    }
});

// Space bar listener
document.body.onkeyup = function (e) {
    if (e.key === " " || e.code === "Space" || e.keyCode === 32) {
        checkSpaceNext();
        checkSpaceGuess();
        checkSpaceStart();
    }
};

function checkSpaceNext() {
    const nextBtn = document.querySelector("button[data-qa='close-round-result']");
    if (nextBtn && nextBtn.textContent.trim() === "Next") {
        next();
    }
}

function checkSpaceGuess() {
    let guess_button = document.querySelector("button[data-qa='perform-guess']");
    if (!guess_button) {
        console.debug("Spacebar pressed with no guess button, ignoring");
        return;
    }
    if (!guess_button.disabled) {
        guess();
    }
}

function checkSpaceStart() {
    for (playButton of document.querySelectorAll("[class^=map-selector_playButtons]")) {
        console.debug(localStorage.getItem("quickplay-variant"))
        if (playButton.textContent === "Play" && localStorage.getItem("quickplay-variant") == 0) {
            console.debug("Starting with space in solo")
            start();
            return;
        }
    }
}

function checkTimerEnd() {
    timer = document.querySelector("[class^=clock-timer_timer__]")
    if (timer && timer.textContent === "00:00" && !guessed) {
        console.debug("end of timer detected")
        guess()
    }
}

setInterval(checkTimerEnd, 100)

// Keep extension alive
function keepAlive() {
    chrome.runtime.sendMessage({ type: "keep_alive" });
}
setInterval(keepAlive, 20000);