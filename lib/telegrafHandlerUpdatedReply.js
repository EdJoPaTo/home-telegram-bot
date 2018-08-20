module.exports = function(updateEveryMs, updateUntilMs, method, ...args) {
  return async (ctx, next) => {
    const {text, extra} = method(...args)
    const msgSend = await ctx.reply(text, extra)

    setInterval(doUpdates, updateEveryMs, ctx.telegram, msgSend.chat.id, msgSend.message_id, msgSend.date * 1000, updateUntilMs, method, ...args)
    return next()
  }
}

function doUpdates(telegram, chatID, messageID, initialMessageDate, updateUntilMs, method, ...args) {
  const msSinceInitialMessage = Date.now() - initialMessageDate
  if (msSinceInitialMessage > updateUntilMs) {
    clearInterval(this)
    return
  }

  const {text, extra} = method(...args)
  telegram.editMessageText(chatID, messageID, undefined, text, extra)
}
