import * as dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import fs from "fs";
import config from "./config.json";
import login from "./login";

const { username } = config;
dotenv.config();

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_SECRET,
  })
);

main();

async function main() {
  const tweet = generateTweet();
  const { page, browser } = await login();

  await page.goto("https://twitter.com/home");

  const tweetTextArea = '[data-testid="tweetTextarea_0"]';
  await page.waitForSelector(tweetTextArea, { timeout: 10000 });
  await page.type(tweetTextArea, await tweet, { delay: 50 });
  await page.click('[data-testid="tweetButtonInline"]');

  // finish
  await browser.close();
}

async function generateTweet() {
  const tweets = (
    JSON.parse(fs.readFileSync(`./tweets_${username}.json`, "utf8")) as string[]
  )
    .filter((tweet) => !tweet.includes("http"))
    .map((tweet) => tweet.replace(/\s{2,}/g, " "));

  let indices = new Set<number>();
  let selectedTweets = new Set<string>();

  const prefix = `Act as a user who has sent the following list of tweets and write a new tweet as if you were that user:\n`;

  const payloadSize = () =>
    [...selectedTweets].reduce(
      (size, tweet) => size + tweet.split(" ").length + 4,
      prefix.split(" ").length
    );

  while (indices.size < tweets.length && payloadSize() < 2048) {
    const rand = Math.floor(Math.random() * tweets.length);
    if (indices.has(rand)) continue;
    else {
      indices.add(rand);
      selectedTweets.add(tweets[rand]);
    }
  }

  const prompt = prefix + [...selectedTweets].join("\n\n");

  const completion = await openai.createCompletion({
    model: "text-davinci-002",
    prompt,
    max_tokens: 40,
    n: 1,
  });
  const newTweet = completion.data.choices[0]
    .text!.trim()
    .split("\n")
    .find((line) => line !== "" && line.length > 10)!;
  return newTweet;
}
