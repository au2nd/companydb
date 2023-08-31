const puppeteer = require('puppeteer')
const chalk = require('chalk')

/**
 * Logs in using the provided credentials.
 *
 * @param {puppeteer.BrowserContext} context
 * @param {Credentials} credentials
 * @returns {Promise<void>} A Promise that resolves when the authentication is complete.
 */
const login = async (context, credentials) => {
  let page = null

  try {
    page = await context.newPage()

    await page.goto('https://www.rocketpunch.com/login')

    await page.type('#id-login-email', credentials.emailOrPhone)
    await page.type('#id-login-password', credentials.password)

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
 * @param {puppeteer.BrowserContext} context
 * @param {number} [pageNumber=1] - The page number to retrieve.
 * @returns {Promise<{ data: Array<{ name: string, link: string }>, hasNext: boolean }>} A Promise containing the company data and hasNext flag.
 */
const getCompanyList = async (context, pageNumber = 1) => {
  let page = null

  try {
    page = await context.newPage()

    await page.goto(`https://www.rocketpunch.com/companies?page=${pageNumber}`)
    await page.waitForSelector('.company-list')

    const companies = await page.evaluate(() => {
      const companyElements = document.querySelectorAll('.company-list .company.item')
      const hasNext = !!document.querySelector('#pagination-wrapper > div > a:nth-child(4)')

      const companiesData = Array.from(companyElements).map((element) => {
        const name = element.querySelector('.header.name')?.textContent?.trim()
        const link = element.querySelector('.link')?.href?.trim()
        return { name, link }
      })

      return { data: companiesData, hasNext }
    })

    return companies
  } catch (error) {
    console.error(
      chalk.red(
        `'${pageNumber} 페이지'의 정보를 가져오는 중 오류가 발생했습니다: ${error?.message}`
      )
    )
    throw error
  } finally {
    if (page) {
      await page.close()
    }
  }
}

/**
 * Retrieves detailed information about a company.
 *
 * @param {puppeteer.BrowserContext} context
 * @param {string} companyDetailLink - The link to the company's page.
 * @returns {Promise<{ name: string, email: string, phone: string, description: string }>} A Promise containing the company's detailed information.
 */
const getCompanyDetail = async (context, companyDetailLink) => {
  let page = null

  try {
    page = await context.newPage()

    await page.goto(companyDetailLink)

    const detail = await page.evaluate(() => {
      const name = document.querySelector('#company-name > h1')?.textContent?.trim()
      const email = document.querySelector('#company-email')?.textContent?.trim() || ''
      const phone = document.querySelector('#company-phone')?.textContent?.trim() || ''
      const description = document.querySelector('#company-description')?.textContent?.trim() || ''

      return { name, email, phone, description }
    })

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

/**
 * Collects company details using the provided context and company list.
 *
 * @param {puppeteer.BrowserContext} context - The browser context.
 * @param {Array} companyList - The list of companies to collect details for.
 * @returns {Promise<Array>} - Resolves with an array of collected company details.
 */
const collectCompanyDetails = async (context, companyList) => {
  const detailPromises = companyList.map(async (searchedCompany) => {
    const detail = await getCompanyDetail(context, searchedCompany.link)
    printCompanyDetails(detail)

    return detail
  })

  return Promise.allSettled(detailPromises)
}

/**
 * Prints company details to the console.
 *
 * @param {Object} detail - The company detail object.
 */
const printCompanyDetails = (detail) => {
  console.log(chalk.gray(`\n⌙ 이름: ${detail.name}`))
  console.log(chalk.gray(`  ⌙ 이메일: ${detail.email}`))
  console.log(chalk.gray(`  ⌙ 연락처: ${detail.phone}`))
}

module.exports = {
  login,
  getCompanyList,
  getCompanyDetail,
  collectCompanyDetails
}
