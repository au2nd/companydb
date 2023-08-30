const playwright = require('playwright'),
  chalk = require('chalk'),
  prompt = require('prompt')

const { clearTerminal } = require('./helpers/cli')
const { LOGO } = require('./constants')
const { saveJSONToCSV } = require('./helpers')

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

    // 로그인
    // TODO: 실패 시 처리
    console.log(chalk.green('로그인 정보를 입력하세요 ...\n'))

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
    await auth(context, { ...input })
    clearTerminal()

    const companyList = []

    let currentPage = 1
    const MAX_CONCURRENT_REQUESTS = 5 // Set the maximum number of concurrent requests

    while (true) {
      try {
        const { data, hasNext } = await getCompanyList(context, currentPage)

        if (!hasNext || data.length === 0) {
          break
        }

        clearTerminal()
        console.log(`\n\n⌙ ${currentPage} 페이지에서 ${data.length}개의 회사 정보를 수집 중 ...`)

        const detailPromises = data.map(async (searchedCompany) => {
          try {
            const detail = await getCompanyDetail(context, searchedCompany.link)

            console.log(chalk.blue(`\n⌙ 회사명: ${detail.name}`))
            console.log(chalk.blue(`  ⌙ 이메일: ${detail.email}`))
            console.log(chalk.blue(`  ⌙ 연락처: ${detail.phone}`))

            return detail
          } catch (error) {
            // Handle error
          }
        })

        // Process detail pages in parallel with a limited concurrency
        const companyDetails = await Promise.map(detailPromises, async (promise) => await promise, {
          concurrency: MAX_CONCURRENT_REQUESTS
        })

        // Add company details to the result list
        companyList.push(...companyDetails)
      } catch (error) {
        // Handle error
      }

      currentPage++
    }

    clearTerminal()
    console.log(
      chalk.green(
        `\n\n✅ 작업이 완료되었습니다. 총 ${page}개의 페이지에서 ${companyList.length}개의 회사 정보를 수집했습니다.`
      )
    )

    saveJSONToCSV(companyList, 'companies.csv')

    console.log(chalk.green(`\n✅ CSV 파일로 저장되었습니다.`))
  } catch (error) {
    console.error(chalk.red(`Error: ${error?.message}`))
  } finally {
    await page?.close()
    await context?.close()
    await browser?.close()
  }
}

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

    await page.goto('https://www.rocketpunch.com/login')

    await page.fill('#id-login-email', credentials.emailOrPhone)
    await page.fill('#id-login-password', credentials.password)
    await page.click("button[type='submit']")

    await page.waitForNavigation()
  } catch (error) {
    console.error(chalk.red(`로그인에 실패하였습니다: ${error?.message}`))
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

    await page.goto(`https://www.rocketpunch.com/companies?page=${pageNumber}`)
    await page.waitForSelector('.company-list .company.item')

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
      chalk.red(`'${page}페이지'의 정보를 가져오는 중 오류가 발생했습니다: ${error?.message}`)
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
 * @param {string} link - The link to the company's page.
 * @returns {Promise<{ name: string }>} A Promise containing the company's detailed information.
 */
const getCompanyDetail = async (context, link) => {
  let page = null

  try {
    page = await context.newPage()

    await page.goto(link)
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
      chalk.red(`'${link}'의 정보를 가져오는 중 오류가 발생했습니다: ${error?.message}`)
    )
    throw error
  } finally {
    await page?.close()
  }
}

bootstrap().catch((error) => console.error(chalk.red(`error: ${error?.message}`)))
