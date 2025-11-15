import { Content, GoogleGenAI } from "@google/genai";
import { appendGoogleMessage, getGoogleChat, initGoogleChat } from "./kv.ts";
import { dict } from "./dict.ts";
import { Context } from "grammy";
import { typeByExtension } from "@std/media-types";
import { extname } from "@std/path";
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
    typeByExtension(extname(file.file_path)) || "image/jpeg",
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
Only use bold when really needed.

Response structure rules:
1. Start with a SHORT direct answer (2-5 sentences) - keep this as plain text
2. If you need to provide detailed explanations, examples, background info, or elaborations, wrap them in blockquote using >
3. Use blockquote for ANY content longer than 5-6 sentences or one paragraph
4. Spoilers: If the response must include spoiler content (specific words, sentences, or paragraphs), you must wrap that specific content in <tg-spoiler>xxx</tg-spoiler> tags.

Think of it as:
* Plain text = TL;DR (the essential answer)
* Blockquote = detailed explanation (for those who want more context)

Example structure:
The answer is X because of Y. Key point 1, key point 2.
> Here's the detailed explanation...
> <tg-spoiler>This is a spoiler detail about Z.</tg-spoiler>
> More non-spoiler details...

CRITICAL: NEVER use markdown tables (with | symbols). My device cannot display them at all.
* DO NOT use tables in any format (no |, no alignment with ---|---)
* Instead, use bullet points, numbered lists, or plain text with line breaks
* For comparisons, use "vs" or "compared to" in bullet points
* For data, use descriptive sentences or simple lists

Respond in the same language as the user's prompt (Chinese first).

When presenting mathematical equations, use inline notation or code blocks as appropriate.
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

export async function googleChatWrapper(
  id: number,
  prompt: string,
  ctx?: Context,
) {
  try {
    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [];

    // Add image if present
    if (ctx?.message?.photo) {
      const photoArray = ctx.message.photo;
      const largestPhoto = photoArray[photoArray.length - 1];
      const [base64Data, mimeType] = await getFileAsBase64(
        ctx,
        largestPhoto.file_id,
      );
      parts.push({ inlineData: { mimeType, data: base64Data } });
    }

    // Add text prompt
    parts.push({ text: prompt });

    const initialMessages: Content[] = [{ role: "user", parts }];

    // Store only text parts in KV (images are too large)
    const kvMessages: Content[] = [{ role: "user", parts: [{ text: prompt }] }];

    await initGoogleChat(id, kvMessages);
    const answer = await generateResponse(initialMessages);
    await appendGoogleMessage(id, "model", answer);

    return answer;
  } catch (error) {
    console.error("Error in googleChatWrapper:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

export async function googleReply(id: number, prompt: string, ctx?: Context) {
  try {
    const messagesResult = await getGoogleChat(id);

    // Build parts with optional image
    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [];

    if (ctx?.message?.photo) {
      const photoArray = ctx.message.photo;
      const largestPhoto = photoArray[photoArray.length - 1];
      const [base64Data, mimeType] = await getFileAsBase64(
        ctx,
        largestPhoto.file_id,
      );
      parts.push({ inlineData: { mimeType, data: base64Data } });
    }

    parts.push({ text: prompt });

    // Store only text in KV
    await appendGoogleMessage(id, "user", prompt);

    const messages: Content[] =
      messagesResult.value && messagesResult.value.length > 0
        ? [...messagesResult.value, { role: "user", parts }]
        : [{ role: "user", parts }];

    const answer = await generateResponse(messages);
    await appendGoogleMessage(id, "model", answer);

    return answer;
  } catch (error) {
    console.error("Error in googleReply:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
