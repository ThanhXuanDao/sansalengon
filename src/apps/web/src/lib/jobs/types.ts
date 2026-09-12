export interface JobError {
  item?: string
  reason: string
}

export interface JobResult {
  itemsTotal?: number
  itemsSuccess?: number
  itemsFailed?: number
  source?: string
  niche?: string
  summary?: string
  errors?: JobError[]
  meta?: Record<string, unknown>
}

export type JobConfig = Record<string, unknown>

export type JobHandler = (config: JobConfig) => Promise<JobResult>

export interface ConfigField {
  key: string
  label: string
  type: "text" | "number" | "select" | "toggle"
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  description?: string
}

export interface JobDefinition {
  key: string
  name: string
  description: string
  category: "sync" | "maintenance" | "ai" | "content" | "broadcast" | "analytics"
  icon: string
  defaultConfig: JobConfig
  configFields: ConfigField[]
  handler: JobHandler
}
