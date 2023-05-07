import * as dotenv from "dotenv";
import {
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  OpenAIApi,
} from "openai";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import config from "./config.json";

dotenv.config();

const { username, moods, adverbs, temperature } = config;

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_SECRET,
  })
);

const twitter = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
}).v2;

main();

async function main() {
  const tweet = await generateTweet();
  console.log(tweet);
  await twitter.tweet(tweet);
}

async function generateTweet() {
  const tweets = (
    JSON.parse(
      fs.readFileSync(`./collection/tweets_${username}.json`, "utf8")
    ) as string[]
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

  while (indices.size < 50 && payloadSize() < 3300) {
    const rand = Math.floor(Math.random() * tweets.length);
    if (indices.has(rand)) continue;
    else {
      indices.add(rand);
      selectedTweets.add(tweets[rand]);
    }
  }

  const prompt = [...selectedTweets].join("\n\n");
  const adverb = adverbs[Math.floor(Math.random() * adverbs.length)];
  const mood = moods[Math.floor(Math.random() * moods.length)];
  console.log(`Style: ${adverb} ${mood}`);

  const input = {
    user: username,
    tweets: [...selectedTweets],
    adverb,
    mood,
    model: "gpt-3.5-turbo",
    temperature,
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
        content: `Please generate 1 new ${adverb} ${mood} short tweet based on the writing-style, language, emotion, and topics in those tweets`,
      },
    ] as { role: ChatCompletionRequestMessageRoleEnum; content: string }[],
  };

  const completion = await openai.createChatCompletion({
    model: input.model,
    temperature: input.temperature,
    messages: input.messages,
  });

  const output = completion.data;
  const tweet = output.choices[0]
    .message!.content.replace(/#\w+\s?/g, "")
    .replace("#", "")
    .trim();

  const log = JSON.stringify({ input, output, tweet }, null, 2);
  fs.writeFileSync(
    `./logs/tweet_${username}_${new Date().toISOString()}.json`,
    log
  );
  console.log(log);

  return tweet;
}
