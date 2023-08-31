const puppeteer = require('puppeteer')
const chalk = require('chalk')
const prompt = require('prompt')

const { LOGO, HELP } = require('./constants')
const { saveJSONToCSV } = require('./helpers')
const { clearTerminal } = require('./helpers/cli')
const { chromiumExecutablePath } = require('./helpers/pkg')
const { login, getCompanyList, collectCompanyDetails } = require('./lib/services')

prompt.message = ''

/**
 * Initializes the data collection process.
 */
const bootstrap = async () => {
  clearTerminal()

  console.log(chalk.green(LOGO))
  console.log(chalk.gray(HELP))

  let browser, context

  const companyList = []

  browser = await puppeteer.launch({
    executablePath: chromiumExecutablePath,
    headless: true
  })
  context = await browser.createIncognitoBrowserContext()

  console.log(chalk.green('\n[*] 로켓펀치 계정을 입력하세요\n'))

  prompt.start()
  const input = await prompt.get([
    {
      properties: {
        emailOrPhone: { description: '휴대전화 번호 혹은 이메일' }
      }
    },
    {
      properties: {
        password: { description: '비밀번호', replace: '*', hidden: true }
      }
    }
  ])

  await login(context, { ...input })
  console.log(chalk.green('\n✅ 로그인에 성공하였습니다.'))

  let currentPage = 1

  while (true) {
    const { data, hasNext } = await getCompanyList(context, currentPage)
    if (!hasNext || data.length === 0) break

    clearTerminal()
    console.log(chalk.green(`\n${currentPage} 페이지에서 회사 정보를 수집 중 ...`))

    const companyDetails = await collectCompanyDetails(context, data)
    companyList.push(...companyDetails)

    currentPage++
  }

  clearTerminal()
  console.log(
    chalk.green(
      `\n✅ 작업이 완료되었습니다. 총 ${currentPage - 1}개의 페이지에서 ${
        companyList.length
      }개의 회사 정보를 수집했습니다.`
    )
  )

  await saveJSONToCSV(companyList, 'companies.csv')

  console.log(chalk.green(`\n✅ CSV 파일로 저장되었습니다.`))

  await context.close()
  await browser.close()
}

bootstrap().catch((error) => {
  console.error(
    chalk.red(
      `의도치 않게 프로그램이 종료되었습니다\n (지속적인 문제 발생시 개발자에게 에러를 보내주세요.): ${error?.message}`
    )
  )
  process.exit(1)
})
