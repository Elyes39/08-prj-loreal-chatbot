/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
// Conversation state kept in-memory for this session
const chatHistory = [];

// Clear and set an initial assistant message
function appendMessage(text, sender = "ai") {
  const el = document.createElement("div");
  el.className = `msg ${sender}`;
  el.textContent = text;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

appendMessage(
  "👋 Hello! I'm the L'Oréal Smart Product Advisor — ask me about L'Oréal products, routines, or recommendations.",
  "ai"
);

// System prompt - instruct assistant to stay on-topic and refuse unrelated queries.
const systemMessage = {
  role: "system",
  content:
    "You are a helpful assistant specialized only in L'Oréal products, routines, and beauty recommendations. Answer user questions concisely and accurately about L'Oréal products, ingredients, routines, skin/hair concerns, and how to use products. If a user asks about topics outside L'Oréal products or unrelated non-beauty topics, politely refuse and say you can only help with L'Oréal product and routine-related questions. Always be friendly and professional.",
};

// Deploy-friendly worker URL handling:
// On local dev we provide `secrets.js` which defines `WORKER_URL`.
// On GitHub Pages that file may not be present; set your deployed
// Cloudflare Worker URL in the DEFAULT_WORKER_URL below (replace the
// placeholder with your actual worker link), or keep using `secrets.js`
// during local development.
const DEFAULT_WORKER_URL = "https://loreal-chatbot-worker.seffar-elyes.workers.dev/";

// Final worker endpoint used by the app. Priority:
// 1) `WORKER_URL` from `secrets.js` (if present)
// 2) `DEFAULT_WORKER_URL` (set this for GitHub Pages deployment)
const WORKER_ENDPOINT =
  typeof WORKER_URL !== "undefined" && WORKER_URL
    ? WORKER_URL
    : DEFAULT_WORKER_URL;

// Small helper to show a temporary typing indicator
function showTypingIndicator() {
  const el = document.createElement("div");
  el.className = "msg ai typing";
  el.textContent = "…";
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  // append user message locally and to history
  appendMessage(text, "user");
  chatHistory.push({ role: "user", content: text });

  // clear input
  userInput.value = "";
  userInput.focus();

  // show typing indicator
  const typingEl = showTypingIndicator();

  // Build messages to send: system prompt + full chat history
  const messagesToSend = [systemMessage, ...chatHistory];

  try {
    // Use the resolved worker endpoint. If you deployed to GitHub Pages,
    // update DEFAULT_WORKER_URL above with your worker link.
    if (
      !WORKER_ENDPOINT ||
      WORKER_ENDPOINT.includes("REPLACE_WITH_YOUR_WORKER_URL")
    ) {
      throw new Error(
        "Worker URL is not configured. Set DEFAULT_WORKER_URL in script.js or provide secrets.js with WORKER_URL."
      );
    }

    const resp = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesToSend }),
    });

    const data = await resp.json();

    // The Cloudflare Worker forwards the OpenAI response. We expect choices[0].message.content
    const assistantContent =
      (data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content) ||
      null;

    // remove typing indicator
    typingEl.remove();

    if (!assistantContent) {
      appendMessage(
        "Sorry — I couldn't get a response. Please try again.",
        "ai"
      );
      console.error("Invalid response from worker:", data);
      return;
    }

    // append assistant message to UI and history
    appendMessage(assistantContent, "ai");
    chatHistory.push({ role: "assistant", content: assistantContent });
  } catch (err) {
    typingEl.remove();
    appendMessage(
      "Sorry — an error occurred while contacting the chat service.",
      "ai"
    );
    console.error(err);
  }
});
