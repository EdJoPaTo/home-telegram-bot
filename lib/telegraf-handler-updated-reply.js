module.exports = function (updateEveryMs, updateUntilMs, method) {
  return async (ctx, next) => {
    const {text, extra} = method()
    const msgSend = await ctx.reply(text, extra)

    function editMessageFunc(text, extra) {
      return ctx.telegram.editMessageText(msgSend.chat.id, msgSend.message_id, undefined, text, extra)
        .catch(handleEditMessageError)
    }

    setInterval(doUpdates, updateEveryMs, editMessageFunc, msgSend.date * 1000, updateUntilMs, method)
    return next()
  }
}

function doUpdates(editMessageFunc, initialMessageDate, updateUntilMs, method) {
  const msSinceInitialMessage = Date.now() - initialMessageDate
  if (msSinceInitialMessage > updateUntilMs) {
    clearInterval(this)
    return
  }

  const {text, extra} = method()
  return editMessageFunc(text, extra)
}

function handleEditMessageError(err) {
  if (err.description === 'Bad Request: message is not modified') {
    return
  }
  console.log(new Date(), 'Error in telegraf-handler-updated-reply', err)
}
