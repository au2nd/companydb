const playwright = require('playwright'),
  chalk = require('chalk'),
  prompt = require('prompt')

const { clearTerminal } = require('./helpers/cli')
const { LOGO } = require('./constants')

prompt.message = '' // 앞에 오는 메시지 제거

/**
 * @typedef {Object} Credentials
 * @property {string} emailOrPhone - The user's login ID.
 * @property {string} password - The user's login password.
 */

/**
 * Launches the browser, logs in, and retrieves company details.
 *
 * @param {Credentials} credentials - The login information.
 * @returns {Promise<void>} A Promise that resolves when the process is complete.
 */
const bootstrap = async () => {
  clearTerminal()
  console.log(chalk.white(LOGO))

  let browser, context, page

  try {
    browser = await playwright.chromium.launch({})

    context = await browser.newContext({
      locale: 'ko-KR',
      extraHTTPHeaders: {
        'accept-language': 'ko,en-US;q=0.9,en;q=0.8,ko-KR;q=0.7,ro;q=0.6,vi;q=0.5'
      }
    })

    page = await context.newPage()

    // 로그인
    // TODO: 실패 시 처리
    console.log(chalk.green('[로그인 정보를 입력하세요]\n'))

    prompt.start()
    const input = await prompt.get([
      {
        properties: {
          emailOrPhone: { message: '휴대전화 번호 혹은 이메일' }
        }
      },
      {
        properties: {
          password: { message: '비밀번호', replace: '*', hidden: true }
        }
      }
    ])
    await auth(page, { ...input })
    clearTerminal()

    let currentPage = 1
    while (true) {
      try {
        const { data, hasNext } = await getCompanyList(page, currentPage)
        if (!hasNext) {
          break
        }

        clearTerminal()
        console.log(chalk.green(`${currentPage} 페이지 작업 중 ...`))
        for (const searchedCompany of data) {
          try {
            const detail = await getCompanyDetail(page, searchedCompany.link)
            console.log(chalk.blue(`\n⌙ 회사명: ${detail.name}`))
            console.log(chalk.blue(`  ⌙ 이메일: ${detail.email}`))
            console.log(chalk.blue(`  ⌙ 연락처: ${detail.phone}`))
          } catch (error) {
            console.error(chalk.red(`Error getting company detail: ${error?.message}`))
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error getting company list: ${error?.message}`))
      }

      currentPage++
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error?.message}`))
  } finally {
    await page.close()
    await context.close()
    await browser.close()
  }
}

/**
 * Logs in using the provided credentials.
 *
 * @param {playwright.Page} page - The Playwright Page object.
 * @param {Credentials} credentials - The login credentials.
 * @returns {Promise<void>} A Promise that resolves when the authentication is complete.
 */
const auth = async (page, credentials) => {
  try {
    await page.goto('https://www.rocketpunch.com/login')

    await page.fill('#id-login-email', credentials.emailOrPhone)
    await page.fill('#id-login-password', credentials.password)
    await page.click("button[type='submit']")

    await page.waitForNavigation()
  } catch (error) {
    console.error(chalk.red(`Auth error: ${error?.message}`))
    throw error
  }
}

/**
 * Retrieves a list of companies from a specific page number.
 *
 * @param {playwright.Page} page - The Playwright Page object.
 * @param {number} [pageNumber=1] - The page number to retrieve.
 * @returns {Promise<{ data: Array<{ name: string, link: string }>, hasNext: boolean }>} A Promise containing the company data and hasNext flag.
 */
const getCompanyList = async (page, pageNumber = 1) => {
  try {
    await page.goto(`https://www.rocketpunch.com/companies?page=${pageNumber}`)
    await page.waitForSelector('.company-list .company.item')

    const companyElements = await page.$$('.company-list .company.item')

    if (companyElements.length === 0) {
      console.log(chalk.yellow(`No company items found on page ${pageNumber}.`))
      return { data: [], hasNext: false }
    }

    const companies = await page.$$eval('.company-list .company.item', (es) =>
      es.map((e) => ({
        name: e.querySelector('.header.name').textContent?.trim(),
        link: e.querySelector('.link').href?.trim()
      }))
    )

    const hasNext = await page.$eval(
      '#pagination-wrapper > div > a:nth-child(4)',
      (e) => e !== null
    )

    return { data: companies, hasNext }
  } catch (error) {
    console.error(chalk.red(`Error getting company list: ${error?.message}`))
    throw error // Rethrow the error to be caught by the caller
  }
}

/**
 * Retrieves detailed information about a company.
 *
 * @param {playwright.Page} page - The Playwright Page object.
 * @param {string} link - The link to the company's page.
 * @returns {Promise<{ name: string }>} A Promise containing the company's detailed information.
 */
const getCompanyDetail = async (page, link) => {
  try {
    await page.goto(link, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('div.company-main')

    const detail = await page.$eval('div.pusher', (e) => ({
      name: e.querySelector('#company-name > h1')?.textContent?.trim(),
      description: e.querySelector('#company-description')?.textContent?.trim() ?? '',
      email: e.querySelector('#company-email')?.textContent?.trim() ?? '',
      phone: e.querySelector('#company-phone')?.textContent?.trim() ?? ''
    }))

    return detail
  } catch (error) {
    console.error(chalk.red(`Error getting company detail: ${error?.message}`))
    throw error // Rethrow the error to be caught by the caller
  }
}

bootstrap().catch((error) => console.error(chalk.red(`error: ${error?.message}`)))
