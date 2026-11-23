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

import { campaignIdFrom } from "../rules/validate";

/** What a campaign URL is worth, as the person types it. Machine review refuses a list
 *  without a campaign ID, so say so on the field rather than at Submit. */
export function campaignUrlHint(url: string): { error: boolean; text: string } {
  if (!url.trim()) {
    return {
      error: false,
      text: "Needed before the list can pass machine review. Copy it from the campaign’s page in Salesforce.",
    };
  }
  const id = campaignIdFrom(url);
  return id
    ? { error: false, text: `Campaign ID ${id} — added to every row.` }
    : {
        error: true,
        text: "No campaign ID in that link. Open the campaign in Salesforce and copy the URL from its page.",
      };
}
