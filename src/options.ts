import { useStorage, ignorableWatch } from '@vueuse/core'
import { sendMessage, getCurrentContext, onMessage } from 'webext-bridge'
import type { Options } from './types'

const defaultOptions: Options = {
  showAvatar: true,
  showOwnerName: true,
  githubDev: true,
  excludeClosed: true,
}

export const options = getCurrentContext() === 'background'
  ? useStorage('options', defaultOptions)
  : ref(defaultOptions)

export function initContext(type?: 'background' | 'popup') {
  // popup shares the same storage as background,
  // useStorage will auto sync the ref so we don't need to do anything here.
  if (type === 'popup')
    return

  if (type === 'background') {
    const tabIds: number[] = []
    // @ts-expect-error FIXME
    onMessage('get-options', ({ sender }) => {
      if (sender.tabId)
        tabIds.push(sender.tabId)
      return options.value
    })
    onMessage('set-options', ({ data }) => {
      Object.assign(options.value, data)
    })

    watch(
      options,
      () => {
        tabIds.forEach(async(tabId) => {
          await sendMessage('set-options', options.value, { tabId, context: 'content-script' })
        })
      },
      { deep: true },
    )
  }
  else {
    const { ignoreUpdates } = ignorableWatch(
      options,
      () => sendMessage('set-options', options.value),
      { deep: true },
    )
    sendMessage('get-options', null, 'background')
      .then((v) => {
        ignoreUpdates(() => {
          // @ts-expect-error FIXME
          options.value = v
        })
      })
    onMessage('set-options', ({ data }) => {
      ignoreUpdates(() => {
        options.value = data
      })
    })
  }
}
