import { Content, GoogleGenAI } from "@google/genai";
import { appendGoogleMessage, getGoogleChat, initGoogleChat } from "./kv.ts";
import { dict } from "./dict.ts";

const ai = new GoogleGenAI({
  apiKey: Deno.env.get("GOOGLE_API_KEY") || "",
});

export async function googleChatWrapper(id: number, prompt: string) {
  // Create initial messages with system prompt and user message
  const initialMessages: Content[] = [
    {
      role: "system",
      parts: [{ text: dict.zh.system }],
    },
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ];

  // Store the initial conversation in KV
  await initGoogleChat(id, initialMessages);

  // Get response from Google AI Studio
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: initialMessages,
  });

  const answer = response.text;
  if (!answer) {
    return "知らない。";
  }

  // Save assistant's response to the conversation
  await appendGoogleMessage(id, "model", answer);

  return answer ? answer : "知らない。";
}

export async function googleChat(messages: Content[]) {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: messages,
  });
  const answer = response.text;
  if (!answer) {
    return "知らない。";
  }
  return answer ? answer : "知らない。";
}

export async function googleReply(id: number, prompt: string) {
  // Get existing conversation history
  const messagesResult = await getGoogleChat(id);
  let messages: Content[] = [];

  // If no history, start a new conversation with system prompt
  if (!messagesResult.value || messagesResult.value.length === 0) {
    messages = [
      {
        role: "system",
        parts: [{ text: dict.zh.system }],
      },
    ];
  } else {
    messages = messagesResult.value;
  }

  // Add user's current message
  await appendGoogleMessage(id, "user", prompt);

  // Add user message to the messages array for the current request
  messages.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  // Get response from Google AI Studio
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: messages,
  });

  const answer = response.text;
  if (!answer) {
    return dict.zh.unknown;
  }

  // Save assistant's response
  await appendGoogleMessage(id, "model", answer);

  return answer;
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
