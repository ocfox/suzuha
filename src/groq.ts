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
    model: "llama-3.3-70b-versatile",
  });
}

export async function groqChat(id: number, prompt: string) {
  const messages = initChat(prompt);
  let response;
  try {
    response = await getGroqChatCompletion(messages);
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return "An unknown error occurred";
  }

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

  try {
    const response = await getGroqChatCompletion(messages);
    const answer = response.choices[0].message.content;
    return answer || dict.zh.unknown;
  } catch (error) {
    if (error instanceof Error) {
      return `Translation error: ${error.message}`;
    }
    return "An unknown translation error occurred";
  }
}

export async function groqReply(id: number, prompt: string) {
  const messages = await getStartMessages(id);

  if (!messages) {
    return dict.zh.old;
  }

  try {
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
    return answer;
  } catch (error) {
    if (error instanceof Error) {
      return `Reply error: ${error.message}`;
    }
    return "An unknown reply error occurred";
  }
}

export async function whisper(audioFile: Blob, toChinese: boolean) {
  const voice = new File([audioFile], "voice.ogg");

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: voice,
      model: "whisper-large-v3-turbo",
      response_format: "json",
    });

    if (toChinese) {
      try {
        const translationMessages = genMessages(
          "你是一个翻译机器人，任何回复翻译成中文，要求简洁优雅。",
          transcription.text,
        );
        const translationResponse = await getGroqChatCompletion(
          translationMessages,
        );
        const translatedText = translationResponse.choices[0].message.content;

        if (!translatedText) {
          return transcription.text + "\n" + dict.zh.unknown;
        }

        return transcription.text + "\n" + translatedText;
      } catch (error) {
        // Return original transcription with error message
        return transcription.text + "\n" + "Translation error: " +
          (error instanceof Error ? error.message : "Unknown error");
      }
    }

    return transcription.text;
  } catch (error) {
    return "Transcription error: " +
      (error instanceof Error ? error.message : "Unknown error");
  }
}
