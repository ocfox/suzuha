import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: Deno.env.get("GROQ_TOKEN") || "" });

export function getGroqChatCompletion(system: string, prompt: string) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "llama3.1-70b-versatile",
  });
}

export async function groqChat(prompt: string) {
  const response = await getGroqChatCompletion(
    "你叫明前奶绿,你会用中文回答大家的问题",
    prompt
  );

  const answer = response.choices[0].message.content;

  return answer ? answer : "奶绿不知道";
}
