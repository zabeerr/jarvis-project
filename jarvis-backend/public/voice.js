"use strict";

(function () {
  let audioEl = null;
  let playId = 0;

  function stopAll() {
    playId++;
    if (audioEl) {
      audioEl.pause();
      audioEl = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function browserSpeak(message) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(String(message));
    u.lang = "en-IN";
    u.rate = 1;
    u.pitch = 0.95;
    window.speechSynthesis.speak(u);
  }

  window.speak = async function (message) {
    if (!voiceEnabled) return;

    stopAll();
    const myId = playId;

    try {
      const res = await fetch(API_URL + "/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: String(message) }),
      });

      if (!res.ok) {
        let detail = "HTTP " + res.status;
        try {
          const j = await res.json();
          if (j && j.error) detail = j.error;
        } catch (e) {}
        throw new Error(detail);
      }

      const blob = await res.blob();
      if (myId !== playId || !voiceEnabled) return;

      const url = URL.createObjectURL(blob);
      audioEl = new Audio(url);
      audioEl.onended = function () {
        URL.revokeObjectURL(url);
      };
      await audioEl.play();
    } catch (err) {
      console.error("ElevenLabs voice failed, using browser voice:", err);
      const state = document.getElementById("aiState");
      if (state) state.textContent = "VOICE ERROR: " + err.message;
      if (myId === playId && voiceEnabled) browserSpeak(message);
    }
  };

  document.getElementById("voiceBtn").addEventListener("click", function () {
    if (!voiceEnabled) stopAll();
  });
})();
