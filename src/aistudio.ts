import { Content, GoogleGenAI } from "@google/genai";
import { appendGoogleMessage, getGoogleChat, initGoogleChat } from "./kv.ts";
import { dict } from "./dict.ts";

export { getGoogleChat } from "./kv.ts";

const ai = new GoogleGenAI({
  apiKey: Deno.env.get("GOOGLE_API_KEY") || "",
});

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

const generateResponse = async (messages: Content[]) => {
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    config,
    contents: messages,
  });
  return response.text || dict.zh.unknown;
};

export async function googleChatWrapper(id: number, prompt: string) {
  try {
    const initialMessages: Content[] = [
      { role: "user", parts: [{ text: prompt }] },
    ];

    await initGoogleChat(id, initialMessages);
    const answer = await generateResponse(initialMessages);
    await appendGoogleMessage(id, "model", answer);

    return answer;
  } catch (error) {
    console.error("Error in googleChatWrapper:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

export async function googleReply(id: number, prompt: string) {
  try {
    const messagesResult = await getGoogleChat(id);
    await appendGoogleMessage(id, "user", prompt);

    const messages: Content[] = messagesResult.value && messagesResult.value.length > 0
      ? [...messagesResult.value, { role: "user", parts: [{ text: prompt }] }]
      : [{ role: "user", parts: [{ text: prompt }] }];

    const answer = await generateResponse(messages);
    await appendGoogleMessage(id, "model", answer);

    return answer;
  } catch (error) {
    console.error("Error in googleReply:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
