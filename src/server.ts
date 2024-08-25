import {
  webhookCallback,
  Bot,
  Context,
} from "https://deno.land/x/grammy@v1.29.0/mod.ts";

import { groqChat, groqReply } from "./groq.ts";
import { setReply } from "./kv.ts";
import { fluxImage, StableDiffusionXLImg2Img } from "./huggingface.ts";
import { InputFile } from "https://deno.land/x/grammy@v1.29.0/types.deno.ts";
import { dict } from "./dict.ts";

const bot = new Bot(Deno.env.get("BOT_TOKEN") || "");

const getFile = async (ctx: Context, fileId: string) => {
  const file = await ctx.api.getFile(fileId);
  const response = await fetch(
    `https://api.telegram.org/file/bot${Deno.env.get("BOT_TOKEN")}/${
      file.file_path
    }`
  );
  return response.blob();
};

bot.command("chat", (ctx) => {
  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!prompt) {
    return ctx.reply(dict.zh.empty);
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
    return ctx.reply(dict.zh.empty);
  }

  const image = await fluxImage(prompt);
  await ctx.replyWithPhoto(new InputFile(image), {
    reply_parameters: { message_id: ctx.msgId },
  });
});

bot.command("i2i", async (ctx) => {
  if (!ctx.message?.reply_to_message?.photo) {
    return ctx.reply(dict.zh.noImage);
  }

  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  const inputImageId = ctx.message.reply_to_message.photo[0].file_id;
  const inputImage = await getFile(ctx, inputImageId);
  const image = await StableDiffusionXLImg2Img(inputImage, prompt);
});

bot.on(":text", async (ctx) => {
  if (
    ctx.message?.reply_to_message &&
    !ctx.message.reply_to_message.photo &&
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
  timeoutMilliseconds: 300_000,
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
