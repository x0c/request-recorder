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
    <div style={{ padding: "0 12px 12px" }}>
      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginBottom: 8,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em"
        }}>
        过滤配置
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {ALL_TYPES.map(({ value, label }) => {
          const active = filter.types.includes(value)
          return (
            <button
              key={value}
              onClick={() => toggleType(value)}
              style={{
                padding: "3px 10px",
                borderRadius: 9999,
                fontSize: 12,
                border: `1px solid ${active ? "#3b82f6" : "#d1d5db"}`,
                background: active ? "#eff6ff" : "#f9fafb",
                color: active ? "#2563eb" : "#6b7280",
                cursor: "pointer",
                fontWeight: active ? 600 : 400
              }}>
              {label}
            </button>
          )
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
          URL 关键词
        </span>
        <input
          type="text"
          value={filter.urlKeyword}
          onChange={(e) => onChange({ ...filter, urlKeyword: e.target.value })}
          placeholder="如 /api/"
          style={{
            flex: 1,
            fontSize: 12,
            padding: "4px 8px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            outline: "none",
            fontFamily: "monospace"
          }}
        />
        {(filter.types.length !== DEFAULT_FILTER.types.length ||
          filter.urlKeyword) && (
          <button
            onClick={() => onChange({ ...DEFAULT_FILTER })}
            style={{
              fontSize: 11,
              color: "#9ca3af",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 2px"
            }}>
            重置
          </button>
        )}
      </div>
    </div>
  )
}
