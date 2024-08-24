import {
  webhookCallback,
  Bot,
} from "https://deno.land/x/grammy@v1.29.0/mod.ts";

import { groqChat, groqReply } from "./groq.ts";
import { setReply } from "./kv.ts";
import { fluxImage } from "./huggingface.ts";
import { InputFile } from "https://deno.land/x/grammy@v1.29.0/types.deno.ts";

export const bot = new Bot(Deno.env.get("BOT_TOKEN") || "");

bot.command("chat", (ctx) => {
  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!prompt) {
    return ctx.reply("Please provide a prompt.");
  }
  groqChat(ctx.msgId, prompt).then(async (response) => {
    const reply = await ctx.reply(response, {
      reply_parameters: { message_id: ctx.msgId },
    });
    await setReply(ctx.msgId, reply.message_id);
  });
});

bot.command("image", async (ctx) => {
  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!prompt) {
    return ctx.reply("Please provide a prompt.");
  }

  const image = await fluxImage(prompt);
  await ctx.replyWithPhoto(new InputFile(image));
});

bot.on(":text", async (ctx) => {
  if (
    ctx.message?.reply_to_message &&
    ctx.message.reply_to_message.from?.id === bot.botInfo.id
  ) {
    await setReply(ctx.message.reply_to_message.message_id, ctx.msgId);

    groqReply(ctx.msgId, ctx.message.text).then(async (response) => {
      const reply = await ctx.reply(response, {
        reply_parameters: { message_id: ctx.msgId },
      });
      await setReply(ctx.msgId, reply.message_id);
    });
  }
});

const handleUpdate = webhookCallback(bot, "std/http", {
  timeoutMilliseconds: 120_000,
});

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
