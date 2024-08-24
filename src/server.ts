import {
  webhookCallback,
  Bot,
} from "https://deno.land/x/grammy@v1.29.0/mod.ts";

import { groqChat, groqReply } from "./groq.ts";

export const bot = new Bot(Deno.env.get("BOT_TOKEN") || "");

bot.command("chat", (ctx) => {
  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!prompt) {
    return ctx.reply("Please provide a prompt.");
  }
  groqChat(ctx.msgId, prompt).then((response) =>
    ctx.reply(response, { reply_parameters: { message_id: ctx.msgId } })
  );
});

bot.on(":text", (ctx) => {
  if (
    ctx.message?.reply_to_message &&
    ctx.message.reply_to_message.from?.id === bot.botInfo.id
  ) {
    groqReply(ctx.msgId, ctx.message.text).then((response) =>
      ctx.reply(response, { reply_parameters: { message_id: ctx.msgId } })
    );
  }
});

const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  if (req.method === "POST") {
    try {
      return await handleUpdate(req);
    } catch (err) {
      console.error(err);
    }
  }
  return new Response();
});
