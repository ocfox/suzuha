import { Content, GoogleGenAI } from "@google/genai";
import { appendGoogleMessage, getGoogleChat, initGoogleChat } from "./kv.ts";
import { dict } from "./dict.ts";
import { Context } from "grammy";
import { contentType } from "@std/media-types";
import { encodeBase64 } from "@std/encoding/base64";

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
    throw new Error("File path is not available.");
  }

  const response = await fetch(
    `https://api.telegram.org/file/bot${token}/${file.file_path}`,
  );

  return [
    encodeBase64(await response.arrayBuffer()),
    contentType(file.file_path) || "image/jpeg",
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

const generateResponse = async (messages: Content[]) => {
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    config,
    contents: messages,
  });
  return response.text || dict.zh.unknown;
};

export async function googleChatWrapper(id: number, prompt: string, ctx?: Context) {
  try {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // Add image if present
    if (ctx?.message?.photo) {
      const photoArray = ctx.message.photo;
      const largestPhoto = photoArray[photoArray.length - 1];
      const [base64Data, mimeType] = await getFileAsBase64(ctx, largestPhoto.file_id);
      parts.push({ inlineData: { mimeType, data: base64Data } });
    }

    // Add text prompt
    parts.push({ text: prompt });

    const initialMessages: Content[] = [
      { role: "user", parts },
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
