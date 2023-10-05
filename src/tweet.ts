import * as dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import config from "./config.json";

dotenv.config();

const {
  username,
  moods,
  adverbs,
  temperature,
  model,
  bannedTopics,
  choices: n,
} = config;

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

function processTweets(tweets: string[]): string[] {
  return tweets
    .filter((tweet) => !tweet.includes("http"))
    .map((tweet) => tweet.replace("\n", " "))
    .map((tweet) => tweet.replace(/\s{2,}/g, " "));
}

async function generateTweet() {
  const tweets = processTweets(
    JSON.parse(
      fs.readFileSync(`./collection/tweets_${username}.json`, "utf8")
    ) as string[]
  );

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

  const input = {
    user: username,
    adverb,
    mood,
    model,
    temperature,
    tweets: [...selectedTweets],
    n,
  };

  const tweetsPromise = openai.createChatCompletion({
    model: input.model,
    n: input.n,
    temperature: input.temperature,
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
        content: `Please generate 1 new ${adverb} ${mood} short tweet based on the writing-style, language, emotion, capitalization, and topics in those tweets`,
      },
    ],
  });

  const output = (await tweetsPromise).data;
  const choices = output.choices!.map((choice) =>
    choice
      .message!.content!.replace(/#\w+\s?/g, "")
      .replace("#", "")
      .replace(/^"(.*)"$/, "$1")
      .trim()
  );
  const verificationPromise = openai.createChatCompletion({
    model: input.model,
    temperature: input.temperature / 3,
    n,
    messages: [
      {
        role: "system",
        content: `You will give a score 0-10 for each item based on the criteria in the prompt. You should response with an array of numbers representing the scores.`,
      },
      {
        role: "user",
        content: `Please determine if any of the following messages discuss these topics. Here are the topics: ${bannedTopics}. Please rate each tweet on a scale of 1-10 where 1 is related to any of the topics and 10 is not related at all to any: ${choices}`,
      },
    ],
  });

  const ratingsByChoice = (await verificationPromise).data.choices.map(
    (choice) => JSON.parse(choice.message!.content!) as number[]
  );

  const avgRatings = ratingsByChoice
    .reduce(
      (sum, cv) => sum.map((val, i) => val + cv[i]),
      Array(ratingsByChoice[0].length).fill(0) as number[]
    )
    .map((sum) => sum / ratingsByChoice.length);

  const tweet = choices.filter(
    (_, idx) => avgRatings[idx] >= (1.5 - temperature) / 2
  )[0];

  const log = JSON.stringify({ input, choices, avgRatings, tweet }, null, 2);

  fs.writeFileSync(
    `./logs/tweet_${username}_${new Date()
      .toISOString()
      .replace(/\.|:/g, "-")}.json`,
    log
  );
  console.log(log);

  return tweet;
}
