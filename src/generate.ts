import { Configuration, OpenAIApi } from "openai";
import config from "./config.json";
import * as dotenv from "dotenv";

dotenv.config();

const {
  moods,
  adverbs,
  temperature,
  model,
  bannedTopics,
  maxTrainingTweets,
  generatedTweets: n,
  maxTokens,
  lengths
} = config;

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_SECRET,
  })
);

export async function generateTweet(username: string, tweets: string[]) {
  const selectedTweets = await sanitizeTweets(tweets).then(chooseTweets);

  const selectedTweetsString = [...selectedTweets].join("\n\n");
  const adverb = adverbs[Math.floor(Math.random() * adverbs.length)];
  const mood = moods[Math.floor(Math.random() * moods.length)];
  const tweetLength = lengths[Math.floor(Math.random() * lengths.length)];

  const input = {
    user: username,
    adverb,
    mood,
    model,
    temperature,
    tweetLength,
    tweets: [...selectedTweets],
    n,
  };

  const tweetsPromise = await openai.createChatCompletion({
    model: input.model,
    n: input.n,
    temperature: input.temperature,
    messages: [
      {
        role: "system",
        content: `You are a machine-learning model trying to create a new tweet from ${username} given his/her tweeting history. You will be provided with a small sample of ${username}'s recent tweets to begin.`,
      },
      {
        role: "user",
        content: selectedTweetsString,
      },
      {
        role: "user",
        content: `The new tweet should be a blend of specific events and details talked about in the various tweets provided. The new tweet should be unique, so feel free introduce topics and themes inferred to be similat to what ${username} talks about. The new tweet should not include emojis. The new tweet should be ${adverb} ${mood}. The tweet MUST be a ${tweetLength} tweet.`,
      },
    ],
  });

  const output = tweetsPromise.data;
  const choices = output.choices!.map((choice) =>
    choice
      .message!.content!.replace(/#\w+\s?/g, "")
      .replace("#", "")
      .replace(/^"(.*)"$/, "$1")
      .trim()
  );
  const verificationPromise = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    temperature: 0.2,
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

  const ratingsByChoice = verificationPromise.data.choices.map(
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

  const log = { input, choices, avgRatings, tweet };

  return { log, tweet };
}

async function sanitizeTweets(tweets: string[]): Promise<string[]> {
  return tweets.map((tweet) =>
    tweet.replace("\n", " ").replace(/\s{2,}/g, " ")
  );
}

async function chooseTweets(tweets: string[]) {
  const indices = new Set<number>();
  const selectedTweets = new Set<string>();

  const payloadSize = () =>
    [...selectedTweets].reduce(
      (size, tweet) => size + tweet.split(" ").length + 2,
      50
    );

  while (indices.size < maxTrainingTweets && payloadSize() < maxTokens) {
    const rand = Math.floor(Math.random() * tweets.length);
    if (indices.has(rand)) continue;
    else {
      indices.add(rand);
      selectedTweets.add(tweets[rand]);
    }
  }

  return selectedTweets;
}
