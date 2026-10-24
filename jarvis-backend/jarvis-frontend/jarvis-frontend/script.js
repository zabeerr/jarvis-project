"use strict";

/*
  JARVIS BACKEND
  Your Gemini API key must remain in Vercel Environment Variables.
  Replace the URL below with your own Vercel link.
*/
const API_URL = "https://YOUR-PROJECT.vercel.app";

const replyEl = document.getElementById("reply");
const cmdEl = document.getElementById("cmd");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const voiceBtn = document.getElementById("voiceBtn");
const statusDot = document.getElementById("statusDot");
const onlineStatus = document.getElementById("onlineStatus");
const aiState = document.getElementById("aiState");
const core = document.getElementById("core");

let voiceEnabled = true;
let recognition = null;
let isListening = false;
let chatHistory = [];
let requestController = null;

function setStatus(message, state) {
  onlineStatus.textContent = message;
  statusDot.className = "dot";

  if (state === "online") {
    statusDot.classList.add("online");
  } else if (state === "offline") {
    statusDot.classList.add("offline");
  }
}

function setReply(message) {
  replyEl.textContent = message;
}

function speak(message) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(String(message));
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 0.95;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

function respond(message, shouldSpeak = true) {
  setReply(message);
  aiState.textContent = "SYSTEM READY";

  if (shouldSpeak) speak(message);
}

function openSearch(query) {
  const url = "https://www.google.com/search?q=" +
    encodeURIComponent(query);
  window.open(url, "_blank");
}

function openYouTube(query = "") {
  const url = query
    ? "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query)
    : "https://www.youtube.com/";

  window.open(url, "_blank");
}

function handleLocalCommand(rawMessage) {
  const message = rawMessage.trim().toLowerCase();

  if (!message) return true;

  if (
    message === "time" ||
    message.includes("what time") ||
    message === "tell me the time"
  ) {
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit"
    });

    respond("The current time is " + time + ".");
    return true;
  }

  if (
    message === "date" ||
    message.includes("today's date") ||
    message.includes("what is the date") ||
    message.includes("what's the date")
  ) {
    const date = new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    respond("Today is " + date + ".");
    return true;
  }

  if (
    message === "status" ||
    message.includes("system status")
  ) {
    respond(
      "JARVIS interface is running. " +
      "I am checking the AI backend connection."
    );
    checkBackend();
    return true;
  }

  if (
    message === "open google" ||
    message === "google"
  ) {
    window.open("https://www.google.com/", "_blank");
    respond("Opening Google.");
    return true;
  }

  if (
    message === "open youtube" ||
    message === "youtube"
  ) {
    openYouTube();
    respond("Opening YouTube.");
    return true;
  }

  if (message.startsWith("search ")) {
    const query = rawMessage.trim().slice(7).trim();

    if (query) {
      openSearch(query);
      respond("Searching Google for " + query + ".");
    } else {
      respond("Tell me what you want to search for.");
    }

    return true;
  }

  if (message.startsWith("play ")) {
    const query = rawMessage.trim().slice(5).trim();

    if (query) {
      openYouTube(query);
      respond("Searching YouTube for " + query + ".");
    } else {
      respond("Tell me what you want to play.");
    }

    return true;
  }

  if (
    message === "help" ||
    message === "commands"
  ) {
    respond(
      "You can ask me questions using the AI chat. " +
      "Try: search Virat Kohli, play music, open Google, " +
      "open YouTube, time, or date."
    );
    return true;
  }

  return false;
}

async function askAI(message) {
  if (!message.trim()) return;

  if (handleLocalCommand(message)) return;

  if (requestController) {
    requestController.abort();
  }

  requestController = new AbortController();
  const controller = requestController;

  const timeout = setTimeout(() => {
    controller.abort();
  }, 60000);

  sendBtn.disabled = true;
  aiState.textContent = "CONTACTING AI CORE...";
  setReply("Thinking... Please wait.");
  core.classList.add("listening");

  try {
    const response = await fetch(API_URL + "/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        history: chatHistory.slice(-10)
      }),
      signal: controller.signal
    });

    const rawText = await response.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(
        "The backend returned an unexpected response. " +
        "Please check your Vercel server."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        ("Backend returned HTTP " + response.status)
      );
    }

    const answer =
      data.reply ||
      data.response ||
      data.message;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error(
        "The backend connected, but it returned no reply. " +
        "Check the /api/chat response format."
      );
    }

    chatHistory.push(
      { role: "user", content: message },
      { role: "assistant", content: answer }
    );

    chatHistory = chatHistory.slice(-20);

    setReply(answer);
    aiState.textContent = "AI RESPONSE RECEIVED";
    speak(answer);

  } catch (error) {
    if (error.name === "AbortError") {
      setReply(
        "The AI request timed out or was cancelled. " +
        "Check your internet connection and make sure " +
        "your backend is running."
      );
      aiState.textContent = "REQUEST TIMEOUT";
    } else {
      console.error("JARVIS AI error:", error);

      setReply(
        "I couldn't connect to the AI core.\n\n" +
        "Details: " + error.message +
        "\n\nCheck your internet connection and backend."
      );

      aiState.textContent = "CONNECTION ERROR";
    }
  } finally {
    clearTimeout(timeout);
    sendBtn.disabled = false;
    core.classList.remove("listening");

    if (requestController === controller) {
      requestController = null;
    }
  }
}

async function checkBackend() {
  setStatus("CONNECTING TO AI CORE", "checking");

  try {
    const response = await fetch(API_URL + "/api/", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    setStatus("AI BACKEND REACHABLE", "online");
    aiState.textContent = "BACKEND CONNECTION AVAILABLE";

  } catch (error) {
    console.error("Backend health check:", error);

    setStatus("BACKEND CHECK FAILED", "offline");
    aiState.textContent =
      "The backend health check failed. Chat may also be affected.";
  }
}

/* Text chat */
document.getElementById("chatForm").addEventListener(
  "submit",
  function(event) {
    event.preventDefault();

    const message = cmdEl.value.trim();
    if (!message) return;

    cmdEl.value = "";
    askAI(message);
  }
);

/* Quick command buttons */
document.querySelectorAll("[data-command]").forEach(function(button) {
  button.addEventListener("click", function() {
    const command = button.getAttribute("data-command");
    askAI(command);
  });
});

/* Voice output on/off */
voiceBtn.addEventListener("click", function() {
  voiceEnabled = !voiceEnabled;

  if (!voiceEnabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  voiceBtn.textContent = voiceEnabled
    ? "🔊 VOICE ON"
    : "🔇 VOICE OFF";

  voiceBtn.classList.toggle("active", voiceEnabled);

  if (voiceEnabled) {
    setReply("Voice responses enabled.");
  } else {
    setReply("Voice responses disabled.");
  }
});

/* Voice recognition */
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = function() {
    isListening = true;
    micBtn.classList.add("active");
    micBtn.textContent = "🔴 LISTENING";
    core.classList.add("listening");
    aiState.textContent = "LISTENING FOR COMMAND";
  };

  recognition.onresult = function(event) {
    const transcript =
      event.results[0][0].transcript.trim();

    cmdEl.value = transcript;

    if (transcript) {
      askAI(transcript);
    }
  };

  recognition.onerror = function(event) {
    console.error("Voice recognition error:", event.error);

    if (event.error === "not-allowed") {
      setReply(
        "Microphone permission was denied. " +
        "Allow microphone access in your browser settings."
      );
    } else {
      setReply(
        "Voice recognition failed. Try again or type your command."
      );
    }
  };

  recognition.onend = function() {
    isListening = false;
    micBtn.classList.remove("active");
    micBtn.textContent = "🎙 VOICE INPUT";
    core.classList.remove("listening");
  };

  micBtn.addEventListener("click", function() {
    if (isListening) {
      recognition.stop();
      return;
    }

    try {
      recognition.start();
    } catch (error) {
      console.error(error);
      setReply(
        "Voice input could not start. Please try again."
      );
    }
  });

} else {
  micBtn.addEventListener("click", function() {
    setReply(
      "Voice input is not supported in this browser. " +
      "Try opening this page in Google Chrome and allow microphone access."
    );
  });
}

/* Initial startup */
window.addEventListener("load", function() {
  checkBackend();

  setReply(
    "Hello, Zabeer. JARVIS is ready. " +
    "Ask me a question to get started."
  );
});
                                        
