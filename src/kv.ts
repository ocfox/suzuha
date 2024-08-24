const kv = await Deno.openKv();

export async function init(id: number, data: Message[]) {
  await kv.set([id], data);
}

async function update(id: number, data: Message) {
  const messages = await kv.get<Message[]>([id]);
  if (messages) {
    await kv.set([id], messages.value?.push(data));
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
