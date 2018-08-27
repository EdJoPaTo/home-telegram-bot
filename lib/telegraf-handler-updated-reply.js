module.exports = function (updateEveryMs, updateUntilMs, method, ...args) {
  return async (ctx, next) => {
    const {text, extra} = method(...args)
    const msgSend = await ctx.reply(text, extra)

    function editMessageFunc(text, extra) {
      return ctx.telegram.editMessageText(msgSend.chat.id, msgSend.message_id, undefined, text, extra)
    }

    setInterval(doUpdates, updateEveryMs, editMessageFunc, msgSend.date * 1000, updateUntilMs, method, ...args)
    return next()
  }
}

function doUpdates(editMessageFunc, initialMessageDate, updateUntilMs, method, ...args) {
  const msSinceInitialMessage = Date.now() - initialMessageDate
  if (msSinceInitialMessage > updateUntilMs) {
    clearInterval(this)
    return
  }

  const {text, extra} = method(...args)
  return editMessageFunc(text, extra)
}
