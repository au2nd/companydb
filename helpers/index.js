/**
 * Removes unnecessary spaces and newlines from a string.
 *
 * @param {string} s - The input string.
 * @returns {string} The cleaned string with reduced spaces and newlines.
 */
const c = (s) =>
  s
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

module.exports = { c };
