// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Job titles that are not in English.
//
// Salesforce keeps a job title as free text, so nothing there catches "Directeur
// Technique". The server asks Claude about each distinct title once and remembers the
// answer (operations/events/titles.py); this file turns those answers into findings on
// the grid.
//
// A flagged title is a SUGGESTION like any other — "Directeur Technique → Technical
// Director", accept or reject — with one difference: rejecting it means "keep it as it
// is", and that SETTLES the cell. A French title is not wrong, only untranslated, so the
// RMM's word is final. Kept titles are stored with the list (`kept_titles`), and
// automatic review on the server refuses a list only while a flagged title is neither
// replaced nor kept.
//
// ONE WSO2 ADDITION: not in the Marketing Ops original.

import type { Issue, Row } from './validate'

/** The template column every member status maps "Job Title" to. */
export const TITLE_FIELD = 'job_title'

/** The finding's code, which `reject` reads to keep the title instead of dismissing. */
export const NOT_ENGLISH = 'not_english'

export interface Translation {
  english: string
  language: string | null
}

/** Trimmed, whitespace collapsed, lower-cased. Mirrors titles.key on the server — keep
 *  the two in step, or a kept title would still be refused there. */
export const titleKey = (title: string): string =>
  (title ?? '').split(/\s+/).filter(Boolean).join(' ').toLowerCase()

/** The finding for one cell's title, or nothing when it is English, kept, or unknown. */
export function titleIssue(value: string, translations: Record<string, Translation>,
                           kept: ReadonlySet<string>): Issue | undefined {
  const key = titleKey(value)
  if (!key || kept.has(key)) return undefined
  const found = translations[key]
  if (!found) return undefined
  const language = found.language ? `is ${found.language}` : 'isn’t in English'
  return {
    field: TITLE_FIELD,
    code: NOT_ENGLISH,
    bucket: 'fixable',
    message: `“${value.trim()}” ${language}. Accept the English title, or reject to keep it as it is.`,
    value,
    suggestion: found.english,
    source: 'llm',
  }
}

/** Every distinct job title in the list, as typed — what the server is asked about. */
export function distinctTitles(tabs: Record<string, { data: Row }[]>): string[] {
  const seen = new Map<string, string>()
  for (const rows of Object.values(tabs)) {
    for (const { data } of rows) {
      const title = (data[TITLE_FIELD] ?? '').trim()
      const key = titleKey(title)
      if (key && !seen.has(key)) seen.set(key, title)
    }
  }
  return [...seen.values()]
}
