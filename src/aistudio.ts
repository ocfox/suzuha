import { Content, GoogleGenAI } from "@google/genai";
import { appendGoogleMessage, getGoogleChat, initGoogleChat } from "./kv.ts";
import { dict } from "./dict.ts";

// Re-export the getGoogleChat function so it can be used by server.ts
export { getGoogleChat } from "./kv.ts";

const ai = new GoogleGenAI({
  apiKey: Deno.env.get("GOOGLE_API_KEY") || "",
});

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
      config: {
        thinkingConfig: {
          thinkingBudget: -1,
        },
        tools: [
          {
            googleSearch: {},
          },
        ]
      },
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
      messages = [...messagesResult.value, {
        role: "user",
        parts: [{ text: prompt }],
      }];
    } else {
      // This should rarely happen in a reply scenario, but handle it just in case
      console.warn(
        `No history found for ID ${id} in googleReply, this is unusual for a reply.`,
      );
      messages = [{
        role: "user",
        parts: [{ text: prompt }],
      }];
    }

    // Get response from Google AI Studio
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
