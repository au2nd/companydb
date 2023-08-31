const path = require('path'),
  playwright = require('playwright'),
  chalk = require('chalk'),
  prompt = require('prompt'),
  Promise = require('bluebird')

const { LOGO } = require('./constants')
const { saveJSONToCSV } = require('./helpers')
const { clearTerminal } = require('./helpers/cli')
const { auth, getCompanyDetail, getCompanyList } = require('./lib/services')

const MAX_CONCURRENT_REQUESTS = 10

// add headless for pkg build
const browserOptions = process.pkg
  ? {
      executablePath: path.join(
        path.dirname(process.execPath),
        './bin/chromium-1076/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
      )
    }
  : {}

prompt.message = '' // 앞에 오는 메시지 제거

/**
 * @typedef {Object} Credentials
 * @property {string} emailOrPhone - The user's login ID.
 * @property {string} password - The user's login password.
 */

/**
 * Launches the browser, logs in, and retrieves company details.
 *
 * @param {Credentials} credentials
 * @returns {Promise<void>}
 */
const bootstrap = async () => {
  clearTerminal()
  console.log(chalk.greenBright(LOGO))

  let browser, context, page

  const companyList = []

  try {
    browser = await playwright.chromium.launch(browserOptions)

    console.log(chalk.gray(browser.browserType().executablePath()))

    context = await browser.newContext({
      locale: 'ko-KR',
      extraHTTPHeaders: {
        'accept-language': 'ko,en-US;q=0.9,en;q=0.8,ko-KR;q=0.7,ro;q=0.6,vi;q=0.5'
      }
    })

    // 로그인
    // TODO: 로그인 실패 처리
    console.log(chalk.bgGreen('\n\n로켓펀치 계정을 입력하세요 ...'))

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
    console.log(chalk.green('\n\n✅ 로그인에 성공하였습니다.\n'))

    let currentPage = 1

    while (true) {
      try {
        const { data, hasNext } = await getCompanyList(context, currentPage)
        if (!hasNext || data.length === 0) break

        clearTerminal()
        console.log(
          chalk.bgGreen(`\n${currentPage} 페이지에서 ${data.length}개의 회사 정보를 수집 중 ...\n`)
        )

        const detailPromises = data.map(async (searchedCompany) => {
          const detail = await getCompanyDetail(context, searchedCompany.link)
          console.log(chalk.blueBright(`⌙ 이름: ${detail.name}`))

          return detail
        })

        // Process detail pages in parallel with a limited concurrency
        const companyDetails = await Promise.map(detailPromises, async (promise) => promise, {
          concurrency: MAX_CONCURRENT_REQUESTS
        })

        companyList.push(...companyDetails)
      } catch (error) {
        // Handle error
      }

      currentPage++
    }

    clearTerminal()
    console.log(
      chalk.green(
        `\n\n✅ 작업이 완료되었습니다. 총 ${currentPage}개의 페이지에서 ${companyList.length}개의 회사 정보를 수집했습니다.`
      )
    )

    await saveJSONToCSV(companyList, 'companies.csv')

    console.log(chalk.green(`\n✅ CSV 파일로 저장되었습니다.`))
  } catch (error) {
    console.error(chalk.red(`\n에러 메시지: ${error?.message}`))
  } finally {
    await page?.close()
    await context?.close()
    await browser?.close()
  }
}

bootstrap().catch((error) => {
  console.error(
    chalk.red(
      `의도치 않게 프로그램이 종료되었습니다 (개발자에게 에러를 보내주세요.): ${error?.message}`
    )
  )
})
