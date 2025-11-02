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
    // WORKER_URL should be defined in secrets.js (a local dev helper).
    if (typeof WORKER_URL === "undefined") {
      throw new Error(
        "WORKER_URL is not defined. Add your Cloudflare Worker URL to secrets.js"
      );
    }

    const resp = await fetch(WORKER_URL, {
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
