import { Groq } from "groq-sdk";
import { getStartMessages, init, updateChat } from "./kv.ts";
import { Message, Role } from "./types.ts";
import { dict } from "./dict.ts";

const groq = new Groq({ apiKey: Deno.env.get("GROQ_TOKEN") || "" });

function genMessages(system: string, prompt: string): Message[] {
  const systemMessage = { role: Role.system, content: system };
  const userMessage = { role: Role.user, content: prompt };

  return [systemMessage, userMessage];
}

function initChat(prompt: string) {
  return genMessages(dict.zh.system, prompt);
}

export function getGroqChatCompletion(messages: Message[]) {
  return groq.chat.completions.create({
    messages: messages,
    model: "llama-3.1-70b-versatile",
  });
}

export async function groqChat(id: number, prompt: string) {
  const messages = initChat(prompt);
  const response = await getGroqChatCompletion(messages);

  const answer = response.choices[0].message.content;
  if (!answer) {
    return dict.zh.unknown;
  }

  await init(id, messages.concat({ role: Role.assistant, content: answer }));

  return answer ? answer : dict.zh.unknown;
}

export async function groqTranslate(prompt: string) {
  const messages = genMessages(
    "你是一个翻译机器人，任何回复翻译成中文，要求简洁优雅。",
    prompt,
  );
  const response = await getGroqChatCompletion(messages);
  const answer = response.choices[0].message.content;

  if (!answer) {
    return dict.zh.unknown;
  }

  return answer ? answer : dict.zh.unknown;
}

export async function groqReply(id: number, prompt: string) {
  const messages = await getStartMessages(id);

  if (!messages) {
    return dict.zh.old;
  }

  const response = await getGroqChatCompletion(
    messages.concat({ role: Role.user, content: prompt }),
  );

  const answer = response.choices[0].message.content;
  // const time = response.usage?.total_time;
  // const tokens = response.usage?.total_tokens;

  if (!answer) {
    return dict.zh.unknown;
  }

  updateChat(id, prompt, answer);

  return answer ? answer : dict.zh.unknown;
}
