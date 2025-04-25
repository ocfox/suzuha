import { Message, Role } from "./types.ts";
import { Content } from "@google/genai";

const kv = await Deno.openKv();

export async function init(id: number, data: Message[]) {
  await kv.set([id], data);
}

async function update(id: number, data: Message) {
  const messages = await kv.get<Message[]>([id]);
  if (messages.value) {
    await kv.set([id], messages.value.concat(data));
  }
}

export async function updateChat(id: number, user: string, assistant: string) {
  const startId = await getStartId(id);

  await update(startId, { role: Role.user, content: user });
  await update(startId, { role: Role.assistant, content: assistant });
}

export async function get(id: number) {
  return await kv.get<Message[]>([id]);
}

export async function getStartId(id: number): Promise<number> {
  const value = await kv.get([id]);

  if (typeof value.value === "number") {
    return getStartId(value.value);
  }

  return id;
}

export async function getStartMessages(id: number): Promise<Message[] | null> {
  const startId = await getStartId(id);
  const value = await kv.get<Message[]>([startId]);

  return value.value;
}

export async function setReply(prevId: number, id: number) {
  await kv.set([id], prevId);
}

// Google AI Studio Content[] storage functions
export async function initGoogleChat(id: number, data: Content[]) {
  await kv.set([`google:${id}`], data);
}

export async function updateGoogleChat(id: number, data: Content) {
  const messages = await kv.get<Content[]>([`google:${id}`]);
  if (messages.value) {
    await kv.set([`google:${id}`], [...messages.value, data]);
  } else {
    await kv.set([`google:${id}`], [data]);
  }
}

export async function getGoogleChat(id: number) {
  return await kv.get<Content[]>([`google:${id}`]);
}

export async function appendGoogleMessage(
  id: number,
  role: string,
  text: string,
) {
  const newContent: Content = {
    role: role,
    parts: [{ text }],
  };
  await updateGoogleChat(id, newContent);
}
