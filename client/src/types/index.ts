// Shared types for the client application

export type LibraryFiles = {
  yaml_files: string[]
  csv_files: string[]
  html_files?: string[]
  png_files?: string[]
  total_files?: number
}

export type JsonDict = Record<string, unknown>
