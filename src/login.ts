import puppeteer, { Browser, Page } from "puppeteer";

export default async function login(page: Page): Promise<void> {
  await page.goto("https://twitter.com/login");

  // Username
  const usernameField = '[autocomplete="username"][name="text"][type="text"]';
  await page.waitForSelector(usernameField, { timeout: 10000 });
  await page.type(usernameField, process.env.USERNAME!, { delay: 20 });

  // Next
  await page.evaluate(() => {
    let spans = Array.from(document.querySelectorAll("span"));
    let nextButton = spans.find((span) => span.textContent === "Next");
    if (nextButton) {
      nextButton.click();
    } else {
      throw new Error("Next button not found");
    }
  });

  // Password
  const passwordField = '[type="password"]';
  await page.waitForSelector(passwordField, { timeout: 10000 });
  await page.type(passwordField, process.env.PASSWORD!, { delay: 20 });
  await page.click('[data-testid="LoginForm_Login_Button"]');

  await page.waitForNavigation();
}
