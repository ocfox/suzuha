import {
  Bot,
  Context,
  webhookCallback,
} from "grammy";

import { groqTranslate, whisper } from "./groq.ts";
import { setGoogleReply, setReply } from "./kv.ts";
import { getGoogleChat, googleChatWrapper, googleReply } from "./aistudio.ts";
import { dict } from "./dict.ts";
import { fluxImage, StableDiffusionXLImg2Img } from "./huggingface.ts";
import { InputFile } from "https://deno.land/x/grammy@v1.34.1/types.deno.ts";
import { marked } from "marked";
import { TelegramRenderer } from "./render.ts";

const bot = new Bot<Context>(Deno.env.get("BOT_TOKEN") || "");

const send = async (
  ctx: Context,
  text: string,
  replyToMessageId: number,
) => {
  const html = await marked(text, { renderer: new TelegramRenderer() });
  const reply = await ctx.reply(html, {
    reply_parameters: { message_id: replyToMessageId },
    parse_mode: "HTML",
  });
  return reply;
};

const handleChatCommand = async (ctx: Context, prompt: string) => {
  if (!ctx.msgId) return;
  try {
    const response = await googleChatWrapper(ctx.msgId, prompt);
    const reply = await send(ctx, response, ctx.msgId);
    await setReply(ctx.msgId, reply.message_id);
    await setGoogleReply(ctx.msgId, reply.message_id);
  } catch (error) {
    await ctx.reply(
      `Failed to process: ${error instanceof Error ? error.message : "Unknown error"}`,
      { reply_parameters: { message_id: ctx.msgId } }
    );
  }
};

const getFile = async (ctx: Context, fileId: string) => {
  const file = await ctx.api.getFile(fileId);
  const response = await fetch(
    `https://api.telegram.org/file/bot${Deno.env.get("BOT_TOKEN")
    }/${file.file_path}`,
  );
  return response.blob();
};

bot.command("chat", (ctx) => {
  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!prompt) return ctx.reply(dict.zh.empty);
  handleChatCommand(ctx, prompt);
});

bot.command("what", (ctx) => {
  if (!ctx.message?.reply_to_message?.text) {
    return ctx.reply("Please reply to a message to ask what it means");
  }
  const prompt = ctx.message.reply_to_message.text + "\n" + dict.zh.what;
  handleChatCommand(ctx, prompt);
});

bot.command("why", (ctx) => {
  if (!ctx.message?.reply_to_message?.text) {
    return ctx.reply("Please reply to a message to ask why");
  }
  const prompt = dict.zh.why + ctx.message.reply_to_message.text + "?";
  handleChatCommand(ctx, prompt);
});

bot.command("ah", (ctx) => {
  if (!ctx.message?.reply_to_message?.text) {
    return ctx.reply("Please reply to a message to use this command");
  }
  let prompt = ctx.message.reply_to_message.text;
  if (prompt.endsWith("吧")) {
    prompt = prompt.slice(0, -1) + "吗?";
  } else if (!prompt.endsWith("?") && !prompt.endsWith("？")) {
    prompt = prompt + "?";
  }
  handleChatCommand(ctx, prompt);
});

bot.command("image", async (ctx) => {
  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!prompt) {
    return ctx.reply(dict.zh.empty);
  }

  try {
    const image = await fluxImage(prompt);
    await ctx.replyWithPhoto(new InputFile(image), {
      reply_parameters: { message_id: ctx.msgId },
    });
  } catch (error) {
    await ctx.reply(
      `Failed to generate image: ${error instanceof Error ? error.message : "Unknown error"
      }`,
      {
        reply_parameters: { message_id: ctx.msgId },
      },
    );
  }
});

bot.command("i2i", async (ctx) => {
  if (!ctx.message?.reply_to_message?.photo) {
    return ctx.reply(dict.zh.noImage);
  }

  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  const inputImageId = ctx.message.reply_to_message.photo[0].file_id;

  try {
    const inputImage = await getFile(ctx, inputImageId);
    const image = await StableDiffusionXLImg2Img(inputImage, prompt);

    await ctx.replyWithPhoto(new InputFile(image), {
      reply_parameters: { message_id: ctx.msgId },
    });
  } catch (error) {
    await ctx.reply(
      `Failed to process image: ${error instanceof Error ? error.message : "Unknown error"
      }`,
      {
        reply_parameters: { message_id: ctx.msgId },
      },
    );
  }
});

bot.command("whisper", async (ctx) => {
  if (!ctx.message?.reply_to_message?.voice) {
    return ctx.reply(dict.zh.noAudio);
  }

  try {
    const inputAudioId = ctx.message.reply_to_message.voice.file_id;
    const inputAudio = await getFile(ctx, inputAudioId);
    const toChinese = ctx.message?.text?.split(" ").slice(1).join(" ") === "zh";
    const text = await whisper(inputAudio, toChinese);

    await send(ctx, text, ctx.msgId);
  } catch (error) {
    await ctx.reply(
      `Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"
      }`,
      {
        reply_parameters: { message_id: ctx.msgId },
      },
    );
  }
});

bot.command("translate", (ctx) => {
  if (!ctx.message?.reply_to_message || !ctx.message.reply_to_message.text) {
    return ctx.reply("Please reply to a message to translate it");
  }
  const prompt = ctx.message.reply_to_message.text;

  groqTranslate(prompt)
    .then(async (response) => {
      await send(ctx, response, ctx.msgId);
    })
    .catch(async (error) => {
      await ctx.reply(
        `Translation error: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          reply_parameters: { message_id: ctx.msgId },
        },
      );
    });
});

bot.command("help", (ctx) => {
  const helpText = "Commands:\n" +
    "/ah - Ask from message\n" +
    "/chat <text> - Chat with the bot\n" +
    "/what - Ask the bot what the previous message means\n" +
    "/why - Ask the bot why the previous message\n" +
    "/image <text> - Generate an image from text\n" +
    "/i2i <text> - Generate an image from an image and text\n" +
    "/whisper - Transcribe audio (reply with 'zh' to translate to Chinese)\n" +
    "/translate - Translate text to Chinese";

  send(ctx, helpText, ctx.msgId);
});

bot.on(":text", async (ctx) => {
  // Special command to return chat history as JSON
  if (ctx.message?.text === "-his" && ctx.message?.reply_to_message) {
    try {
      const originalMsgId = ctx.message.reply_to_message.message_id;
      const messagesResult = await getGoogleChat(originalMsgId);

      if (messagesResult.value && messagesResult.value.length > 0) {
        const historyJson = JSON.stringify(messagesResult.value, null, 2);
        await ctx.reply("```json\n" + historyJson + "\n```", {
          reply_parameters: { message_id: ctx.msgId },
          parse_mode: "MarkdownV2",
        });
        return;
      } else {
        await ctx.reply("No chat history found for this conversation", {
          reply_parameters: { message_id: ctx.msgId },
        });
        return;
      }
    } catch (error) {
      console.error("Error retrieving chat history:", error);
      await ctx.reply(
        `Failed to retrieve chat history: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          reply_parameters: { message_id: ctx.msgId },
        },
      );
      return;
    }
  }

  if (
    ctx.message?.reply_to_message &&
    !ctx.message.reply_to_message.photo &&
    ctx.message.reply_to_message.from?.id === bot.botInfo.id
  ) {
    try {
      // Set up the linked-list relation for both regular and Google conversations
      await setReply(ctx.message.reply_to_message.message_id, ctx.msgId);
      await setGoogleReply(ctx.message.reply_to_message.message_id, ctx.msgId);

      googleReply(ctx.msgId, ctx.message.text)
        .then(async (response) => {
          const reply = await send(ctx, response, ctx.msgId);
          // Link the new reply in both systems
          await setReply(ctx.msgId, reply.message_id);
          await setGoogleReply(ctx.msgId, reply.message_id);
        })
        .catch(async (error) => {
          await ctx.reply(
            `Error: ${error instanceof Error ? error.message : "Unknown error"
            }`,
            {
              reply_parameters: { message_id: ctx.msgId },
            },
          );
        });
    } catch (error) {
      console.error("Error in text message handling:", error);
      await ctx.reply(
        `Failed to process message: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          reply_parameters: { message_id: ctx.msgId },
        },
      );
    }
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
