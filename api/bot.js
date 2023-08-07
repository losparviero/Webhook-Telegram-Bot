#!/usr/bin/env node

/*!
 * Webhook Telegram Bot
 * Copyright (c) 2023
 *
 * @author Zubin
 * @username (GitHub) losparviero
 * @license AGPL-3.0
 */

// Add env vars as a preliminary

require("dotenv").config();
const { Bot, webhookCallback, GrammyError, HttpError } = require("grammy");
const https = require("https");

// Bot

const bot = new Bot(process.env.BOT_TOKEN);

// Concurrency

function getSessionKey(ctx) {
  return ctx.chat?.id.toString();
}

// Plugins

bot.use(sequentialize(getSessionKey));
bot.use(session({ getSessionKey }));
bot.use(responseTime);
bot.use(log);

// Response

async function responseTime(ctx, next) {
  const before = Date.now();
  await next();
  const after = Date.now();
  console.log(`Response time: ${after - before} ms`);
}

// Log

async function log(ctx, next) {
  const from = ctx.from;
  const name =
    from.last_name === undefined
      ? from.first_name
      : `${from.first_name} ${from.last_name}`;
  console.log(
    `From: ${name} (@${from.username}) ID: ${from.id}\nMessage: ${ctx.message.text}`
  );

  await next();
}

// Commands

bot.command("start", async (ctx) => {
  await ctx
    .reply(
      "*Welcome!* ✨\n_You can set or delete Telegram webhooks with this bot._\n\n*Here are the steps to set webhook:*\n_1. Use the /set command.\n2. Format the message like this\n/set <bot token> <webhook url>_\n\n*Here are the steps to delete webhook:*\n\n_1. Use the /del command.\n2. Format the message like this\n/del <bot token> <wehook url>_",
      {
        parse_mode: "Markdown",
      }
    )
    .then(console.log("New user added:\n", ctx.from));
});

bot.command("help", async (ctx) => {
  await ctx
    .reply(
      "*@anzubo Project.*\n\n_This is a bot for utilising webhooks for your Telegram bot projects._",
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.from.id));
});

// List

bot.command("list", async (ctx) => {
  await ctx
    .reply(
      `*Here are the commands available:*\n\n_/start Start the bot\n/help Know more\n/set <token> <url>\n/del <token> <url>_`,
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.from.id));
});

// Set

bot.command("set", async (ctx) => {
  const input = ctx.msg.text;
  const regex = /^\/set\s+(\S+)\s+(\S+)/;
  const matches = input.match(regex);
  if (!matches) {
    console.log("Invalid input format");
  } else {
    const botToken = matches[1];
    const hookUrl = matches[2];
    const webhookUrl =
      "https://api.telegram.org/bot" + botToken + "/setWebhook";

    const data = JSON.stringify({ url: hookUrl });
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };
    const response = await new Promise((resolve, reject) => {
      const req = https.request(webhookUrl, options, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(body),
          });
        });
      });
      req.on("error", (error) => {
        reject(error);
      });
      req.write(data);
      req.end();
    });
    if (response.body.result) {
      await ctx.reply(
        `*Webhook was set successfully.*\n_Message from Telegram:_ ${response.body.description}.`,
        {
          parse_mode: "Markdown",
        }
      );
      console.log(response.body);
    } else {
      await ctx.reply(
        `*Webhook couldn't be set. Error:* ${response.body.description}`,
        { parse_mode: "Markdown" }
      );
    }
  }
});

// Delete

bot.command("del", async (ctx) => {
  const input = ctx.msg.text;
  const regex = /^\/del\s+(\S+)\s+(\S+)/;
  const matches = input.match(regex);
  if (!matches) {
    console.log("Invalid input format");
  } else {
    const botToken = matches[1];
    const hookUrl = matches[2];
    const webhookUrl =
      "https://api.telegram.org/bot" + botToken + "/deleteWebhook";

    const data = JSON.stringify({ url: hookUrl });
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };
    const response = await new Promise((resolve, reject) => {
      const req = https.request(webhookUrl, options, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(body),
          });
        });
      });
      req.on("error", (error) => {
        reject(error);
      });
      req.write(data);
      req.end();
    });
    if (response.body.result) {
      await ctx.reply(
        `*Webhook was deleted successfully.*\n_Message from Telegram:_ ${response.body.description}.`,
        {
          parse_mode: "Markdown",
        }
      );
      console.log(response.body);
    } else {
      await ctx.reply(
        `*Webhook couldn't be deleted. Error:* ${response.body.description}`,
        { parse_mode: "Markdown" }
      );
    }
  }
});

// Messages

bot.on("message:text", async (ctx) => {
  const statusMessage = await ctx.reply(
    `*Wrong format. You have to use the /set or /del commands.\nFor a full list of commands tap on /list.*`,
    {
      parse_mode: "Markdown",
    }
  );
  async function deleteMessageWithDelay(fromId, messageId, delayMs) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        bot.api
          .deleteMessage(fromId, messageId)
          .then(() => resolve())
          .catch((error) => reject(error));
      }, delayMs);
    });
  }
  await deleteMessageWithDelay(ctx.from.id, statusMessage.message_id, 5000);
});

// Error

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(
    "Error while handling update",
    ctx.update.update_id,
    "\nQuery:",
    ctx.msg.text
  );
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
    if (e.description === "Forbidden: bot was blocked by the user") {
      console.log("Bot was blocked by the user");
    } else {
      ctx.reply("An error occurred");
    }
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// Run

export default webhookCallback(bot, "http");
