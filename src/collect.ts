import * as dotenv from "dotenv";
import config from "./config.json";
import fs from "fs";
import login from "./login";
import puppeteer from "puppeteer";
import yargs from "yargs";

const argv = yargs
  .option("username", {
    alias: "U",
    description: "The username of the account to collect tweets from",
    type: "string",
    demandOption: true,
  })
  .option("headless", {
    alias: "H",
    description: "Run in headless mode",
    type: "boolean",
  })
  .help()
  .alias("help", "h").argv;

const { minLikes } = config;
dotenv.config();

main();

async function main() {
  // @ts-expect-error
  const username = argv.username as string;
  const browser = await puppeteer.launch({
    // @ts-ignore
    headless: argv.headless ? "new" : false,
    args: ["--no-sandbox"],
  });
  const [page] = await browser.pages();
  await page.setViewport({
    width: 1200,
    height: 800,
  });

  await login(page);

  let cachedTweets: string[] = [];
  let since: Date | null = null;
  try {
    const fromFile = JSON.parse(
      fs.readFileSync(`./collection/tweets_${username}.json`, "utf8")
    ) as {
      firstDate: string;
      tweets: string[];
    };
    cachedTweets = fromFile.tweets;
    since = new Date(fromFile.firstDate);
  } catch {}

  const tweets = new Set<String>(cachedTweets);

  // search
  const url = new URL("/search", "https://twitter.com");
  url.searchParams.set("f", "live");
  url.searchParams.set(
    "q",
    `(from:${username}) min_faves:${minLikes} -filter:replies${
      since ? ` since:${since.toISOString().split("T")[0]}` : ""
    }`
  );
  url.searchParams.set("src", "typed_query");

  await page.goto(url.toString(), {
    waitUntil: "load",
    timeout: 10000,
  });

  // find all tweets
  let newTweets = 0;
  let noNewTweetsCount = 0;
  while (noNewTweetsCount <= 10) {
    const tweetObject = await page.evaluate(
      async (): Promise<{ tweets: string[] }> => {
        const tweets = document.querySelectorAll(
          'div [data-testid="tweet"] > div > div > div > div > div > div[data-testid="tweetText"]'
        );
        window.scrollBy(0, 1000);

        await new Promise<void>((resolve) => setTimeout(resolve, 500));

        return {
          tweets: Array.from(tweets).map((tweet) => tweet.textContent ?? ""),
        };
      }
    );

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
    `./collection/tweets_${username}.json`,
    JSON.stringify(
      {
        firstDate: new Date().toISOString(),
        tweets: [...tweets],
      },
      null,
      2
    )
  );
  console.log(`Found ${newTweets} new tweets from @${username}`);
}
