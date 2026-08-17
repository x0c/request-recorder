import type { FilterConfig, RequestType } from "~lib/types"
import { DEFAULT_FILTER } from "~lib/types"

const ALL_TYPES: { value: RequestType; label: string }[] = [
  { value: "xhr", label: "XHR" },
  { value: "fetch", label: "Fetch" },
  { value: "script", label: "Script" },
  { value: "stylesheet", label: "CSS" },
  { value: "image", label: "Image" },
  { value: "other", label: "Other" }
]

interface Props {
  filter: FilterConfig
  onChange: (filter: FilterConfig) => void
}

export default function FilterConfig({ filter, onChange }: Props) {
  const toggleType = (type: RequestType) => {
    const types = filter.types.includes(type)
      ? filter.types.filter((t) => t !== type)
      : [...filter.types, type]
    onChange({ ...filter, types })
  }

  return (
    <div className="px-3 pb-3 pt-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        过滤配置
      </div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {ALL_TYPES.map(({ value, label }) => {
          const active = filter.types.includes(value)
          return (
            <button
              key={value}
              onClick={() => toggleType(value)}
              className={`rounded-full border px-2.5 py-[3px] text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                active
                  ? "border-blue-600 bg-blue-600/10 font-semibold text-blue-700 dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-300"
                  : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
              }`}>
              {label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
          URL 关键词
        </span>
        <input
          type="text"
          value={filter.urlKeyword}
          onChange={(e) => onChange({ ...filter, urlKeyword: e.target.value })}
          placeholder="如 /api/"
          className="h-7 min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 font-mono text-xs text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
        />
        {(filter.types.length !== DEFAULT_FILTER.types.length ||
          filter.urlKeyword) && (
          <button
            onClick={() => onChange({ ...DEFAULT_FILTER })}
            className="rounded px-1 py-0.5 text-[11px] text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300">
            重置
          </button>
        )}
      </div>
    </div>
  )
}
