import { Content, GoogleGenAI } from "@google/genai";
import { appendGoogleMessage, getGoogleChat, initGoogleChat } from "./kv.ts";
import { dict } from "./dict.ts";
import { Context } from "grammy";
import { contentType } from "@std/media-types";
import { encodeBase64 } from "@std/encoding/base64";

// Re-export the getGoogleChat function so it can be used by server.ts
export { getGoogleChat } from "./kv.ts";

const ai = new GoogleGenAI({
	apiKey: Deno.env.get("GOOGLE_API_KEY") || "",
});

const getFileAsBase64 = async (
	ctx: Context,
	fileId: string,
): Promise<[string, string]> => {
	const file = await ctx.api.getFile(fileId);
	const token = Deno.env.get("BOT_TOKEN");

	if (!file.file_path) {
		throw new Error("File path is not available in the file object.");
	}

	const response = await fetch(
		`https://api.telegram.org/file/bot${token}/${file.file_path}`,
	);

	return [
		encodeBase64(await response.arrayBuffer()),
		contentType(file.file_path) || "application/octet-stream",
	];
};

const config = {
	thinkingConfig: {
		thinkingBudget: -1,
	},
	tools: [
		{
			googleSearch: {},
		},
	],
	systemInstruction: [
		{
			text: `
Important: When presenting long content (more than 4 lines or 200 characters), always wrap it in a blockquote using > at the start of each line. This applies to:
- Long explanations
- Multi-paragraph responses
- Extended quotes
- Detailed instructions

Respond in the same language as the user's prompt(Chinese first). When presenting mathematical equations, use inline notation or code blocks as appropriate.
`,
		},
	],
};

export async function googleChatWrapper(id: number, prompt: string) {
	try {
		const initialMessages: Content[] = [
			{
				role: "user",
				parts: [{ text: prompt }],
			},
		];

		// Store the initial conversation in KV
		await initGoogleChat(id, initialMessages);

		// Get response from Google AI Studio
		const response = await ai.models.generateContent({
			model: "gemini-flash-latest",
			config,
			contents: initialMessages,
		});

		const answer = response.text;
		if (!answer) {
			return "知らない。";
		}

		// Save assistant's response to the conversation
		await appendGoogleMessage(id, "model", answer);

		return answer;
	} catch (error) {
		console.error("Error in googleChatWrapper:", error);
		return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
	}
}

export async function googleChat(messages: Content[]) {
	try {
		const response = await ai.models.generateContent({
			model: "gemini-flash-latest",
			config,
			contents: messages,
		});
		const answer = response.text;
		return answer || "知らない。";
	} catch (error) {
		console.error("Error in googleChat:", error);
		return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
	}
}

export async function googleReply(id: number, prompt: string) {
	try {
		// Get existing conversation history using the ID
		const messagesResult = await getGoogleChat(id);

		// Add user's current message to the history
		await appendGoogleMessage(id, "user", prompt);

		// Prepare messages for API request - use history if available or create minimal context
		let messages: Content[];
		if (messagesResult.value && messagesResult.value.length > 0) {
			// Use existing conversation history plus the new user message
			messages = [
				...messagesResult.value,
				{
					role: "user",
					parts: [{ text: prompt }],
				},
			];
		} else {
			// This should rarely happen in a reply scenario, but handle it just in case
			console.warn(
				`No history found for ID ${id} in googleReply, this is unusual for a reply.`,
			);
			messages = [
				{
					role: "user",
					parts: [{ text: prompt }],
				},
			];
		}

		// Get response from Google AI Studio
		const response = await ai.models.generateContent({
			model: "gemini-flash-latest",
			config,
			contents: messages,
		});

		const answer = response.text;
		if (!answer) {
			return dict.zh.unknown;
		}

		// Save assistant's response to the conversation
		await appendGoogleMessage(id, "model", answer);

		return answer;
	} catch (error) {
		console.error("Error in googleReply:", error);
		return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
	}
}

// test function
async function testGoogleChat() {
	const messages: Content[] = [
		{
			role: "user",
			parts: [{ text: "Hello, how are you?" }],
		},
	];
	const response = await googleChat(messages);
	console.log(response);
}
