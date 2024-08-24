import { Groq } from "groq-sdk";
import { getStartMessages, init, updateChat } from "./kv.ts";
import { Role, Message } from "./types.ts";

const groq = new Groq({ apiKey: Deno.env.get("GROQ_TOKEN") || "" });

function messages(system: string, prompt: string): Message[] {
  const systemMessage = { role: Role.system, content: system };
  const userMessage = { role: Role.user, content: prompt };

  return [systemMessage, userMessage];
}

function initChat(prompt: string) {
  return messages("你叫明前奶绿,你会用中文回答大家的问题", prompt);
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
  const time = response.usage?.total_time;
  const tokens = response.usage?.total_tokens;

  if (!answer) {
    return "奶绿不知道";
  }

  await init(id, messages.concat({ role: Role.assistant, content: answer }));

  return answer
    ? answer + "\n Time spent: " + time + "s\n Tokens used: " + tokens
    : "奶绿不知道";
}

export async function groqReply(id: number, prompt: string) {
  const messages = await getStartMessages(id);

  if (!messages) {
    return "Old messages don't support replies.";
  }

  const response = await getGroqChatCompletion(
    messages.concat({
      role: Role.user,
      content: prompt,
    })
  );

  const answer = response.choices[0].message.content;
  const time = response.usage?.total_time;
  const tokens = response.usage?.total_tokens;

  if (!answer) {
    return "奶绿不知道";
  }

  updateChat(id, prompt, answer);

  return answer
    ? answer + "\n Time spent: " + time + "s\n Tokens used: " + tokens
    : "奶绿不知道";
}
