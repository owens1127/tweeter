import * as dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import config from "./config.json";

const { username } = config;
dotenv.config();

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_SECRET,
  })
);

main();

async function main() {
  const tweet = await generateTweet();
  await new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
  }).v2.tweet(tweet);
}

async function generateTweet() {
  const tweets = (
    JSON.parse(fs.readFileSync(`./tweets_${username}.json`, "utf8")) as string[]
  )
    .filter((tweet) => !tweet.includes("http"))
    .map((tweet) => tweet.replace("\n", " "))
    .map((tweet) => tweet.replace(/\s{2,}/g, " "));

  let indices = new Set<number>();
  let selectedTweets = new Set<string>();

  const payloadSize = () =>
    [...selectedTweets].reduce(
      (size, tweet) => size + tweet.split(" ").length + 2,
      50
    );

  while (indices.size < 20 && payloadSize() < 3300) {
    const rand = Math.floor(Math.random() * tweets.length);
    if (indices.has(rand)) continue;
    else {
      indices.add(rand);
      selectedTweets.add(tweets[rand]);
    }
  }

  const prompt = [...selectedTweets].join("\n\n");

  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `You are a machine-learning model trying to emulate the tweets from ${username}. Here are ${username}'s recent tweets:`,
      },
      {
        role: "user",
        content: prompt,
      },
      {
        role: "user",
        content: `Please generate 1 new short tweet based on the writing-style, language, emotion, and topics in those tweets`,
      },
    ],
  });

  const newTweet = completion.data.choices[0]
    .message!.content.replace(/#\w+\s?/g, "")
    .replace("#", "")
    .trim();
  console.log(newTweet);

  return newTweet;
}
