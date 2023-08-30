const clearTerminal = () => {
  process.stdout.write('\x1Bc')
}

module.exports = { clearTerminal }
