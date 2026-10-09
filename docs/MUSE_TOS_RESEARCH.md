# Muse Auto-Allow — Launch Risk Research: Muse/Meta Terms & Chrome Web Store Policy

- **Product under review:** "Muse Auto-Allow" — a Chrome MV3 extension that auto-clicks the "Allow" button on approval cards inside Muse (muse.ai, Meta's personal AI agent web app), in the user's own authenticated session. Passive, local-only storage, no data collection.
- **Research date:** 2026-10-09 (web research only). **Second pass same day:** every quoted string was re-fetched and verified verbatim against live pages; corrections and additions are logged in §7.
- **Purpose:** informs the open item "Sanity-check Muse's terms of service around helping a user auto-approve their own agent actions" (`store/PUBLISH_RUNBOOK.md`; tracked in `store/COMPLIANCE_CHECKLIST.md`). Findings only — not a decision, not legal advice.
- **Evidence classes used throughout:**
  - `SOURCE_SUPPORTED` — verbatim text from a cited official page (Meta/Muse official pages, developer.chrome.com).
  - `COMMUNITY_REPORTED` — public anecdotes/third-party observations (Reddit threads, marketplace listings, third-party reviews). Not policy.
  - `HYPOTHESIS` — the author's analysis/interpretation, not a statement of law or of Meta/Google policy.
  - `UNVERIFIED` — could not be checked or no official statement exists publicly.
- **Disclaimer:** This document is research, not legal advice. It presents findings and leaves decisions to the owner.

---

## 1. Executive summary & risk ratings

| # | Question | Rating | One-line basis |
|---|----------|--------|----------------|
| 1 | Do muse.ai/Meta terms restrict automating approvals in the user's own Muse session? | **MEDIUM** (blanket design: MEDIUM–HIGH) | No clause explicitly bans browser extensions or UI auto-clicking on muse.ai, but the Muse ToS oversight clause (§7.6) requires "meaningful human oversight" and says users should not make state-changing actions "without appropriate human review and approval prior to execution or granting pre-authorization for such actions." A blanket auto-approver is in material tension with that sentence. (`SOURCE_SUPPORTED` text + `HYPOTHESIS` interpretation) |
| 2 | Chrome Web Store policy fit | **LOW (conditional)** | The design (single purpose, local-only `chrome.storage`, no remote code, hosts scoped to `https://muse.ai/*` + `https://*.muse.ai/*`) maps cleanly onto CWS program policies. Conditions: accurate listing disclosure of the auto-click behavior, privacy disclosures even though local-only, narrow permissions + dashboard justifications, no Meta branding/trademark misuse. (`SOURCE_SUPPORTED` policy text + `COMMUNITY_REPORTED` analogues) |

### Key findings (with evidence class)

1. **The most adverse single sentence for this product (Q1).** Muse Supplemental ToS §7.6 "Oversight, Review and Correction": *"By using Muse, you will maintain meaningful human oversight over all actions taken. This includes promptly reviewing its actions and, where appropriate given the nature and consequences of the actions being performed, maintaining appropriate approval workflows over actions taken and communications sent on your behalf. It also includes not directing Muse to engage highly autonomously without appropriate oversight and approvals in place. In particular, you should not make state-changing actions, such as sending communications, executing financial transactions, deleting data, or modifying system configurations, without appropriate human review and approval prior to execution or granting pre-authorization for such actions."* — `SOURCE_SUPPORTED` (https://muse.ai/terms, Last updated September 8, 2026; mirrored at https://agent.meta.ai/terms). Interpretation of how this applies to a third-party auto-click tool is `HYPOTHESIS` — no enforcement precedent or Meta statement on extensions was found (`UNVERIFIED`).
2. **No extension-specific prohibition found.** Searches of Muse's legal pages, privacy policy, Connector platform terms/guidelines, Meta ToS, Meta AI Terms, Meta Help Center, and the Meta Model API Acceptable Use Policy found **no statement addressing browser extensions or UI automation on muse.ai**. The closest official texts are the oversight clause above, the Meta ToS "technological measures" clause, the Connector-platform rules (scoped to Connector developers), and the developer-side AUP (finding 7). `UNVERIFIED` (absence of statement = could not confirm either way).
3. **Meta's own design line on approvals (calibration signal, Q1).** Meta treats approval prompts as "human-in-the-loop (HITL) checks" and states: *"Respect Muse's approval and safety controls. Do not bypass them, ask users to disable them, or reuse approval for unrelated actions."* and *"Sensitive writes cannot be set to Always allow, including through Settings or a saved permission."* — `SOURCE_SUPPORTED` (Muse Connector guidelines, https://muse.ai/platform/docs). This text is written for Connector developers, not browser extensions (`HYPOTHESIS` on applicability), but it is the clearest public evidence of where Meta draws the line: durable auto-allow is allowed for non-sensitive actions, per-use approval is mandatory for sensitive writes. An auto-approver that clicks "Allow" on *everything* cuts across that line; one restricted to non-sensitive actions tracks it.
4. **Approvals are a deliberate product safety layer.** Meta Help Center: *"Many of these approval checks are enforced outside the AI model, so they don't rely only on Muse deciding whether it should ask."* — `SOURCE_SUPPORTED` (https://www.meta.com/help/artificial-intelligence/1047255454427887/). Note the extension automates the *user's click*, not the server-side enforcement (the checks still fire; the extension merely answers them). This distinction is the strongest argument that the extension is not "bypassing" a technical protection — `HYPOTHESIS`.
5. **Product precedent exists and is argued by analogy (Q2).** Live CWS listings with the same pattern were verified: **Claude Auto-Approve & Reconnect** (fetched live: v1.3.0, updated 2026-07-08; whitelist-based auto-click of claude.ai permission dialogs; "All history and settings are stored only in your browser (chrome.storage.local)... Nothing is ever sent to an external server") and **ChatGPT MCP Auto-Approve** ("Automatically clicks the 'Allow' button when using MCP tools on ChatGPT"). `COMMUNITY_REPORTED` (public listings; existence proves the category can be listed, not that any specific submission is approved; URLs re-checked live 2026-10-09).
6. **CWS policies contain no named rule against auto-clicking/automation of third-party UI.** The nearest operative considerations are single purpose, permissions minimization, user-data disclosure (including local-only processing), remote-code prohibition, "Misleading or Unexpected Behavior" (listings must state functionality plainly), and the Spam-and-Abuse sentence about sending messages "on behalf of the user" (see §3 row 17). `SOURCE_SUPPORTED` for each policy text; `HYPOTHESIS` for the "no named rule" conclusion after a keyword scan of the whole policy catalog (https://developer.chrome.com/docs/webstore/program-policies/; methodology in §3).
7. **Meta's developer-side AUP names the failure mode directly (calibration signal, Q1).** The Meta Model API Acceptable Use Policy prohibits using Meta services "to operate AI agents (including models, harnesses, or other components thereof) or automated systems, or otherwise take Actions in ways that evade human oversight or accountability," including to "Circumvent, disable, or evade human review, monitoring, or other oversight controls" and to "Take consequential or irreversible actions through connected accounts, tools, or services ... without appropriate authorization, human oversight, review, and confirmation mechanisms." — `SOURCE_SUPPORTED` (https://dev.meta.ai/legal/acceptable-use-policy). Scope caveat: this AUP governs Meta Model API/developer products, and the Muse consumer ToS does not reference it (`HYPOTHESIS` on non-binding; `UNVERIFIED` whether Meta would analogize).

**Overall launch read (`HYPOTHESIS`):** The Chrome Web Store side looks publishable with careful listing/metadata hygiene. The Muse-terms side is the material risk: it is an interpretive, contract-level risk concentrated in one clause (§7.6) plus Meta's evident intent that sensitive actions always get per-use human approval. A scoped design (auto-approve only low-risk/non-sensitive actions; never send/post/pay/delete; keep an audit log; default off/whitelist-first) reduces the tension; a blanket "click Allow on everything" design should be treated as MEDIUM–HIGH on Q1. All quotations in this document were re-verified verbatim against live pages on 2026-10-09 (§7).

---

## 2. Verbatim quotes + exact URLs (SOURCE_SUPPORTED)

> Wording discipline: quotes below are copied verbatim from the fetched pages. Ellipses within quotes are marked. Everything in this section is `SOURCE_SUPPORTED` unless marked otherwise. Section numbers refer to the pages' own numbering (the Muse ToS numbers sections "01."–"20." with sub-items). **All quotes were re-verified verbatim on 2026-10-09** (§7).

### 2.1 Muse legal terms (Meta-published)

**a) Muse Supplemental Terms of Service** — https://muse.ai/terms (Last updated: September 8, 2026; also served at https://agent.meta.ai/terms — re-fetched 2026-10-09 with identical content; Meta's Help Center links the words "Muse Terms" to the agent.meta.ai URL).

- §7.6 Oversight, Review and Correction:
  > "By using Muse, you will maintain meaningful human oversight over all actions taken. This includes promptly reviewing its actions and, where appropriate given the nature and consequences of the actions being performed, maintaining appropriate approval workflows over actions taken and communications sent on your behalf. It also includes not directing Muse to engage highly autonomously without appropriate oversight and approvals in place. In particular, you should not make state-changing actions, such as sending communications, executing financial transactions, deleting data, or modifying system configurations, without appropriate human review and approval prior to execution or granting pre-authorization for such actions. State-changing actions modify persistent data, systems, or the external world and may be difficult or impossible to reverse."
- §7.4 User Responsibility (excerpt):
  > "Muse uses AI and Connected Services chosen by you to serve as your AI agent and take actions on your behalf. [...] You are solely responsible for the instructions, goals, and guidance you provide to Muse. You are also solely responsible for the actions Muse takes or directs in furtherance of those instructions, goals and guidance in connection with your access and use of Muse."
- §9 Meta's Right to Refuse:
  > "Your instructions and representations do not authorize Meta or Muse to engage in conduct that is inherently unlawful. Meta reserves the right to refuse to take any action that it determines, in its sole discretion, would violate applicable law or regulation or any policy of Meta regardless of your authorization."
- §4 Restrictions, item 6:
  > "Violate, bypass or circumvent any third party's terms of service, security, access controls, technical protections, including but not limited to circumventing any paywalls or CAPTCHAs, or use third party credentials without proper authorization;"
- §4 Restrictions, item 16:
  > "Chain or sequence automated actions across systems or platforms in a manner designed to obscure the automated nature of those actions from the parties affected by them;"
- §4 Restrictions, item 22:
  > "Encourage, facilitate or enable Muse to disregard or override its safety, security, or privacy training, systems or features, or to control physical systems in a way that could endanger individuals or violate an applicable law or regulation;"
- §10 Monitoring and Intervention (excerpt):
  > "Subject to your applicable Muse configuration: (a) Meta reserves the right, but has no obligation, to monitor, log, review, suspend, block, or modify Muse's actions at any time for safety, security, compliance, or operational reasons, or other reasons in Meta's discretion [...]"
- §11 Accuracy Warning (operative sentence):
  > "By using Muse, you agree to review all actions Muse takes to ensure its activity is aligned with your intentions and these Terms."
- §17 Enforcement, Termination and Suspension (excerpt):
  > "If we determine that your content or conduct violates these Terms or other applicable Meta terms or policies, or poses a risk to Meta, other users, or third parties, we may take appropriate action based on our assessment. Such action may include, without limitation: notifying you of the violation; issuing warnings or strikes; removing or restricting access to certain features; suspending or disabling your access to Muse and/or any associated Meta accounts; or referring the matter to law enforcement."
- §19 Disputes — arbitration carve-out (excerpt):
  > "The following claims don't have to be arbitrated and may be brought in court: disputes related to intellectual property (like copyrights and trademarks), violations of our Platform Policy, or efforts to interfere with the Service or engage with the Service in unauthorized ways (for example, automated ways)."

**b) Meta Terms of Service** — https://www.facebook.com/terms/ (Effective January 1, 2025). Incorporated into Muse by reference ("By using Muse, you agree to be bound by these Terms, the Meta Terms of Service, the Meta AI Terms of Service, and any other applicable terms and policies." — muse.ai/terms).

- §3.2 "What you can share and do on Meta Products", item 3:
  > "You may not access or collect data from our Products using automated means (without our prior permission) or attempt to access data you do not have permission to access, regardless of whether such automated access or collection is undertaken while logged-in to a Facebook account."
- §3.2, item 7:
  > "You may not do, or attempt to do, anything to circumvent, bypass, or override any technological measures that Meta uses to control or limit access to our Products or data."

**c) Meta AI Terms of Service** — https://www.facebook.com/legal/ai-terms. The page is a regional router — "Our AI Terms are different depending on the region that you live in" (UK / Brazil / European-region variants are linked) — and it carries the "Meta AIs Terms of Service" text, which includes an "Acceptable Uses" section introduced by "You may not access, use, or allow others to access or use AIs in any manner that would:" — the bullet list itself was not captured in extraction and is not quoted here. No clause on automating approvals or browser extensions was found in the captured text. (`UNVERIFIED` for the list contents and the regional variants — see §6.)

**d) Meta Automated Data Collection Terms** — https://www.facebook.com/legal/automated_data_collection_terms (Effective October 7, 2024). Considered because Muse/Meta ToS reference automated collection; assessment: governs *data collection* via automated tools, which this extension does not do (no data leaves the browser, nothing is collected).

- Operative sentence:
  > "You will not engage in Automated Data Collection without first obtaining Meta's express written permission or in any manner that is not explicitly authorized by Meta."
- Definition (excerpt; confirmed on full re-fetch 2026-10-09 — an initial partial fetch had missed this section):
  > "'Automated Data Collection,' for purposes of these Terms, refers to the collection of data from Meta Company Products via the use of automated or programmatic tools capable of navigating or indexing the surface-layer of the World Wide Web. These tools may include but are not limited to web scrapers, bots, robots, spiders, crawlers, user-agents, and other automated or programmatic mechanisms designed to access, collect, or retrieve data or content directly from web pages or applications."

**e) Muse Connector Terms** — https://muse.ai/platform/terms (Effective September 18, 2026). **Scope caveat (`SOURCE_SUPPORTED` + `HYPOTHESIS`):** These terms govern *Connector* developers — products such as "connectors, actions, plug-ins, MCP servers, or other integrations" "that communicate or interoperate with Muse, through a Connector Interface". A Chrome extension that clicks the user's own UI does not communicate through a Connector Interface, so these terms likely do **not** directly bind the extension (`HYPOTHESIS`). Quoted here as the closest published Meta stance on interfering with Muse controls.

- §3.3 Restrictions (excerpt): circumventing "rate limits, access controls, review, safety systems or similar controls related to Muse".
- **Muse Connector Policies** (same page; incorporated into the Connector Terms by reference):
  > "Your use of Muse and connecting to it through Connector Interfaces, including any content sent to or received from it, must comply with the (i) Terms and (ii) all applicable laws and regulations. You also agree that you will not do any of the following:"
  > "1. Prohibited Practices. You must not engage in any of the following conduct:"
  > "03. Exceed declared scope: including by performing undisclosed functions, accessing undeclared endpoints, or acting beyond user authorization."
  > "05. Circumvent restrictions or access controls: including by using proxies to evade review, creating multiple developer accounts, evading enforcement or usage limits, auto-solving CAPTCHAs, violating robots.txt."
  > "08. Execute high-consequence actions without explicit user authorization: including by controlling physical systems where actions could have dangerous consequences (e.g., locks, security systems, vehicles, heating appliances), performing financial transactions above material thresholds, or irreversibly deleting user data"
- *Attribution note:* the Prohibited Practices list lives in the Muse Connector Policies section of https://muse.ai/platform/terms; an earlier draft cited platform/docs — corrected in this pass (§7).

**f) Muse Connector guidelines (platform docs)** — https://muse.ai/platform/docs. (Written for Connector developers; see scope caveat above.)

- Section 3.4 "Respect the scope of approval":
  > "Respect Muse's approval and safety controls. Do not bypass them, ask users to disable them, or reuse approval for unrelated actions. Do not add products, tips, subscriptions, or fees without authorization."
- Section 3.3 "How tools are classified" (approval model):
  > "These approval prompts are called human-in-the-loop (HITL) checks."
  > "Currently reads and writes from platform connectors default to Ask on first use. Users can choose Always allow for tools that are not sensitive."
  > "Allow once covers one use. Always allow applies to future uses of that tool within its approved scope and can be revoked. Deny stops the requested tool use. Sensitive writes cannot be set to Always allow, including through Settings or a saved permission."
  > Table row (verbatim cells): "Write, sensitive | Every use. | Allow once · Deny"

### 2.2 Meta Help Center & product pages (Muse zoomed)

- **How Muse works with your guidance and approval** — https://www.meta.com/en-gb/help/artificial-intelligence/1385290430137537/ (the page the platform docs call the Muse Help Center control reference):
  > "We've designed Muse with multiple layers of privacy and security protections, including checking with you before sensitive actions such as payments or purchases. But no automated system is perfect. Because Muse acts on your behalf, you're responsible for guiding it carefully and approving its actions. You should review its activity and only grant the access that you're comfortable with."
  > "Oversee its actions regularly to make sure that they match your intentions."
  > "When Muse takes an action, it will ask you for approval in line with the permissions settings that you've set up. Approval options for actions can include:"
  > — "Allow once: Muse proceeds this one time"
  > — "Allow for this task: Muse can take this type of action for the entire task"
  > — "Allow for this site: Muse can take this type of action for this website in the future without asking again"
  > — "Always allow: Muse can take this type of action for this Connector in the future, without asking again"
  > — "Deny: Muse won't proceed this one time"
  > "You can tap See task details to see additional details about the task before deciding what permission to grant."
  > "Comply with the Muse Terms." / "These contain important information about your responsibilities and what you must not use Muse for." (the Help Center links "Muse Terms" to https://agent.meta.ai/terms)
- **How Muse handles your privacy, safety and security** — https://www.meta.com/help/artificial-intelligence/1047255454427887/:
  > "Muse is designed to ask you to confirm before it takes certain important actions like sending an email or making a purchase. When Muse requests permission, you can review the proposed action before allowing or denying it. Permission requirements may vary depending on the action, the Connector and the default permissions you selected."
  > "Many of these approval checks are enforced outside the AI model, so they don't rely only on Muse deciding whether it should ask. You can also review Muse's activity at any time."
- **How your Muse agent browses the web** — https://www.meta.com/help/artificial-intelligence/2124746764949121/:
  > "Muse is designed to ask you to confirm before it takes certain important actions in the browser, like making a purchase. When Muse requests permission, you can review the proposed action before allowing or denying it."
- **ai.meta.com/muse FAQ** — https://ai.meta.com/muse/:
  > "Yes. Muse is designed to ask your permission before taking certain actions, like sending messages, making purchases, or sharing information with a connected app. You can choose to allow an action once, always allow it, or deny it."
  (FAQ answer text, verbatim; the question labels on this page were not captured in extraction — see §6.)
- **Muse privacy policy** — https://muse.ai/privacy (Effective September 17, 2026):
  > "By default, Muse will not take many important actions, like sending an email, without your approval. Many Connectors can also be set up so that Muse is only able to retrieve data, but not take actions [...] You can change when Muse asks for your approval in your Settings."

### 2.3 Context: Meta's own automated-approval modes (Muse Code, dev product)

- **Muse Code — Permissions and safety** — https://dev.meta.ai/docs/muse-code/permissions (Muse Code is Meta's *terminal coding agent*; different product surface, different terms; quoted as context only, `SOURCE_SUPPORTED` text / `HYPOTHESIS` relevance):
  > "**Auto-review**: the same access as Ask me, with an automated reviewer deciding eligible approval requests. When the reviewer is unavailable, it falls back to asking you."
  > "**Unrestricted**: no approval and no sandbox, with the workspace trusted for the run. [...] use it only in an already-isolated environment."
- Relevance note (`HYPOTHESIS`): Meta itself ships opt-in automated approval for its CLI agent — evidence that automated approval is not categorically forbidden in the Muse family — but the Muse **web** product's terms (§7.6) still hold the *user* to "meaningful human oversight", and the Connector line on sensitive writes ("Every use.") shows Meta's conservative default where consequences are high.

### 2.4 Meta Model API Acceptable Use Policy (developer-side calibration — added in the verification pass)

- **Meta Model API Acceptable Use Policy** — https://dev.meta.ai/legal/acceptable-use-policy:
  > "Meta is committed to promoting safe and fair use of its tools and features, including Services and Meta Materials as defined in the Meta Model API Terms of Service. For the purposes of this Acceptable Use Policy, references to the "Services" include such "Meta Materials"."
  > "We want everyone to use the Services safely and responsibly. You agree you will not use, or allow others to use, any Services, including any Outputs or Actions, or any Integrated Products (each as defined in the Meta Model API Terms of Service) to:"
  > "Use the Services to operate AI agents (including models, harnesses, or other components thereof) or automated systems, or otherwise take Actions in ways that evade human oversight or accountability, including to:"
  > — "Circumvent, disable, or evade human review, monitoring, or other oversight controls applicable to the Services"
  > — "Use the Services to autonomously interact with systems or services in a manner that violates the terms of service or acceptable use policies of those systems or services"
  > — "Take consequential or irreversible actions through connected accounts, tools, or services, including entering binding legal commitments or executing destructive operations in production environments, without appropriate authorization, human oversight, review, and confirmation mechanisms"
  > "Meta may, in its sole discretion, grant exceptions to this Acceptable Use Policy for legitimate cybersecurity research, educational purposes, governmental use cases, or other circumstances where Meta determines that adequate safeguards are in place to mitigate the potential harms addressed by this policy. To inquire about obtaining an exception, contact aup_exceptions@meta.com."
- Scope note (`HYPOTHESIS`): this AUP governs the Meta Model API/developer surfaces ("Services ... as defined in the Meta Model API Terms of Service"); the Muse Supplemental ToS contains no reference to it (checked for "Model API", "Acceptable Use", "dev.meta.ai" — absent). It is a calibration signal for where Meta draws the oversight line, not a direct restriction on muse.ai consumer use (`UNVERIFIED` whether Meta would analogize).

---

## 3. Chrome Web Store policy mapping

Policy catalog: https://developer.chrome.com/docs/webstore/program-policies/ (hub) and single-page version https://developer.chrome.com/docs/webstore/program-policies/policies. No CWS policy names "automation" or "auto-clicking" as a category; the rows below are the operative ones for *this* extension. "Our status" assumes the build as shipped in this repo: MV3, version 1.6.0, minimum Chrome 116, zero dependencies, no `eval`/`new Function`, no remote scripts, explicit extension-pages CSP, content script on `https://muse.ai/*` + `https://*.muse.ai/*` only, `permissions: ["storage","alarms"]`, `chrome.storage.local` only, no telemetry (verified against `extension/manifest.json`, 2026-10-09; the operator answers live in `store/CWS_SUBMISSION_PACK.md`).

| # | Policy (official page) | Applies to this extension? | Evidence (verbatim, abbreviated) | Our status / risk |
|---|------------------------|----------------------------|-----------------------------------|-------------------|
| 1 | **Single purpose** — Quality Guidelines §1 (https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines; page Last updated 2024-07-10) | Yes | "An extension must have a single purpose that is narrow and easy to understand. Don't create an extension that requires users to accept bundles of unrelated functionality." | **Compliant** — one narrow purpose (click Allow on Muse approval cards). Keep it the only feature; do not bundle extras. |
| 2 | **Use of Permissions** (…/permissions) | Yes | "Request access to the narrowest permissions necessary to implement your Product's features or services. If more than one permission could be used to implement a feature, you must request those with the least access to data or functionality. Don't attempt to "future proof" your Product by requesting a permission that might benefit services or features that have not yet been implemented." | **Compliant if** the declared set stays at `storage` + `alarms` and hosts at exactly `https://muse.ai/*` + `https://*.muse.ai/*`, each justified in the dashboard. Justify the subdomain wildcard explicitly; no `tabs`/`scripting`/`webRequest`/`cookies`/`downloads`. |
| 3 | **Privacy Policy** (…/privacy) | Yes — extension handles user data | "If your Product handles any user data, then you must post an accurate and up to date privacy policy." | **Action needed** — post privacy policy URL in dashboard; ensure it matches actual behavior (no collection/transmission). |
| 4 | **User Data FAQ** (…/user-data-faq; page Last updated 2016-04-23) | Yes | Q2 lists "Clipping or scraping content from a website that the user visits, such as taking screenshots or capturing data from a web page" as *handling* user data; Q3: "Yes. Extensions are required to disclose how they handle user data, even when data is processed or stored locally on a user's device and is not transmitted to external servers or third parties." | **Action needed** — reading the approval-card DOM counts as handling (website content). Local-only is *not* an exemption from disclosure. Disclose in listing + privacy policy + privacy tab. |
| 5 | **Limited Use** (…/limited-use) | Yes | "Extensions may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose, including related operational purposes, such as maintaining, securing, or measuring the performance and reliability of those features."; "Collection and use of web browsing activity is prohibited, except to the extent required for a user-facing feature described prominently in the Product's Chrome Web Store page and in the Product's user interface."; "Limit your use of user data to providing or improving your single purpose"; "The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements." | **Compliant with conditions** — DOM reading is required for the disclosed feature (finding the Allow button) and must be described prominently; no web-browsing-activity collection (no history/URL logging); add the Limited Use affirmative statement to the privacy policy/site. |
| 6 | **Disclosure Requirements** (…/disclosure-requirements) | Yes | "If your Product handles any user data, then prior to installation, it must: 1. Prominently disclose what user data will be collected and how it will be used. 2. Obtain the user's affirmative and informed consent for such use." | **Action needed** — store description must state plainly that the extension reads/observes approval cards on muse.ai and what it does with them (clicks Allow; nothing leaves the browser). |
| 7 | **Handling Requirements** (…/data-handling) | Yes | "If your product collects any user data, it must handle the user data securely, including transmitting it via modern cryptography." | **Low risk** — nothing transmitted; keep it that way. |
| 8 | **MV3 Additional Requirements — remote code** (…/mv3-requirements) | Yes | "the full functionality of an extension must be easily discernible from its submitted code [...]"; "The extension may reference and load data and other information sources that are external to the extension, but these external resources must not contain any logic."; violations include "Using JavaScript's `eval()` method or other mechanisms to execute a string fetched from a remote source"; "If we are unable to determine the full functionality of your extension during the review process, we may reject your submission or remove it from the store." | **Compliant if** the build truly has zero dependencies, no `eval`/`new Function`, no remotely fetched logic. Declare "No, I am not using remote code" in the dashboard and keep it true; the repo's lint gate (`scripts/lint.mjs`) enforces this on build. |
| 9 | **Misleading or Unexpected Behavior** (…/unexpected-behavior) | Yes | "We do not allow products that deceive or mislead users, including in the content, title, description, or screenshots."; "Descriptions of your product must directly state the functionality so that users have a clear understanding of the product they are adding." | **Key listing risk** — say "automatically clicks the Allow button on Muse approval cards" in the description; avoid euphemisms ("smooth workflow") that could read as hiding the automation. |
| 10 | **Malicious and Prohibited Products** (…/malicious-and-prohibited) | Considered; main clause N/A | "Do not facilitate unauthorized access to content on websites, such as circumventing paywalls or login restrictions." | **Not applicable** (`HYPOTHESIS`) — extension works inside the user's own authenticated session and clicks a UI control the user could click manually; it does not build unauthorized access. Keep it that way: never automate logins, never touch CAPTCHAs. |
| 11 | **Impersonation & Intellectual Property** (…/impersonation-and-intellectual-property) | Yes — naming/listing | "Don't pretend to be someone else, and don't represent that your product is authorized by, endorsed by, or produced by another company or organization, if that is not the case."; "Don't infringe on the intellectual property rights of others, including patent, trademark, trade secret, copyright [...]" | **Attention item** — "Muse" is Meta's product name. Use it nominatively ("works with Muse / muse.ai"), add an "unofficial / not affiliated with Meta" disclaimer in the listing and README, avoid Meta logos or look-alike branding in icon/screenshots. |
| 12 | **Listing Requirements** (…/listing-requirements) | Yes | "Ensure your product's listing information is up to date, accurate, and comprehensive. We don't allow extensions with misleading, inaccurate, incomplete, improperly formatted, non-descriptive, out of date, or inappropriate metadata [...]"; "All information provided in the privacy fields of your extension must be up to date and accurate. If the information listed in your privacy fields contradicts the information provided in your privacy policy, or the behavior of your extension, your extensions may be removed from the Store." | **Action needed** — keep description, privacy tab, and privacy policy mutually consistent. Avoid keyword-spam. |
| 13 | **Minimum Functionality** (…/minimum-functionality) | Yes | "Extensions must provide a basic degree of functionality and utility [...]" | **Compliant** — the extension performs a discrete, functioning action. |
| 14 | **Code Readability** (…/code-readability) | Yes | "Developers must not obfuscate code or conceal functionality of their extension." | **Compliant if** source is readable; keep any minification in the allowed forms, or submit readable code (small codebase — easiest to ship unminified). |
| 15 | **Best Practices** (…/best-practices) | Process items | "Include detailed information in the single purpose field regarding your extension's primary functionality." | **Action needed** — fill the dashboard single-purpose field carefully. |
| 16 | **2-Step Verification** (…/two-step-verification) | Publisher-side | "2-Step Verification is required for all developer accounts prior to publishing an extension [...]" | **Action needed** — enable 2SV on the publisher Google account before submission. |
| 17 | **Spam and Abuse** (…/spam-and-abuse) | Nearest "on behalf" text | "We don't allow extensions that send messages on behalf of the user without giving the user the ability to confirm the content and intended recipients." | **Not applicable on its face** — the extension sends no messages and interacts with no recipients. It is, however, the closest published CWS text about acting "on the user's behalf": keep the user able to review and disable (toggle, log), and describe the auto-click plainly (row 9). |

**Automation / "click on your behalf" territory (`HYPOTHESIS` after catalog review).** No CWS program policy names UI automation or auto-clicking as a category. A keyword scan of every fetched policy page (`automat*`, `behalf`) finds the words only in: "automatically gathered user data" (Limited Use context), "Automated emails" (review-process, developer communications), and the Spam and Abuse §4 sentence about sending messages "on behalf of the user" (row 17). This extension is therefore governed by the general policies — single purpose, permissions, disclosure, unexpected behavior — not a dedicated automation rule. The nearest language that could be argued against auto-approval is row 17 (messages on behalf without user confirmation) and row 9 (duty to describe functionality plainly); neither prohibits it as written.

**Bottom line for Q2 (`HYPOTHESIS`):** With the conditions above, the extension appears **policy-compliant as a matter of stated CWS program policy**. The realistic risk is *review friction*, not policy prohibition: permission justification questions and listing-clarity scrutiny (see §4.3).

### 3.1 CWS review friction for auto-click/auto-approve extensions — COMMUNITY_REPORTED

- Reddit r/chrome_extensions, "Just got 4 extensions rejected in 3 days..." (Dec 2025): reports of stricter automated checks; specific triggers reported: description words "block/remove/hide" flagged for deceptive behavior; tab permissions asking for justification video; elimination of permissions not used "within the first 30 seconds"; a 30-second screen recording helped permissions review. URL: https://www.reddit.com/r/chrome_extensions/comments/1qtb6fn/just_got_4_extensions_rejected_in_3_days_and_2/ (`COMMUNITY_REPORTED`; single anecdote, not policy — treat as review-tactics signal only.)
- Live public listings in the same product category (verified publicly):
  - **Claude Auto-Approve & Reconnect** — https://chromewebstore.google.com/detail/claude-auto-approve-recon/oigfnededckmnobklpofnfocijapmnlf — fetched live (v1.3.0, updated July 8, 2026; whitelist-based auto-click for claude.ai; history log; `chrome.storage.local` only; "Nothing is ever sent to an external server"). `COMMUNITY_REPORTED` (developer-published listing).
  - **ChatGPT MCP Auto-Approve** — https://chromewebstore.google.com/detail/chatgpt-mcp-auto-approve/fmehlhilkihlmhifaagfflpjjgleocah (mirror listing id `eojkdjlmaljgpnlcnpiocpgajokphejh`) — "Automatically clicks the 'Allow' button when using MCP tools on ChatGPT." `COMMUNITY_REPORTED`.
  - **Github Auto Approve** — https://chromewebstore.google.com/detail/github-auto-approve/pidhaefckmljflidiacaclfokiidnddg — auto-approves PRs. `COMMUNITY_REPORTED`.
  - **AutoApprove - X Followers** — https://chromewebstore.google.com/detail/autoapprove-x-followers/igpknjcckfehlcemokekphpmajndbecl — auto-accepts follower requests; "no data ever leaves your browser." `COMMUNITY_REPORTED`.
- Ambiguous removals: some Facebook auto-approve/group-automation extensions were removed from CWS (chrome-stats records, e.g. removals dated 2024-11-10 and 2025-01-31) — publicly available reasons involve data extraction/trust issues; the cause for any given removal is **not verifiable**. Do **not** treat as evidence that auto-approval clicking itself causes removal. (`COMMUNITY_REPORTED`, cause `UNVERIFIED`.)
- Third-party precedent for Muse approvals specifically: VS Code Marketplace extension "Muse Code (Unofficial)" ships a fail-closed `museCode.autoApproveLowRisk` option ("read-only file access is approved automatically, once-only scope, never widened... Everything else still asks"), and states it is "not affiliated with Anthropic or Meta". URL: https://marketplace.visualstudio.com/items?itemName=corona10.muse-code-unofficial (`COMMUNITY_REPORTED`; different product surface — Muse Code CLI, not Muse web chat — but shows third-party automation of Muse approvals is already public without visible objection.)
- *URL liveness re-check (2026-10-09):* all four store listings and the VS Code item respond HTTP 200; the Reddit thread blocks non-browser clients (curl 000) — retained as a labeled anecdote.

---

## 4. Mitigation recommendations

*These are product/listing recommendations, not legal advice. They are designed to reduce (a) tension with Muse ToS §7.6 and Meta's approval design, and (b) Chrome Web Store review friction.*

### 4.1 Product-design mitigations (reduce the Q1 tension)

1. **Scope by default, not blanket.** Ship with a whitelist/allowlist model (auto-approve only categories the user explicitly enables) and a hard blocklist that always stays manual: send/post/publish/message, payments/purchases, deletions, account/permission changes. This mirrors Meta's own line that "Sensitive writes cannot be set to Always allow" and that sensitive writes require "Allow once · Deny" every use. *(Directly lowers the §7.6 exposure.)*
2. **Prefer clicking only the one-time approval option.** If Muse's approval UI offers "Allow once / Allow for this task / Allow for this site / Always allow", restrict auto-clicking to "Allow once" (or the closest one-time action) and leave durable grants ("Always allow") to the human. Rationale: §7.6's adverse phrase is precisely about *pre-authorization* ("granting pre-authorization for such actions") — one-time forwarding is the least adverse interpretation; durable pre-authorization is the most adverse. *(Product decision required — see §5.)*
3. **Never automate anything adjacent to safety controls.** No auto-solving CAPTCHAs, no login automation, no auto-clicking "Deny", no interaction outside muse.ai, no interaction with unknown dialog types (fail closed: unknown = leave manual).
4. **Keep human-oversight affordances.** Visible on/off toggle and status badge; kill switch; optional delay before clicking; a local audit log of what was auto-approved (inspirational precedent: Claude Auto-Approve keeps a 1,000-entry log; Muse Code Unofficial ships a "judge" second-opinion layer). These are cheap ways to keep the user's oversight "meaningful" in the §7.6 sense.
5. **Stay local-only, zero-dependency, no-eval.** `chrome.storage.local` only, no telemetry, no remote config, no external fetch. This is simultaneously the strongest ToS-side story ("no data collection") and the cleanest CWS posture (Limited Use / remote-code); the repo's lint gate (`scripts/lint.mjs`) and build script are the enforcement point.
6. **In-product + README notice.** Tell users they remain responsible for their Muse session under the Muse Terms (link §7.6 obligation in plain words: "You remain responsible for reviewing your agent's actions; auto-approval reduces the per-action review step; use the Muse Activity log"). Do not advertise it as "never review anything again."

### 4.2 Store-listing mitigations (CWS review)

1. **Description must state the function directly, in the first lines:** e.g. "Automatically clicks the 'Allow' button on approval cards in your Muse (muse.ai) chat so long-running agent sessions keep going. Works only on muse.ai, in your own session. No data collection; settings stay in your browser." Avoid trigger words reported in CWS enforcement anecdotes ("block", "remove", "hide", "bypass", "fake"); avoid euphemism that hides the automation (Unexpected-Behavior policy).
2. **Name/branding discipline:** keep "Muse Auto-Allow" as a nominative reference, add "Not affiliated with, endorsed by, or sponsored by Meta. Muse is a Meta product; this is an unofficial companion tool." Keep Meta/Muse logos and look-alike icons out of the icon/screenshots (Impersonation & IP policy). Consider adding "(Unofficial)" to the listing title.
3. **Privacy tab disclosures (consistent everywhere):** disclose handling of website content (reading the approval card to find the button); certify no sale, no unrelated transfer, no creditworthiness use; state no data collection/transmission; link the privacy policy. Add the Limited Use affirmative statement to the privacy policy ("...adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements").
4. **Single-purpose field:** "Clicks the 'Allow' button on Muse approval cards in the user's own muse.ai session when the user enables it." Nothing else.
5. **Permissions:** keep the declared set minimal — `storage`, `alarms`, and hosts `https://muse.ai/*` + `https://*.muse.ai/*`. The dashboard justification must explain each: why `alarms` (process approvals in background tabs) and why the subdomain wildcard (where approval pages render). Declare "No remote code" and keep it true (zero deps, no eval). Deliberately NOT requested: `tabs`, `scripting`, `webRequest`, `<all_urls>`, `cookies`, `downloads`.
6. **Metadata consistency:** description ↔ privacy tab ↔ privacy policy ↔ actual behavior must agree (Listing Requirements — mismatches are a removal trigger).

### 4.3 Reviewer notes (what to put in the submission/support page)

1. Explain the flow in 3–4 sentences: content script on muse.ai finds approval cards rendered by Muse and clicks the primary "Allow" (one-time) control when the extension toggle is on; nothing leaves the browser.
2. Why the host permission is needed: "the approval card only exists inside muse.ai pages; no other site is touched." Also explain the `alarms` permission (background-tab processing) and the subdomain wildcard.
3. Include a **30–60s screen recording** (community-reported friction: reviewers may otherwise ask for a video or stall permissions review). Show: toggle on → approval card appears → extension clicks Allow → session continues; also show the default-off state and the blocklist.
4. Testing note: the reviewer needs their own Muse account (muse.ai is login-gated). Describe how to trigger an approval card (ask Muse to perform an action that requires permission) and note that sensitive actions require approval by design, so they are testable.
5. State explicitly: no analytics, no remote code, `chrome.storage.local` only, single purpose, single host scope.

### 4.4 Terms-risk hygiene (owner-side; not legal advice)

1. Record the risk-acceptance decision in writing alongside this doc (what was known at launch, what design mitigations were applied).
2. Re-check the Muse Terms before publish and after any Meta update: muse.ai/terms carries "Last updated: September 8, 2026" and the Connector terms "Effective September 18, 2026" — both are new and are changing while the product evolves.
3. If the owner wants a lower-risk posture: consider asking Meta for guidance through the Muse product's own "Report an issue"/Help & Support channel (ToS §10 references reporting concerns); **no official channel for extension authorization was found** (`UNVERIFIED`).
4. Keep marketing aligned with the product reality: "cuts repetitive approvals for actions you trust" (scoped) is far more defensible than "approve everything automatically / skip all confirmations".

---

## 5. What the owner still must decide

1. **Blanket vs scoped auto-approval** — the single biggest lever on Q1. Options: (a) click Allow on everything (accept MEDIUM–HIGH terms tension); (b) whitelist-first with hard blocklist for send/post/pay/delete (recommended; MEDIUM at most); (c) click only "Allow once"-class one-time options and never "Always allow" (most conservative; LOW–MEDIUM).
2. **Which buttons the extension clicks** — verify in the live UI which approval options exist on a card (Help Center lists: Allow once / Allow for this task / Allow for this site / Always allow / Deny) and decide the allowed set. (Product detail to verify; assumption flagged in §6.)
3. **Whether to disclose the Muse-terms tension to users** (README/listing FAQ: "you remain responsible under Muse's Terms; auto-approval reduces per-action review") and whether to accept the residual interpretive risk anyway.
4. **Naming/branding** — final call on "Muse Auto-Allow" with unofficial disclaimer vs. a neutral name; icon/screenshot design avoiding Meta marks.
5. **Whether to seek Meta's explicit blessing** (informal contact / wait for extension-specific terms) vs. launching on own risk; if publishing now, decide the re-check cadence (e.g., before every release, and on any Muse Terms update).
6. **Exact sensitive-action blocklist** — final list of action types that must always remain manual (recommended: messaging/sending, purchases/payments, deletions, publishing, permission changes, anything unrecognized).
7. **Reviewer test kit** — who writes the demo video + test instructions, and on which Muse account (muse.ai requires a signed-in account for testing).
8. **Subdomain wildcard** — the manifest currently requests `https://muse.ai/*` and `https://*.muse.ai/*`. Decide whether approvals render on subdomains (keep both, justify the wildcard to reviewers) or whether the wildcard can be dropped (narrower = less review friction).

---

## 6. UNVERIFIED / could not check

1. **No official statement specifically about browser extensions or UI auto-clicking on muse.ai.** Absence confirmed after checking: https://muse.ai/terms, https://agent.meta.ai/terms, https://muse.ai/privacy, https://muse.ai/platform/terms, https://muse.ai/platform/docs, Meta Help pages 1385290430137537 / 1047255454427887 / 2124746764949121, https://www.facebook.com/terms/, https://www.facebook.com/legal/ai-terms, https://www.facebook.com/legal/automated_data_collection_terms, https://ai.meta.com/muse/, https://dev.meta.ai/docs/muse-code/*, https://dev.meta.ai/legal/acceptable-use-policy. `UNVERIFIED` — nothing found either way; this is the single most important gap for Q1.
2. **Whether Meta would treat auto-clicking approval cards as a §7.6 breach, a §4(16) breach, or a Meta ToS §3.2(7) "technological measures" circumvention.** No enforcement actions or public positions found. `UNVERIFIED` + `HYPOTHESIS` only.
3. **No precedent of enforcement against (or approval of) an auto-approve tool for muse.ai.** `UNVERIFIED`.
4. **CWS review outcome for this exact extension is unknowable in advance.** Live analogues exist (Claude/ChatGPT auto-approve listings) but their approval history is not public. `UNVERIFIED`.
5. **Exact composition of Muse's approval card / which options render for which action types.** Meta Help describes the option set; the live UI was not inspected (no account access in this research; no Chrome allowed). `UNVERIFIED` — verify before finalizing the click target.
6. **Nature of specific CWS rejections reported in the Dec 2025 Reddit thread** (anecdotal, unverified counts, may reflect that developer's experience only). `COMMUNITY_REPORTED`.
7. **Cause of removals of some Facebook group auto-approve tools** on chrome-stats (no public reasons stated; likely data-scraping related but not confirmed). `UNVERIFIED` cause.
8. **Regional differences:** the Meta AI Terms page routes by region (UK / Brazil / European-region variants linked); only the global page was fetched, and its "Acceptable Uses" bullet list was not captured in extraction. If targeting non-US users, the regional AI Terms and local consumer law may differ. `UNVERIFIED`.
9. **ai.meta.com/muse FAQ question labels** were not captured in extraction; the FAQ *answer* text is verbatim and is what is quoted in §2.2. (Minor.)
10. **Whether the Meta Model API Acceptable Use Policy could ever be read to reach muse.ai consumer use** — no statement found; the Muse consumer ToS does not reference it. `UNVERIFIED`.

---

## 7. Revision & verification log (second pass — 2026-10-09)

This document was drafted in an earlier pass; this second pass re-verified every quotation against freshly fetched pages before finalizing the file at `docs/MUSE_TOS_RESEARCH.md`.

**Verification:** ≈130 quoted-string and heading checks run against live re-fetches (Meta/Muse pages, all CWS policy pages, the Meta Model API AUP). Final status: **every quotation in this document was confirmed verbatim on its cited page on 2026-10-09.** Apparent discrepancies resolved during verification:

- ADC definition quotes — a partial first fetch had missed them; confirmed on full re-fetch.
- Single-purpose quote — the first fetch of the quality-guidelines page was partial; confirmed on re-fetch (page Last updated 2024-07-10).
- ai.meta.com FAQ question label ("Does Muse ask before it acts on my behalf?") — not capturable; the document quotes the verified answer text instead.
- Connector "Prohibited Practices" quotes — re-attributed to https://muse.ai/platform/terms (Muse Connector Policies section); the earlier draft cited platform/docs. Item 08 restored to its full sentence.

**Corrections applied vs the first-pass draft:**

1. Connector policies attribution fix (above).
2. Meta AI Terms description corrected: the page is a regional router; an unverified "no deceiving or misleading" characterization was removed; the "Acceptable Uses" list is marked not-captured (§6.8).
3. Build assumptions aligned to the actual manifest (`storage` + `alarms`; hosts `muse.ai/*` + `*.muse.ai/*`; version 1.6.0; minimum Chrome 116) instead of the draft's "storage only / muse.ai only" assumption.
4. Reviewer/decision notes updated for the wildcard host and login-gated testing; unverified availability claims removed.

**Additions:**

- §2.1(a): §9 "Meta's Right to Refuse" quote; §2.2: exact approval-option text and the Help Center's link of "Muse Terms" to agent.meta.ai/terms; §2.1(e): Muse Connector Policies quotes (intro + items 03/05/08).
- §2.4: Meta Model API Acceptable Use Policy (new official source for the "acceptable-use" question; scope caveat).
- §3: Spam and Abuse row (row 17) + the automation keyword-scan note; §5 item 8; §6 items 9–10.

**Community items:** §3.1 community-reported listings retained as labeled; URL liveness re-checked 2026-10-09 (all four store listings + the VS Code item respond 200; the Reddit thread blocks non-browser clients — retained as an anecdote). Community-reported items were not re-verified beyond liveness.

---

## Appendix — Source index (fetched / re-verified 2026-10-09)

**Meta / Muse official:**
- https://muse.ai/terms — Muse Supplemental Terms of Service (mirror: https://agent.meta.ai/terms; content identical on re-fetch)
- https://muse.ai/privacy — Muse Privacy Policy
- https://muse.ai/platform/terms — Muse Connector Terms (includes the "Muse Connector Policies" / Prohibited Practices list)
- https://muse.ai/platform/docs — Muse Connector guidelines
- https://www.meta.com/en-gb/help/artificial-intelligence/1385290430137537/ — How Muse works with your guidance and approval
- https://www.meta.com/help/artificial-intelligence/1047255454427887/ — How Muse handles your privacy, safety and security
- https://www.meta.com/help/artificial-intelligence/2124746764949121/ — How your Muse agent browses the web
- https://ai.meta.com/muse/ — Muse product page (FAQ)
- https://www.facebook.com/terms/ — Meta Terms of Service
- https://www.facebook.com/legal/ai-terms — Meta AI Terms of Service (regional router page)
- https://www.facebook.com/legal/automated_data_collection_terms — Meta Automated Data Collection Terms
- https://dev.meta.ai/legal/acceptable-use-policy — Meta Model API Acceptable Use Policy
- https://dev.meta.ai/docs/muse-code/permissions — Muse Code permissions & safety (context)

**Chrome Web Store official:**
- https://developer.chrome.com/docs/webstore/program-policies/ (hub) and /policies (single page)
- Subpages quoted: /quality-guidelines, /permissions, /limited-use, /privacy, /disclosure-requirements, /data-handling, /user-data-faq, /mv3-requirements, /unexpected-behavior, /malicious-and-prohibited, /impersonation-and-intellectual-property, /listing-requirements, /minimum-functionality, /code-readability, /best-practices, /two-step-verification, /spam-and-abuse, /deceptive-installation-tactics
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/ — Fill out the privacy fields
- https://developer.chrome.com/docs/webstore/review-process — review outcomes (skimmed)
- Page-level "Last updated" stamps observed: 2016-04-23 (User Data FAQ) through 2024-07-10 (Quality guidelines, Listing requirements, Best Practices, Deceptive Installation Tactics); others 2022-11-01 / 2024-04-03.

**Community / third-party (COMMUNITY_REPORTED):**
- Reddit r/chrome_extensions 1qtb6fn (CWS enforcement anecdote, Dec 2025)
- CWS listings: Claude Auto-Approve & Reconnect (oigfnededckmnobklpofnfocijapmnlf), ChatGPT MCP Auto-Approve (fmehlhilkihlmhifaagfflpjjgleocah / eojkdjlmaljgpnlcnpiocpgajokphejh), Github Auto Approve (pidhaefckmljflidiacaclfokiidnddg), AutoApprove - X Followers (igpknjcckfehlcemokekphpmajndbecl)
- chrome-stats.com — removal records for Facebook group auto-approve tools (cause unverified)
- VS Code Marketplace — "Muse Code (Unofficial)" (corona10.muse-code-unofficial), fail-closed autoApproveLowRisk, "not affiliated with Anthropic or Meta"
- preuve.ai / Dexerto (Sept 2026) — "Allow Always" Marketplace incident (context on why approvals matter)
