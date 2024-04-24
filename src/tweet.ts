import * as dotenv from "dotenv";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import yargs from "yargs";
import { generateTweet } from "./generate";

dotenv.config();

const argv = yargs
  .option("username", {
    alias: "U",
    description: "The username of the account to collect tweets from",
    type: "string",
    demandOption: true,
  })
  .option("send", {
    alias: "S",
    description: "Whether to not actually tweet",
    type: "boolean",
    default: false,
  })
  .option("webhook", {
    alias: "W",
    description: "The webhook to send the tweet to",
    type: "string",
  })
  .help()
  .alias("help", "h").argv;

const twitter = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
}).v2;

// @ts-expect-error
const username = argv.username as string;
// @ts-expect-error
const shouldSend = argv.send as boolean;
// @ts-expect-error
const webhookURL = argv.webhook as string | undefined;

main();

async function main() {
  const { tweets } = JSON.parse(
    fs.readFileSync(`./collection/tweets_${username}.json`, "utf8")
  ) as {
    firstDate: string | undefined;
    tweets: string[] | undefined;
  };
  if (!tweets) throw new Error("No tweets found");

  const { tweet, log } = await generateTweet(username, tweets);

  if (shouldSend) {
    await twitter.tweet(tweet);
    fs.writeFileSync(
      `./logs/tweet_${username}_${new Date()
        .toISOString()
        .replace(/\.|:/g, "-")}.json`,
      JSON.stringify(log, null, 2)
    );
  } else {
    console.log(tweet, log);
  }

  if (webhookURL) {
    await fetch(webhookURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: [
          `<t:${Math.floor(Date.now() / 1000)}:f>`,
          "```json",
          JSON.stringify(log.input, null, 2),
          "```",
          tweet,
        ]
          .join("\n")
          .substring(0, 2000),
      }),
    })
      .then((res) => res.text())
      .then(console.log)
      .catch(console.error);
  }
}
