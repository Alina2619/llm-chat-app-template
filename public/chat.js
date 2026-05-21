/**
 * LLM Chat App Frontend
 *
 * Handles the chat UI interactions and communication with the backend API.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Default message
const DEFAULT_HISTORY = [
	{
		role: "assistant",
		content:
			"Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
	},
];

// Load saved history
let chatHistory =
	JSON.parse(localStorage.getItem("chatHistory")) ||
	DEFAULT_HISTORY;

let isProcessing = false;

// Save history
function saveHistory() {
	localStorage.setItem(
		"chatHistory",
		JSON.stringify(chatHistory)
	);
}

// Render saved messages on page load
chatHistory.forEach((msg) => {
	addMessageToChat(
		msg.role,
		msg.content
	);
});

// Auto-resize textarea
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

/**
 * Send message
 */
async function sendMessage() {
	const message = userInput.value.trim();

	if (message === "" || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// Add user message to UI
	addMessageToChat("user", message);

	// Save user message
	chatHistory.push({
		role: "user",
		content: message,
	});

	saveHistory();

	// Clear input
	userInput.value = "";
	userInput.style.height = "auto";

	typingIndicator.classList.add("visible");

	try {
		const assistantMessageEl =
			document.createElement("div");

		assistantMessageEl.className =
			"message assistant-message";

		assistantMessageEl.innerHTML =
			"<p></p>";

		chatMessages.appendChild(
			assistantMessageEl
		);

		const assistantTextEl =
			assistantMessageEl.querySelector("p");

		chatMessages.scrollTop =
			chatMessages.scrollHeight;

		const response = await fetch(
			"/api/chat",
			{
				method: "POST",
				headers: {
					"Content-Type":
						"application/json",
				},
				body: JSON.stringify({
					messages: chatHistory,
				}),
			}
		);

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

		const decoder =
			new TextDecoder();

		let responseText = "";
		let buffer = "";

		const flushAssistantText = () => {
			assistantTextEl.textContent =
				responseText;

			chatMessages.scrollTop =
				chatMessages.scrollHeight;
		};

		let sawDone = false;

		while (true) {
			const {
				done,
				value,
			} = await reader.read();

			if (done) {

				const parsed =
					consumeSseEvents(
						buffer + "\n\n"
					);

				for (const data of parsed.events) {

					if (data === "[DONE]") {
						break;
					}

					try {

						const jsonData =
							JSON.parse(data);

						let content = "";

						if (
							typeof jsonData.response ===
								"string" &&
							jsonData.response.length > 0
						) {
							content =
								jsonData.response;
						} else if (
							jsonData.choices?.[0]
								?.delta?.content
						) {
							content =
								jsonData.choices[0]
									.delta.content;
						}

						if (content) {
							responseText +=
								content;

							flushAssistantText();
						}

					} catch (e) {
						console.error(
							"JSON parse error",
							e
						);
					}
				}

				break;
			}

			buffer += decoder.decode(
				value,
				{ stream: true }
			);

			const parsed =
				consumeSseEvents(buffer);

			buffer = parsed.buffer;

			for (const data of parsed.events) {

				if (data === "[DONE]") {
					sawDone = true;
					buffer = "";
					break;
				}

				try {

					const jsonData =
						JSON.parse(data);

					let content = "";

					if (
						typeof jsonData.response ===
							"string" &&
						jsonData.response.length > 0
					) {
						content =
							jsonData.response;
					} else if (
						jsonData.choices?.[0]
							?.delta?.content
					) {
						content =
							jsonData.choices[0]
								.delta.content;
					}

					if (content) {
						responseText +=
							content;

						flushAssistantText();
					}

				} catch (e) {
					console.error(
						"JSON parse error",
						e
					);
				}
			}

			if (sawDone) {
				break;
			}
		}

		// Save assistant response
		if (responseText.length > 0) {

			chatHistory.push({
				role: "assistant",
				content: responseText,
			});

			saveHistory();
		}

	} catch (error) {

		console.error("Error:", error);

		addMessageToChat(
			"assistant",
			"Sorry, there was an error processing your request."
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

/**
 * Add message to UI
 */
function addMessageToChat(
	role,
	content
) {

	const messageEl =
		document.createElement("div");

	messageEl.className =
		`message ${role}-message`;

	messageEl.innerHTML =
		`<p>${content}</p>`;

	chatMessages.appendChild(
		messageEl
	);

	chatMessages.scrollTop =
		chatMessages.scrollHeight;
}

/**
 * Parse SSE stream
 */
function consumeSseEvents(buffer) {

	let normalized =
		buffer.replace(/\r/g, "");

	const events = [];

	let eventEndIndex;

	while (
		(eventEndIndex =
			normalized.indexOf("\n\n")) !== -1
	) {

		const rawEvent =
			normalized.slice(
				0,
				eventEndIndex
			);

		normalized =
			normalized.slice(
				eventEndIndex + 2
			);

		const lines =
			rawEvent.split("\n");

		const dataLines = [];

		for (const line of lines) {

			if (
				line.startsWith("data:")
			) {

				dataLines.push(
					line
						.slice(5)
						.trimStart()
				);
			}
		}

		if (
			dataLines.length === 0
		)
			continue;

		events.push(
			dataLines.join("\n")
		);
	}

	return {
		events,
		buffer: normalized,
	};
}
