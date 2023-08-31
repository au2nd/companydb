const fs = require('fs/promises')

/**
 * Removes unnecessary spaces and newlines from a string.
 *
 * @param {string} s - The input string.
 * @returns {string} The cleaned string with reduced spaces and newlines.
 */
const c = (s) =>
  s
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * save json to csv
 *
 * @param {Object[]} dataArray
 * @param {string} filePath
 * @returns {Promise<void>}
 */
const saveJSONToCSV = async (dataArray, filePath) => {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    console.error('Input data is not a valid array.')
    return
  }

  const header = Object.keys(dataArray[0])
  const csvContent = [header.join(',')]

  dataArray.forEach((item) => {
    const values = header.map((key) => item[key])
    csvContent.push(values.join(','))
  })

  const csvString = csvContent.join('\n')

  await fs.writeFile(filePath, csvString, 'utf8', (err) => {
    if (err) {
      console.error('Error saving CSV file:', err)
    } else {
      console.log('CSV file saved successfully.')
    }
  })
}

module.exports = { c, saveJSONToCSV }
