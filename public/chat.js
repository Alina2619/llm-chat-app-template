/**
 * LLM Chat App Frontend with Chat History & Hyperlinks
 *
 * Handles the chat UI interactions, communication with the backend API,
 * persistent chat history storage, and automatic link detection.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let currentChatId = null;
let chatHistory = [];
let isProcessing = false;

// Storage keys
const STORAGE_KEY = "llm_chat_history";
const CURRENT_CHAT_KEY = "llm_current_chat_id";

// URL detection regex
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}[^\s]*)/g;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    loadAllChats();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Auto-resize textarea as user types
    userInput.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
    });

    // Send message on Enter (without Shift)
    userInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button click handler
    sendButton.addEventListener("click", sendMessage);
}

/**
 * Convert URLs in text to clickable hyperlinks
 */
function convertUrlsToLinks(text) {
    if (!text) return '';
   
    return text.replace(URL_REGEX, function(url) {
        let href = url;
        // Add https:// if missing for www links
        if (url.startsWith('www.')) {
            href = 'https://' + url;
        }
        // Skip if not a valid URL pattern
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
            href = 'https://' + href;
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="chat-link">${escapeHtml(url)}</a>`;
    });
}

/**
 * Format message content with links and line breaks
 */
function formatMessageContent(content) {
    if (!content) return '';
   
    // First convert URLs to links
    let formatted = convertUrlsToLinks(content);
   
    // Convert line breaks to <br> tags
    formatted = formatted.replace(/\n/g, '<br>');
   
    return formatted;
}

/**
 * Load all saved chats from localStorage
 */
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
                const mostRecent = chatIds.sort((a, b) =>
                    chats[b].timestamp - chats[a].timestamp
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

/**
 * Save current chat to localStorage
 */
function saveCurrentChat() {
    if (!currentChatId && chatHistory.length === 0) return;
   
    if (!currentChatId && chatHistory.length > 0) {
        currentChatId = generateChatId();
    }
   
    if (currentChatId) {
        const allChats = getAllChats();
       
        const firstUserMessage = chatHistory.find(m => m.role === 'user');
        const title = firstUserMessage
            ? firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
            : 'New Chat';
       
        const lastMessage = chatHistory[chatHistory.length - 1];
        const preview = lastMessage
            ? lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? '...' : '')
            : 'No messages';
       
        allChats[currentChatId] = {
            id: currentChatId,
            title: title,
            messages: [...chatHistory],
            timestamp: Date.now(),
            preview: preview,
            messageCount: chatHistory.length
        };
       
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allChats));
        localStorage.setItem(CURRENT_CHAT_KEY, currentChatId);
    }
}

/**
 * Get all chats from localStorage
 */
function getAllChats() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
}

/**
 * Generate a unique chat ID
 */
function generateChatId() {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Load a specific chat by ID
 */
function loadChat(chatId) {
    const allChats = getAllChats();
    const chat = allChats[chatId];
   
    if (!chat) return;
   
    currentChatId = chatId;
    chatHistory = [...chat.messages];
   
    chatMessages.innerHTML = '';
    chatHistory.forEach(msg => {
        addMessageToChat(msg.role, msg.content, false);
    });
   
    updateActiveChatInSidebar(chatId);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    localStorage.setItem(CURRENT_CHAT_KEY, currentChatId);
}

/**
 * Start a new chat
 */
function startNewChat() {
    if (chatHistory.length > 0) {
        saveCurrentChat();
    }
   
    currentChatId = null;
    chatHistory = [
        {
            role: "assistant",
            content: "Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?\n\nYou can share links and they will be clickable! Try it: https://cloudflare.com",
        },
    ];
   
    chatMessages.innerHTML = '';
    chatHistory.forEach(msg => {
        addMessageToChat(msg.role, msg.content, false);
    });
   
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
    });
   
    localStorage.removeItem(CURRENT_CHAT_KEY);
}

/**
 * Delete a specific chat
 */
function deleteChat(chatId, event) {
    if (event) event.stopPropagation();
   
    if (confirm('Are you sure you want to delete this chat?')) {
        const allChats = getAllChats();
        delete allChats[chatId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allChats));
       
        if (currentChatId === chatId) {
            startNewChat();
        }
       
        renderHistoryList();
    }
}

/**
 * Clear all chat history
 */
function clearAllHistory() {
    if (confirm('⚠️ This will delete ALL chat history. This action cannot be undone. Are you sure?')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CURRENT_CHAT_KEY);
        startNewChat();
        renderHistoryList();
    }
}

/**
 * Export chat history as JSON file
 */
function exportChatHistory() {
    const allChats = getAllChats();
    const exportData = {
        exportDate: new Date().toISOString(),
        totalChats: Object.keys(allChats).length,
        chats: allChats
    };
   
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileName = `chat_history_${new Date().toISOString().slice(0,19)}.json`;
   
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
}

/**
 * Import chat history from JSON file
 */
function importChatHistory(event) {
    const file = event.target.files[0];
    if (!file) return;
   
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            const existingChats = getAllChats();
            let mergedChats = { ...existingChats };
           
            if (imported.chats) {
                mergedChats = { ...existingChats, ...imported.chats };
            } else if (imported.id) {
                mergedChats[imported.id] = imported;
            }
           
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedChats));
            alert('Chat history imported successfully!');
            loadAllChats();
            renderHistoryList();
        } catch (error) {
            alert('Error importing file: Invalid format');
        }
    };
    reader.readAsText(file);
}

/**
 * Render the chat history list in sidebar
 */
function renderHistoryList() {
    const historyList = document.getElementById("historyList");
    if (!historyList) return;
   
    const allChats = getAllChats();
    const chatArray = Object.values(allChats);
   
    if (chatArray.length === 0) {
        historyList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">
                No saved chats<br>
                Start a new conversation!
            </div>
        `;
        return;
    }
   
    chatArray.sort((a, b) => b.timestamp - a.timestamp);
   
    historyList.innerHTML = chatArray.map(chat => `
        <div class="history-item ${currentChatId === chat.id ? 'active' : ''}"
             data-id="${chat.id}"
             onclick="window.loadChatById('${chat.id}')">
            <div class="history-title">💬 ${escapeHtml(chat.title)}</div>
            <div class="history-preview">${escapeHtml(chat.preview || 'Click to view')}</div>
            <div class="history-date">${formatDate(chat.timestamp)} • ${chat.messageCount || chat.messages.length} messages</div>
            <button class="delete-history-btn" onclick="event.stopPropagation(); window.deleteChat('${chat.id}', event)">Delete</button>
        </div>
    `).join('');
}

/**
 * Update active chat highlighting in sidebar
 */
function updateActiveChatInSidebar(chatId) {
    document.querySelectorAll('.history-item').forEach(item => {
        if (item.dataset.id === chatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Format timestamp for display
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
   
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Add message to chat with link support
 */
function addMessageToChat(role, content, shouldSave = true) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${role}-message`;
   
    const formattedContent = formatMessageContent(content);
    messageEl.innerHTML = `<p>${formattedContent}</p>`;
    chatMessages.appendChild(messageEl);
   
    // Add click event listener to all links in the message
    const links = messageEl.querySelectorAll('.chat-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
   
    chatMessages.scrollTop = chatMessages.scrollHeight;
   
    if (shouldSave) {
        saveCurrentChat();
    }
}

/**
 * Sends a message to the chat API and processes the response
 */
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

    chatHistory.push({ role: "user", content: message });
    saveCurrentChat();

    try {
        const assistantMessageEl = document.createElement("div");
        assistantMessageEl.className = "message assistant-message";
        assistantMessageEl.innerHTML = "<p></p>";
        chatMessages.appendChild(assistantMessageEl);
        const assistantTextEl = assistantMessageEl.querySelector("p");

        chatMessages.scrollTop = chatMessages.scrollHeight;

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messages: chatHistory,
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to get response");
        }
        if (!response.body) {
            throw new Error("Response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";
        let buffer = "";
       
        const updateMessageContent = () => {
            // Update with formatted content including links
            const formatted = formatMessageContent(responseText);
            assistantTextEl.innerHTML = formatted;
           
            // Add click handlers to any links in the updated content
            const links = assistantMessageEl.querySelectorAll('.chat-link');
            links.forEach(link => {
                link.addEventListener('click', (e) => e.stopPropagation());
            });
           
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        let sawDone = false;
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                const parsed = consumeSseEvents(buffer + "\n\n");
                for (const data of parsed.events) {
                    if (data === "[DONE]") break;
                    try {
                        const jsonData = JSON.parse(data);
                        let content = "";
                        if (typeof jsonData.response === "string" && jsonData.response.length > 0) {
                            content = jsonData.response;
                        } else if (jsonData.choices?.[0]?.delta?.content) {
                            content = jsonData.choices[0].delta.content;
                        }
                        if (content) {
                            responseText += content;
                            updateMessageContent();
                        }
                    } catch (e) {
                        console.error("Error parsing SSE data:", e);
                    }
                }
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const parsed = consumeSseEvents(buffer);
            buffer = parsed.buffer;
            for (const data of parsed.events) {
                if (data === "[DONE]") {
                    sawDone = true;
                    buffer = "";
                    break;
                }
                try {
                    const jsonData = JSON.parse(data);
                    let content = "";
                    if (typeof jsonData.response === "string" && jsonData.response.length > 0) {
                        content = jsonData.response;
                    } else if (jsonData.choices?.[0]?.delta?.content) {
                        content = jsonData.choices[0].delta.content;
                    }
                    if (content) {
                        responseText += content;
                        updateMessageContent();
                    }
                } catch (e) {
                    console.error("Error parsing SSE data:", e);
                }
            }
            if (sawDone) break;
        }

        if (responseText.length > 0) {
            chatHistory.push({ role: "assistant", content: responseText });
            saveCurrentChat();
            renderHistoryList();
        }
    } catch (error) {
        console.error("Error:", error);
        addMessageToChat(
            "assistant",
            "Sorry, there was an error processing your request. Please try again.",
        );
        chatHistory.push({
            role: "assistant",
            content: "Sorry, there was an error processing your request. Please try again."
        });
        saveCurrentChat();
    } finally {
        typingIndicator.classList.remove("visible");
        isProcessing = false;
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    }
}

/**
 * Parse SSE events from buffer
 */
function consumeSseEvents(buffer) {
    let normalized = buffer.replace(/\r/g, "");
    const events = [];
    let eventEndIndex;
    while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
        const rawEvent = normalized.slice(0, eventEndIndex);
        normalized = normalized.slice(eventEndIndex + 2);

        const lines = rawEvent.split("\n");
        const dataLines = [];
        for (const line of lines) {
            if (line.startsWith("data:")) {
                dataLines.push(line.slice("data:".length).trimStart());
            }
        }
        if (dataLines.length === 0) continue;
        events.push(dataLines.join("\n"));
    }
    return { events, buffer: normalized };
}

// Make functions globally available
window.startNewChat = startNewChat;
window.deleteChat = deleteChat;
window.clearAllHistory = clearAllHistory;
window.exportChatHistory = exportChatHistory;
window.importChatHistory = importChatHistory;
window.loadChatById = loadChat;
