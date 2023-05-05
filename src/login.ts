import puppeteer, { Browser, Page } from "puppeteer";

export default async function login(): Promise<{
  page: Page;
  browser: Browser;
}> {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox"],
  });
  const [page] = await browser.pages();
  await page.setViewport({
    width: 1200,
    height: 800,
  });

  await page.goto("https://twitter.com/login");

  // Login
  const usernameField = '[autocomplete="username"][name="text"][type="text"]';
  await page.waitForSelector(usernameField, { timeout: 10000 });
  await page.type(usernameField, process.env.USERNAME!, { delay: 20 });
  await page.click(
    '[class="css-18t94o4 css-1dbjc4n r-sdzlij r-1phboty r-rs99b7 r-ywje51 r-usiww2 r-2yi16 r-1qi8awa r-1ny4l3l r-ymttw5 r-o7ynqc r-6416eg r-lrvibr r-13qz1uu"]'
  );
  const passwordField = '[name="password"]';
  await page.waitForSelector(passwordField, { timeout: 10000 });
  await page.type(passwordField, process.env.PASSWORD!, { delay: 20 });
  await page.click('[data-testid="LoginForm_Login_Button"]');
  await page.waitForNavigation();

  return { page, browser };
}
