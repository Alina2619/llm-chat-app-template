/**
 * LLM Chat App Frontend with:
 * - Chat History
 * - Hyperlinks
 * - Inline Image Rendering
 * - SSE Streaming
 * - LocalStorage Persistence
 */

// ============================
// DOM ELEMENTS
// ============================

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// ============================
// CHAT STATE
// ============================

let currentChatId = null;
let chatHistory = [];
let isProcessing = false;

// ============================
// STORAGE KEYS
// ============================

const STORAGE_KEY = "llm_chat_history";
const CURRENT_CHAT_KEY = "llm_current_chat_id";

// ============================
// URL REGEX
// ============================

const URL_REGEX =
    /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}[^\s]*)/g;

// ============================
// INITIALIZE APP
// ============================

document.addEventListener("DOMContentLoaded", () => {
    loadAllChats();
    setupEventListeners();
});

// ============================
// EVENT LISTENERS
// ============================

function setupEventListeners() {
    // Auto resize textarea
    userInput.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
    });

    // Send on Enter
    userInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button
    sendButton.addEventListener("click", sendMessage);
}

// ============================
// IMAGE DETECTION
// ============================

function isImageUrl(url) {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
}

// ============================
// ESCAPE HTML
// ============================

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ============================
// URL -> LINK / IMAGE
// ============================

function convertUrlsToRichContent(text) {
    if (!text) return "";

    return text.replace(URL_REGEX, function (url) {
        let href = url;

        if (url.startsWith("www.")) {
            href = "https://" + url;
        }

        if (
            !href.startsWith("http://") &&
            !href.startsWith("https://")
        ) {
            href = "https://" + href;
        }

        // IMAGE RENDERING
        if (isImageUrl(href)) {
            return `
                <div class="chat-image-wrapper">
                    <img
                        src="${href}"
                        alt="Shared image"
                        class="chat-image"
                        loading="lazy"
                        onclick="window.open('${href}', '_blank')"
                    />
                </div>
            `;
        }

        // NORMAL LINK
        return `
            <a
                href="${href}"
                target="_blank"
                rel="noopener noreferrer"
                class="chat-link"
            >
                ${escapeHtml(url)}
            </a>
        `;
    });
}

// ============================
// FORMAT MESSAGE
// ============================

function formatMessageContent(content) {
    if (!content) return "";

    let formatted = convertUrlsToRichContent(content);

    // Preserve line breaks
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted;
}

// ============================
// LOAD ALL CHATS
// ============================

function loadAllChats() {
    const savedChats = localStorage.getItem(STORAGE_KEY);
    const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY);

    if (savedChats) {
        const chats = JSON.parse(savedChats);

        if (savedChatId && chats[savedChatId]) {
            loadChat(savedChatId);
        } else {
            const chatIds = Object.keys(chats);

            if (chatIds.length > 0) {
                const mostRecent = chatIds.sort(
                    (a, b) => chats[b].timestamp - chats[a].timestamp
                )[0];

                loadChat(mostRecent);
            } else {
                startNewChat();
            }
        }
    } else {
        startNewChat();
    }

    renderHistoryList();
}

// ============================
// SAVE CHAT
// ============================

function saveCurrentChat() {
    if (!currentChatId && chatHistory.length === 0) return;

    if (!currentChatId && chatHistory.length > 0) {
        currentChatId = generateChatId();
    }

    if (currentChatId) {
        const allChats = getAllChats();

        const firstUserMessage = chatHistory.find(
            (m) => m.role === "user"
        );

        const title = firstUserMessage
            ? firstUserMessage.content.slice(0, 30) +
              (firstUserMessage.content.length > 30 ? "..." : "")
            : "New Chat";

        const lastMessage = chatHistory[chatHistory.length - 1];

        const preview = lastMessage
            ? lastMessage.content.slice(0, 50) +
              (lastMessage.content.length > 50 ? "..." : "")
            : "No messages";

        allChats[currentChatId] = {
            id: currentChatId,
            title,
            messages: [...chatHistory],
            timestamp: Date.now(),
            preview,
            messageCount: chatHistory.length,
        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(allChats)
        );

        localStorage.setItem(
            CURRENT_CHAT_KEY,
            currentChatId
        );
    }
}

// ============================
// GET ALL CHATS
// ============================

function getAllChats() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
}

// ============================
// GENERATE CHAT ID
// ============================

function generateChatId() {
    return (
        Date.now().toString() +
        "_" +
        Math.random().toString(36).substr(2, 9)
    );
}

// ============================
// LOAD CHAT
// ============================

function loadChat(chatId) {
    const allChats = getAllChats();
    const chat = allChats[chatId];

    if (!chat) return;

    currentChatId = chatId;
    chatHistory = [...chat.messages];

    chatMessages.innerHTML = "";

    chatHistory.forEach((msg) => {
        addMessageToChat(msg.role, msg.content, false);
    });

    updateActiveChatInSidebar(chatId);

    chatMessages.scrollTop = chatMessages.scrollHeight;

    localStorage.setItem(CURRENT_CHAT_KEY, currentChatId);
}

// ============================
// NEW CHAT
// ============================

function startNewChat() {
    if (chatHistory.length > 0) {
        saveCurrentChat();
    }

    currentChatId = null;

    chatHistory = [
        {
            role: "assistant",
            content:
                "Hello! I can now render images directly inside chat.\n\nExample image:\nhttps://picsum.photos/500/300.jpg",
        },
    ];

    chatMessages.innerHTML = "";

    chatHistory.forEach((msg) => {
        addMessageToChat(msg.role, msg.content, false);
    });

    document
        .querySelectorAll(".history-item")
        .forEach((item) => {
            item.classList.remove("active");
        });

    localStorage.removeItem(CURRENT_CHAT_KEY);
}

// ============================
// DELETE CHAT
// ============================

function deleteChat(chatId, event) {
    if (event) event.stopPropagation();

    if (confirm("Delete this chat?")) {
        const allChats = getAllChats();

        delete allChats[chatId];

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(allChats)
        );

        if (currentChatId === chatId) {
            startNewChat();
        }

        renderHistoryList();
    }
}

// ============================
// CLEAR HISTORY
// ============================

function clearAllHistory() {
    if (
        confirm(
            "⚠️ Delete ALL chat history?"
        )
    ) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CURRENT_CHAT_KEY);

        startNewChat();
        renderHistoryList();
    }
}

// ============================
// EXPORT CHAT
// ============================

function exportChatHistory() {
    const allChats = getAllChats();

    const exportData = {
        exportDate: new Date().toISOString(),
        totalChats: Object.keys(allChats).length,
        chats: allChats,
    };

    const dataStr = JSON.stringify(exportData, null, 2);

    const dataUri =
        "data:application/json;charset=utf-8," +
        encodeURIComponent(dataStr);

    const exportFileName = `chat_history_${new Date()
        .toISOString()
        .slice(0, 19)}.json`;

    const linkElement = document.createElement("a");

    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileName);

    linkElement.click();
}

// ============================
// IMPORT CHAT
// ============================

function importChatHistory(event) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);

            const existingChats = getAllChats();

            let mergedChats = {
                ...existingChats,
            };

            if (imported.chats) {
                mergedChats = {
                    ...existingChats,
                    ...imported.chats,
                };
            }

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(mergedChats)
            );

            alert("Import successful!");

            loadAllChats();
            renderHistoryList();
        } catch (error) {
            alert("Invalid JSON file");
        }
    };

    reader.readAsText(file);
}

// ============================
// RENDER HISTORY SIDEBAR
// ============================

function renderHistoryList() {
    const historyList =
        document.getElementById("historyList");

    if (!historyList) return;

    const allChats = getAllChats();

    const chatArray = Object.values(allChats);

    if (chatArray.length === 0) {
        historyList.innerHTML = `
            <div style="padding:20px;color:#999;text-align:center;">
                No chats yet
            </div>
        `;
        return;
    }

    chatArray.sort(
        (a, b) => b.timestamp - a.timestamp
    );

    historyList.innerHTML = chatArray
        .map(
            (chat) => `
        <div
            class="history-item ${
                currentChatId === chat.id ? "active" : ""
            }"
            onclick="window.loadChatById('${chat.id}')"
            data-id="${chat.id}"
        >
            <div class="history-title">
                💬 ${escapeHtml(chat.title)}
            </div>

            <div class="history-preview">
                ${escapeHtml(chat.preview)}
            </div>

            <div class="history-date">
                ${formatDate(chat.timestamp)}
            </div>

            <button
                class="delete-history-btn"
                onclick="event.stopPropagation(); window.deleteChat('${chat.id}', event)"
            >
                Delete
            </button>
        </div>
    `
        )
        .join("");
}

// ============================
// ACTIVE CHAT UI
// ============================

function updateActiveChatInSidebar(chatId) {
    document
        .querySelectorAll(".history-item")
        .forEach((item) => {
            if (item.dataset.id === chatId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
}

// ============================
// FORMAT DATE
// ============================

function formatDate(timestamp) {
    const date = new Date(timestamp);

    return date.toLocaleString();
}

// ============================
// ADD MESSAGE
// ============================

function addMessageToChat(
    role,
    content,
    shouldSave = true
) {
    const messageEl = document.createElement("div");

    messageEl.className = `message ${role}-message`;

    const formattedContent =
        formatMessageContent(content);

    messageEl.innerHTML = `
        <div class="message-content">
            ${formattedContent}
        </div>
    `;

    chatMessages.appendChild(messageEl);

    chatMessages.scrollTop =
        chatMessages.scrollHeight;

    if (shouldSave) {
        saveCurrentChat();
    }
}

// ============================
// SEND MESSAGE
// ============================

async function sendMessage() {
    const message = userInput.value.trim();

    if (message === "" || isProcessing) return;

    isProcessing = true;

    userInput.disabled = true;
    sendButton.disabled = true;

    addMessageToChat("user", message);

    userInput.value = "";
    userInput.style.height = "auto";

    typingIndicator.classList.add("visible");

    chatHistory.push({
        role: "user",
        content: message,
    });

    saveCurrentChat();

    try {
        const assistantMessageEl =
            document.createElement("div");

        assistantMessageEl.className =
            "message assistant-message";

        assistantMessageEl.innerHTML =
            `<div class="message-content"></div>`;

        chatMessages.appendChild(
            assistantMessageEl
        );

        const assistantTextEl =
            assistantMessageEl.querySelector(
                ".message-content"
            );

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json",
            },
            body: JSON.stringify({
                messages: chatHistory,
            }),
        });

        if (!response.ok) {
            throw new Error(
                "Failed to get response"
            );
        }

        if (!response.body) {
            throw new Error(
                "Response body is null"
            );
        }

        const reader =
            response.body.getReader();

        const decoder = new TextDecoder();

        let responseText = "";

        while (true) {
            const { done, value } =
                await reader.read();

            if (done) break;

            const chunk = decoder.decode(value);

            responseText += chunk;

            assistantTextEl.innerHTML =
                formatMessageContent(
                    responseText
                );

            chatMessages.scrollTop =
                chatMessages.scrollHeight;
        }

        chatHistory.push({
            role: "assistant",
            content: responseText,
        });

        saveCurrentChat();
        renderHistoryList();
    } catch (error) {
        console.error(error);

        addMessageToChat(
            "assistant",
            "Error processing request."
        );
    } finally {
        typingIndicator.classList.remove(
            "visible"
        );

        isProcessing = false;

        userInput.disabled = false;
        sendButton.disabled = false;

        userInput.focus();
    }
}

// ============================
// GLOBAL FUNCTIONS
// ============================

window.startNewChat = startNewChat;
window.deleteChat = deleteChat;
window.clearAllHistory = clearAllHistory;
window.exportChatHistory =
    exportChatHistory;
window.importChatHistory =
    importChatHistory;
window.loadChatById = loadChat;
