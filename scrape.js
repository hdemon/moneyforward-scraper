const puppeteer = require('puppeteer');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const package = require('./package.json');

let browser, page;

const initializeBrowser = async () =>
  await puppeteer.launch();

const login = async () => {
  page = await browser.newPage();
  await page.goto('https://moneyforward.com/users/sign_in');
  await page.type('#sign_in_session_service_email', process.argv[2] || process.env.MONEYFORWARD_ID);
  await page.type('#sign_in_session_service_password', process.argv[3] || process.env.MONEYFORWARD_PASSWORD);
  await page.click('#login-btn-sumit');
  await page.waitForSelector('#header-container > header > div.global-menu > ul > li:nth-child(2) > a');
  await page.click('#header-container > header > div.global-menu > ul > li:nth-child(2) > a');
};

const scrapeProtfolioPage = async () => {
  await page.goto('https://moneyforward.com/bs/portfolio');
  const html = await page.$eval('html', e => e.outerHTML);
  return html;
};

const scrapeTopPage = async () => {
  await page.goto('https://moneyforward.com/');
  const html = await page.$eval('html', e => e.outerHTML);
  return html;
};

const scrapeLiabilitiesPage = async () => {
  await page.goto('https://moneyforward.com/bs/liability');
  const html = await page.$eval('html', e => e.outerHTML);
  return html;
};

const getCurrency = (current_price) =>
  current_price.includes('.') ? 'doller' : 'yen';

const convertToCurrencyType = (string) =>
  Number(string.replace(/[\u4E00-\u9FFF]|\,/g, '')); // eliminate all kanji

const parseProtfolioPage = (html) => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const stocks = Array.from(document.querySelectorAll('#portfolio_det_eq > table tbody tr')).map(stock => {
    const cells = Array.from(stock.querySelectorAll('td'));
    const currency = getCurrency(cells[4].innerHTML);
    return {
      name: cells[0].innerHTML,
      number: Number(cells[2].innerHTML),
      average_acquisition_price: {
        value: convertToCurrencyType(cells[3].innerHTML),
        currency: getCurrency(cells[3].innerHTML),
      },
      current_price: {
        value: convertToCurrencyType(cells[4].innerHTML),
        currency: getCurrency(cells[4].innerHTML),
      },
      assessed_value: {
        value: convertToCurrencyType(cells[5].innerHTML),
        currency: getCurrency(cells[5].innerHTML),
      },
      broker: cells[9].innerHTML,
    }
  });

  const investments = Array.from(document.querySelectorAll('#portfolio_det_mf > table tbody tr')).map(stock => {
    const cells = Array.from(stock.querySelectorAll('td'));
    const currency = getCurrency(cells[3].innerHTML);
    return {
      name: cells[0].innerHTML,
      number: Number(cells[1].innerHTML),
      average_acquisition_price: {
        value: convertToCurrencyType(cells[2].innerHTML),
        currency: getCurrency(cells[2].innerHTML),
      },
      current_price: {
        value: convertToCurrencyType(cells[3].innerHTML),
        currency: getCurrency(cells[3].innerHTML),
      },
      assessed_value: {
        value: convertToCurrencyType(cells[4].innerHTML),
        currency: getCurrency(cells[4].innerHTML),
      },
      broker: cells[8].innerHTML,
    }
  });

  return [...stocks, ...investments];
};

const parseTopPage = (html) => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const cashes = Array.from(document.querySelectorAll('#registered-accounts > ul > li.account')).map(cash => {
    const value = cash.querySelector('.number') ? cash.querySelector('.number').innerHTML : null;
    return {
      name: cash.querySelector('a:nth-child(1)').innerHTML,
      value: value ? convertToCurrencyType(value) : null,
      currency: value ? getCurrency(value) : null,
    };
  });

  return cashes;
}

const parseLiabilitiesPage = (html) => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const liabilities = Array.from(document.querySelectorAll('#liability_det > section > section > table tbody tr')).map(liability => {
    const value = liability.querySelector('.number') ? liability.querySelector('.number').innerHTML : null;
    return {
      name: liability.querySelectorAll('td')[3].innerHTML,
      value: value ? convertToCurrencyType(value) : null,
      currency: value ? getCurrency(value) : null,
    };
  });

  return liabilities;
}


(async () => {
  if (!process.env.MONEYFORWARD_ID || !process.env.MONEYFORWARD_PASSWORD) {
    console.error('MONNEYFORWARD_ID or MONEYFORWARD_PASSWORD are missing.')
  }
  browser = await initializeBrowser();
  await login();
  const data = {
    version: package.version,
    cash: parseTopPage(await scrapeTopPage()),
    properties: parseProtfolioPage(await scrapeProtfolioPage()),
    liabilities: parseLiabilitiesPage(await scrapeLiabilitiesPage()),
  }
  browser.close();
  console.log(data);
})().catch(async (err) => {
  console.error(err);
  console.error(`---`)
  console.error(await page.$eval('html', e => e.outerHTML));
  await page.screenshot({ path: 'error.png' });
  await browser.close();
}); 
