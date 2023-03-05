require("dotenv").config();
const { Bot, webhookCallback, GrammyError, HttpError } = require("grammy");
const https = require("https");

// Bot

const bot = new Bot(process.env.BOT_TOKEN);

// Commands

bot.command("start", async (ctx) => {
  await ctx
    .reply(
      "*Welcome!* ✨\n_You can set Telegram webhooks with this bot._\n\n*Here are the steps to set:*\n_1. Use the /setwebhook command.\n2. Format the message like this\n/setwebhook <bot token> <webhook url>_",
      {
        parse_mode: "Markdown",
      }
    )
    .then(console.log("New user added:\n", ctx.from));
});

bot.command("help", async (ctx) => {
  await ctx
    .reply(
      "*@anzubo Project.*\n\n_This is a bot for setting webhooks for your Telegram bot projects._",
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.from.id));
});

// List

bot.command("cmd", async (ctx) => {
  await ctx
    .reply(
      `*Here are the commands available:*\n\n_/start Start the bot\n/help Know more\n/setwebhook <token> <url>_`,
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.from.id));
});

// Webhook

bot.command("setwebhook", async (ctx) => {
  const input = ctx.msg.text;
  const regex = /^\/setwebhook\s+(\S+)\s+(\S+)/;
  const matches = input.match(regex);
  if (!matches) {
    console.log("Invalid input format");
  } else {
    const botToken = matches[1];
    const hookUrl = matches[2];
    const webhookUrl =
      "https://api.telegram.org/bot" + botToken + "/setWebhook";
    try {
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
    } catch (error) {
      console.error(error);
    }
  }
});

// Messages

bot.on("msg", async (ctx) => {
  try {
    const statusMessage = await ctx.reply(
      `*Wrong format. You have to use the /setwebhook command.*`,
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
  } catch (error) {
    if (error instanceof GrammyError) {
      if (error.message.includes("Forbidden: bot was blocked by the user")) {
        console.log("Bot was blocked by the user");
      } else if (error.message.includes("Call to 'sendMessage' failed!")) {
        console.log("Error sending message: ", error);
        await ctx.reply(`*Error contacting Telegram.*`, {
          parse_mode: "Markdown",
          reply_to_message_id: ctx.msg.message_id,
        });
      } else {
        await ctx.reply(`*An error occurred: ${error.message}*`, {
          parse_mode: "Markdown",
          reply_to_message_id: ctx.msg.message_id,
        });
      }
      console.log(`Error sending message: ${error.message}`);
      return;
    } else {
      console.log(`An error occured:`, error);
      await ctx.reply(`*An error occurred.*\n_Error: ${error.message}_`, {
        parse_mode: "Markdown",
        reply_to_message_id: ctx.msg.message_id,
      });
      return;
    }
  }
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
