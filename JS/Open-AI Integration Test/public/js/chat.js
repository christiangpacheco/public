const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span");
const chatbox = document.querySelector(".chatbox");
const chatbotToggle = document.querySelector(".chatbot-toggler");
const chatbotCloseBtn = document.querySelector(".close-btn");

const inputInitHeight = chatInput.scrollHeight;
let chatbotInitiate = false;
const CATALOG = [
  { id: "g-ti-ads", nivel: "graduacao", area: "TI", nome: "Análise e Desenvolvimento de Sistemas", preco_base: 649.90 },
  { id: "g-adm", nivel: "graduacao", area: "Administração", nome: "Administração", preco_base: 599.90 },
  { id: "p-ds", nivel: "pos", area: "TI", nome: "Pós em Data Science", preco_base: 749.90 },
  { id: "p-gestao-saude", nivel: "pos", area: "Saúde", nome: "Pós em Gestão em Saúde", preco_base: 699.90 }
];

let userMessage;

const createChatLi = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className)
  let chatContent = className === "outgoing" ? `<p></p>` : `<span class="material-symbols-outlined">smart_toy</span><p></p>`;
  chatLi.innerHTML = chatContent;
  chatLi.querySelector("p").textContent = message;
  return chatLi;
}

const generateResponse = (incomingChatLi) => {
  const messageElement = incomingChatLi.querySelector("p");
  fetch("/chatbot", {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json"
    },
    body: JSON.stringify({
      message: userMessage,
      clientId
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.reply) {
        messageElement.textContent = data.reply;
      } else {
        messageElement.textContent = "Sem resposta.";
      }
    })
    .catch((error) => {
      messageElement.classList.add("error");
      messageElement.textContent = "Ops! Erro se comunicar com o servidor.";
    })
    .finally(() => chatbox.scrollTo(0, chatbox.scrollHeight));
};

const handleChat = () => {
  userMessage = chatInput.value.trim();
  chatInput.value = "";
  chatInput.style.height = `${inputInitHeight}px`;
  if (!userMessage || userMessage.replace(/\s/g, "") === "") {
    return;
  }
  chatbox.appendChild(createChatLi(userMessage, "outgoing"));
  chatbox.scrollTo(0, chatbox.scrollHeight);
  setTimeout(() => {
    const incomingChatLi = chatbox.appendChild(createChatLi("Pensando...", "incoming"));
    chatbox.appendChild(incomingChatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);
    generateResponse(incomingChatLi);
  }, 600)
}

chatInput.addEventListener("input", () => {
  chatInput.style.height = `${inputInitHeight}px`
  chatInput.style.height = `${chatInput.scrollHeight}px`
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
    e.preventDefault();
    handleChat();
  }
});

let clientId = localStorage.getItem("chatbot_client_id");
if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem("chatbot_client_id", clientId);
}

sendChatBtn.addEventListener("click", handleChat);
chatbotCloseBtn.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
chatbotToggle.addEventListener("click", () => {
  document.body.classList.toggle("show-chatbot")
  if (!chatbotInitiate && document.body.classList.contains("show-chatbot")) {
    chatbotInitiate = true;
    const incomingChatLi = chatbox.appendChild(createChatLi("Pensando...", "incoming"));
    chatbox.scrollTo(0, chatbox.scrollHeight);
    userMessage = "prossiga";
    generateResponse(incomingChatLi);
  }
});
window.addEventListener("beforeunload", () => {
  const clientId = localStorage.getItem("chatbot_client_id");
  if (clientId) {
    fetch("/reset-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId })
    });
  }
});