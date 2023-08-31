const playwright = require('playwright'),
  chalk = require('chalk')

/**
 * Logs in using the provided credentials.
 *
 * @param {playwright.BrowserContext} context
 * @param {Credentials} credentials
 * @returns {Promise<void>} A Promise that resolves when the authentication is complete.
 */
const auth = async (context, credentials) => {
  let page = null

  try {
    const page = await context.newPage()

    await page.goto('https://www.rocketpunch.com/login', {})

    await page.fill('#id-login-email', credentials.emailOrPhone)
    await page.fill('#id-login-password', credentials.password)
    await page.click("button[type='submit']")

    await page.waitForNavigation({ timeout: 5000 })
  } catch (error) {
    console.error(chalk.red(`로그인에 실패하였습니다. (아이디와 비밀번호를 확인해주세요)`))
    throw error
  } finally {
    await page?.close()
  }
}

/**
 * Retrieves a list of companies from a specific page number.
 *
 * @param {playwright.BrowserContext} context
 * @param {number} [pageNumber=1] - The page number to retrieve.
 * @returns {Promise<{ data: Array<{ name: string, link: string }>, hasNext: boolean }>} A Promise containing the company data and hasNext flag.
 */
const getCompanyList = async (context, pageNumber = 1) => {
  let page = null

  try {
    page = await context.newPage()

    await page.goto(`https://www.rocketpunch.com/companies?page=${pageNumber}`, {
      waitUntil: 'networkidle'
    })
    await page.waitForSelector('.ui.segment')

    const companyElements = await page.$$('.company-list .company.item')

    if (companyElements.length === 0) {
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
    console.error(
      chalk.red(
        `'${pageNumber} 페이지'의 정보를 가져오는 중 오류가 발생했습니다: ${error?.message}`
      )
    )
    throw error // Rethrow the error to be caught by the caller
  } finally {
    await page?.close()
  }
}

/**
 * Retrieves detailed information about a company.
 *
 * @param {playwright.BrowserContext} context
 * @param {string} companyDetailLink - The link to the company's page.
 * @returns {Promise<{ name: string }>} A Promise containing the company's detailed information.
 */
const getCompanyDetail = async (context, companyDetailLink) => {
  let page = null

  try {
    page = await context.newPage()

    await page.goto(companyDetailLink, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('div.company-main')

    const detail = await page.$eval('div.pusher', (e) => ({
      name: e.querySelector('#company-name > h1')?.textContent?.trim(),
      email: e.querySelector('#company-email')?.textContent?.trim() ?? '',
      phone: e.querySelector('#company-phone')?.textContent?.trim() ?? '',
      description: e.querySelector('#company-description')?.textContent?.trim() ?? ''
    }))

    return detail
  } catch (error) {
    console.error(
      chalk.red(
        `'${companyDetailLink}'의 정보를 가져오는 중 오류가 발생했습니다: ${error?.message}`
      )
    )
    throw error
  } finally {
    await page?.close()
  }
}

module.exports = {
  auth,
  getCompanyList,
  getCompanyDetail
}
