const { ipcRenderer } = require('electron')

/* 隔离世界只监听提交事件，不向网页暴露任何 Electron 或密码读取接口。 */
document.addEventListener('submit', (event) => {
  try {
    if (location.protocol !== 'https:') return
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    const passwords = [...form.querySelectorAll('input[type="password"]')]
      .filter((input) => input.value && !input.disabled && !input.readOnly)
    if (passwords.length !== 1) return
    const username = [...form.querySelectorAll('input')]
      .find((input) => !input.disabled && !input.readOnly && ['text', 'email', 'tel'].includes(String(input.type).toLowerCase()) && input.value)
    ipcRenderer.send('browser:password-submit', {
      origin: location.origin,
      username: String(username?.value || '').slice(0, 320),
      password: String(passwords[0].value).slice(0, 1024),
    })
  } catch (error) { console.error('[browser-password] 提交监听失败', error) }
}, true)

ipcRenderer.on('browser:password-fill', (_event, payload = {}) => {
  let ok = false
  try {
    if (location.protocol === 'https:' && location.origin === payload.origin) {
      const passwords = [...document.querySelectorAll('input[type="password"]')].filter((input) => !input.disabled && !input.readOnly)
      if (passwords.length) {
        const set = (input, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
          if (setter) setter.call(input, value)
          else input.value = value
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
        set(passwords[0], String(payload.password || ''))
        const form = passwords[0].form || document
        const username = form.querySelector('input[autocomplete="username"], input[type="email"], input[type="text"], input[type="tel"]')
        if (username && !username.disabled && !username.readOnly) set(username, String(payload.username || ''))
        passwords[0].focus()
        ok = true
      }
    }
  } catch (_) { ok = false }
  ipcRenderer.send('browser:password-filled', { requestId: payload.requestId, ok })
})
