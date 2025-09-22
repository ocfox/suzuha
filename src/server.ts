import {
  Bot,
  Context,
  webhookCallback,
} from "https://deno.land/x/grammy@v1.34.1/mod.ts";

import telegramifyMarkdown from 'telegramify-markdown';

import { groqChat, groqTranslate, whisper } from "./groq.ts";
import { setGoogleReply, setReply } from "./kv.ts";
import { getGoogleChat, googleChatWrapper, googleReply } from "./aistudio.ts";
import { dict } from "./dict.ts";
import { fluxImage, StableDiffusionXLImg2Img } from "./huggingface.ts";
import { InputFile } from "https://deno.land/x/grammy@v1.34.1/types.deno.ts";
import {
  hydrateReply,
  parseMode,
} from "https://deno.land/x/grammy_parse_mode@1.11.1/mod.ts";
import type { ParseModeFlavor } from "https://deno.land/x/grammy_parse_mode@1.11.1/mod.ts";

const bot = new Bot<ParseModeFlavor<Context>>(Deno.env.get("BOT_TOKEN") || "");

bot.use(hydrateReply);

// Set the default parse mode for ctx.reply.
// bot.api.config.use(parseMode("MarkdownV2"));

// Helper function to send messages with markdown and fallback to plain text
const sendWithMarkdown = async (
  ctx: Context,
  text: string,
  replyToMessageId: number,
) => {
  try {
    // First try to send with Markdown formatting
    const reply = await ctx.reply(telegramifyMarkdown(text, "escape"), {
      reply_parameters: { message_id: replyToMessageId },
      parse_mode: "MarkdownV2",
    });
    return reply;
  } catch (error) {
    console.log(
      "Markdown formatting error, falling back to plain text:",
      error,
    );
    // If Markdown fails, fall back to plain text
    const reply = await ctx.reply(telegramifyMarkdown(text, "remove"), {
      reply_parameters: { message_id: replyToMessageId },
      parse_mode: undefined, // No parsing
    });
    return reply;
  }
};

const getFile = async (ctx: Context, fileId: string) => {
  const file = await ctx.api.getFile(fileId);
  const response = await fetch(
    `https://api.telegram.org/file/bot${
      Deno.env.get("BOT_TOKEN")
    }/${file.file_path}`,
  );
  return response.blob();
};

bot.command("chat", (ctx) => {
  const prompt = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!prompt) {
    return ctx.reply(dict.zh.empty);
  }

  googleChatWrapper(ctx.msgId, prompt)
    .then(async (response) => {
      const reply = await sendWithMarkdown(ctx, response, ctx.msgId);
      // Link both ways - standard and Google chat linking
      await setReply(ctx.msgId, reply.message_id);
      // This ensures that when someone replies to the bot's response,
      // it can find the original message that started the conversation
      await setGoogleReply(ctx.msgId, reply.message_id);
    })
    .catch(async (error) => {
      await ctx.reply(
        `Failed to process chat: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          reply_parameters: { message_id: ctx.msgId },
        },
      );
    });
});

bot.command("what", (ctx) => {
  if (!ctx.message?.reply_to_message || !ctx.message.reply_to_message.text) {
    return ctx.reply("Please reply to a message to ask what it means");
  }
  const prompt = ctx.message.reply_to_message.text + "\n" + dict.zh.what;

  groqChat(ctx.msgId, prompt)
    .then(async (response) => {
      await sendWithMarkdown(ctx, response, ctx.msgId);
    })
    .catch(async (error) => {
      await ctx.reply(
        `Failed to process request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          reply_parameters: { message_id: ctx.msgId },
        },
      );
    });
});

bot.command("why", async (ctx) => {
  if (!ctx.message?.reply_to_message || !ctx.message.reply_to_message.text) {
    return ctx.reply("Please reply to a message to ask why");
  }
  const prompt = dict.zh.why + ctx.message.reply_to_message.text + "?";

  try {
    const response = await groqChat(ctx.msgId, prompt);
    await sendWithMarkdown(ctx, response, ctx.msgId);
  } catch (error) {
    await ctx.reply(
      `Failed to process request: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      {
        reply_parameters: { message_id: ctx.msgId },
      },
    );
  }
});

bot.command("ah", (ctx) => {
  if (!ctx.message?.reply_to_message || !ctx.message.reply_to_message.text) {
    return ctx.reply("Please reply to a message to use this command");
  }
  const question = ctx.message.reply_to_message.text;
  let prompt = question;

  if (question.endsWith("吧")) {
    prompt = question.slice(0, -1) + "吗?";
  } else if (!question.endsWith("?") && !question.endsWith("？")) {
    prompt = question + "?";
  }

  groqChat(ctx.msgId, prompt)
    .then(async (response) => {
      await sendWithMarkdown(ctx, response, ctx.msgId);
    })
    .catch(async (error) => {
      await ctx.reply(
        `Failed to process request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          reply_parameters: { message_id: ctx.msgId },
        },
      );
    });
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
      `Failed to generate image: ${
        error instanceof Error ? error.message : "Unknown error"
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
      `Failed to process image: ${
        error instanceof Error ? error.message : "Unknown error"
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

    await sendWithMarkdown(ctx, text, ctx.msgId);
  } catch (error) {
    await ctx.reply(
      `Failed to transcribe audio: ${
        error instanceof Error ? error.message : "Unknown error"
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
      await sendWithMarkdown(ctx, response, ctx.msgId);
    })
    .catch(async (error) => {
      await ctx.reply(
        `Translation error: ${
          error instanceof Error ? error.message : "Unknown error"
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

  sendWithMarkdown(ctx, helpText, ctx.msgId);
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
        `Failed to retrieve chat history: ${
          error instanceof Error ? error.message : "Unknown error"
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
          const reply = await sendWithMarkdown(ctx, response, ctx.msgId);
          // Link the new reply in both systems
          await setReply(ctx.msgId, reply.message_id);
          await setGoogleReply(ctx.msgId, reply.message_id);
        })
        .catch(async (error) => {
          await ctx.reply(
            `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            {
              reply_parameters: { message_id: ctx.msgId },
            },
          );
        });
    } catch (error) {
      console.error("Error in text message handling:", error);
      await ctx.reply(
        `Failed to process message: ${
          error instanceof Error ? error.message : "Unknown error"
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
