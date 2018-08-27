module.exports = function (updateEveryMs, updateUntilMs, method) {
  return async (ctx, next) => {
    const {text, extra} = method()
    const msgSend = await ctx.reply(text, extra)

    function editMessageFunc(text, extra) {
      return ctx.telegram.editMessageText(msgSend.chat.id, msgSend.message_id, undefined, text, extra)
    }

    setInterval(doUpdates, updateEveryMs, editMessageFunc, msgSend.date * 1000, updateUntilMs, method)
    return next()
  }
}

async function doUpdates(editMessageFunc, initialMessageDate, updateUntilMs, method) {
  const msSinceInitialMessage = Date.now() - initialMessageDate
  if (msSinceInitialMessage > updateUntilMs) {
    clearInterval(this)
    return
  }

  const {text, extra} = method()
  try {
    await editMessageFunc(text, extra)
  } catch (err) {
    if (err.description === 'Bad Request: message is not modified') {
      return
    }
    if (err.description.match(/too many requests/i)) {
      console.warn(new Date(), 'Too many request by telegraf-handler-updated-reply', err.parameters)
      clearInterval(this)
      return
    }

    console.log(new Date(), 'Error in telegraf-handler-updated-reply', err)
  }
}
