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

// Job titles not in English: flagged as a suggestion, accepted or kept, and the kept
// ones stored with the list.

import { describe, expect, it } from "vitest";
import type { FieldDef } from "../eventsTypes";
import {
  accept,
  applyTranslations,
  countsFor,
  edit,
  fromPayload,
  reject,
  rejectedCount,
  toPayload,
  unrejectAll,
  type Model,
} from "./model";
import type { Reference } from "./reference";
import type { EventsConfig } from "./schema";
import { NOT_ENGLISH, distinctTitles, titleKey } from "./titles";

function def(field_name: string, extra: Partial<FieldDef> = {}): FieldDef {
  return { field_name, header_label: field_name, data_type: "text", picklist: [], mandatory: false, ...extra };
}
const config: EventsConfig = {
  statuses: [{ name: "Booth", score: 5, enabled: true }],
  fields: { Booth: [def("Email", { mandatory: true }), def("Job Title")] },
};
const ref: Reference = { countries: [], states: {}, stateRequired: [], assisted: false };
const event = { name: "DSI Forum", date: "2026-11-20", campaignUrl: "" };

const ANSWERS = [{ key: "directeur technique", english: "Technical Director", language: "French" }];

function load(titles: string[], kept: string[] = []): Model {
  const rows = titles.map((job_title, i) => ({ email: `p${i}@x.io`, job_title }));
  return applyTranslations(fromPayload({ tabs: { Booth: rows }, kept_titles: kept }, event, ref, config), ANSWERS, ref, config);
}
const cell = (m: Model, i: number) => ({ tab: "Booth", rowId: m.tabs.Booth[i].id, field: "job_title" });
const titleIssues = (m: Model) => m.tabs.Booth.map((r) => r.issues.find((i) => i.code === NOT_ENGLISH));

describe("titleKey", () => {
  it("mirrors the server's key", () => {
    expect(titleKey("  Directeur   Technique ")).toBe("directeur technique");
    expect(titleKey("")).toBe("");
  });
});

describe("distinctTitles", () => {
  it("asks about each title once, as typed, and skips blanks", () => {
    const m = load(["CTO", "Directeur Technique", " directeur  technique", "", "CTO"]);
    expect(distinctTitles(m.tabs)).toEqual(["CTO", "Directeur Technique"]);
  });
});

describe("a title not in English", () => {
  it("is a suggestion on every row with that title, and blocks like one", () => {
    const m = load(["CTO", "Directeur Technique", "directeur technique"]);
    const [cto, a, b] = titleIssues(m);
    expect(cto).toBeUndefined();
    expect(a).toMatchObject({
      suggestion: "Technical Director",
      bucket: "fixable",
      source: "llm",
      message: "“Directeur Technique” is French. Accept the English title, or reject to keep it as it is.",
    });
    expect(b?.suggestion).toBe("Technical Director");
    expect(countsFor(m.tabs.Booth)).toMatchObject({ total: 2, fixable: 2 });
  });

  it("is settled by accepting the English title", () => {
    const base = load(["Directeur Technique"]);
    const done = accept(base, [cell(base, 0)], ref, config);
    expect(done.tabs.Booth[0].data.job_title).toBe("Technical Director");
    expect(done.tabs.Booth[0].issues).toEqual([]);
  });

  it("is settled by keeping it — on every row with that title, and stored with the list", () => {
    const base = load(["Directeur Technique", "directeur technique"]);
    const kept = reject(base, [cell(base, 0)], ref, config);
    expect(titleIssues(kept)).toEqual([undefined, undefined]);
    expect(kept.tabs.Booth[0].data.job_title).toBe("Directeur Technique");
    expect(kept.dismissed.size).toBe(0);
    expect(toPayload(kept).kept_titles).toEqual(["directeur technique"]);
    expect(rejectedCount(kept)).toBe(1);
  });

  it("stays kept after a reload", () => {
    const m = load(["Directeur Technique"], ["directeur technique"]);
    expect(titleIssues(m)).toEqual([undefined]);
  });

  it("is offered again by Suggest fixes", () => {
    const base = load(["Directeur Technique"]);
    const again = unrejectAll(reject(base, [cell(base, 0)], ref, config), ref, config);
    expect(titleIssues(again)[0]?.suggestion).toBe("Technical Director");
  });

  it("goes away when the title is edited", () => {
    const base = load(["Directeur Technique"]);
    const edited = edit(base, "Booth", [{ rowId: base.tabs.Booth[0].id, field: "job_title", value: "CTO" }], ref, config);
    expect(titleIssues(edited)).toEqual([undefined]);
  });
});
