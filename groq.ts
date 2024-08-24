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
    model: "llama-3.1-70b-versatile",
  });
}

export async function groqChat(prompt: string) {
  const response = await getGroqChatCompletion(
    "你叫明前奶绿,你会用中文回答大家的问题",
    prompt
  );

  const answer = response.choices[0].message.content;
  const time = response.usage?.total_time;
  const tokens = response.usage?.total_tokens;

  return answer
    ? answer + "\n Time spent: " + time + "s\n Token used: " + tokens
    : "奶绿不知道";
}
