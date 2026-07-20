import { useEffect, useState } from "react"

import { HEADER_GROUP_DEFAULTS, type HeaderGroupKey } from "~lib/headerGroups"
import type { FormatType } from "~lib/format"

export interface CopyPrefs {
  format: FormatType
  headerGroups: Record<HeaderGroupKey, boolean>
  includeResponse: boolean
  responseHeaderGroups: Record<HeaderGroupKey, boolean>
}

const STORAGE_KEY = "rr:copy-prefs"

const DEFAULT_PREFS: CopyPrefs = {
  format: "curl",
  headerGroups: { ...HEADER_GROUP_DEFAULTS },
  includeResponse: false,
  responseHeaderGroups: { ...HEADER_GROUP_DEFAULTS }
}

export function useCopyPrefs(): [CopyPrefs, (patch: Partial<CopyPrefs>) => void] {
  const [prefs, setPrefs] = useState<CopyPrefs>(DEFAULT_PREFS)

  // 挂载时从 storage 读取
  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const saved = result[STORAGE_KEY]
      if (saved) {
        setPrefs((prev) => ({
          ...prev,
          ...saved,
          // 合并 headerGroups，防止新增分组键丢失默认值
          headerGroups: { ...DEFAULT_PREFS.headerGroups, ...saved.headerGroups },
          responseHeaderGroups: { ...DEFAULT_PREFS.responseHeaderGroups, ...saved.responseHeaderGroups }
        }))
      }
    })
  }, [])

  const update = (patch: Partial<CopyPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      // 先 setState，再异步持久化
      chrome.storage.local.set({ [STORAGE_KEY]: next })
      return next
    })
  }

  return [prefs, update]
}
