import * as dotenv from "dotenv";
import * as puppeteer from "puppeteer";
import config from "./config.json";
import fs from "fs";
import login from "./login";

const { username, minLikes } = config;
dotenv.config();

main();

async function main() {
  const { page, browser } = await login();

  // search
  await page.goto(
    `https://twitter.com/search?f=live&q=(from%3A${username})%20min_faves%3A${minLikes}%20-filter%3Areplies&src=typed_query`,
    {
      waitUntil: "load",
      timeout: 10000,
    }
  );

  type TweetData = { tweets: string[] };

  let cachedTweets: string[];
  try {
    cachedTweets = JSON.parse(
      fs.readFileSync(`./tweets_${username}.json`, "utf8")
    ) as string[];
  } catch {
    cachedTweets = [];
  }

  const tweets = new Set<String>(cachedTweets);

  // find all tweets
  let newTweets = 0;
  let noNewTweetsCount = 0;
  while (noNewTweetsCount <= 10) {
    const tweetObject = await page.evaluate(async (): Promise<TweetData> => {
      const tweets = document.querySelectorAll(
        'div [data-testid="tweet"] > div > div > div > div > div > div[data-testid="tweetText"]'
      );
      window.scrollBy(0, 1000);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      return {
        tweets: Array.from(tweets).map((tweet) => tweet.textContent ?? ""),
      };
    });
    for (const tweet of tweetObject.tweets) {
      if (!tweets.has(tweet)) {
        newTweets++;
        noNewTweetsCount = 0;
        console.log(tweet);
        tweets.add(tweet);
      }
    }
    noNewTweetsCount++;
  }

  // finish
  await browser.close();
  fs.writeFileSync(
    `./tweets_${username}.json`,
    JSON.stringify([...tweets], null, 2)
  );
  console.log(
    `Found ${tweets.size} (${newTweets} new) tweets from @${username}`
  );
}
