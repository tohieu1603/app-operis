#!/usr/bin/env node
/**
 * Scrape Zalo group members from a public group link via zca-js.
 *
 * Usage:
 *   node extensions/zalozcajs/scripts/scrape-group.mjs --link "https://zalo.me/g/..." [options]
 *
 * Options:
 *   --link, -l        Zalo group link (required)
 *   --credentials, -c Path to credentials JSON file (e.g. desktop-app session file)
 *   --account, -a     Account ID (default: "default", used if --credentials not set)
 *   --max-pages, -m   Max pages to scrape (default: all)
 *
 * Credential resolution order:
 *   1. --credentials flag (direct path to session JSON)
 *   2. ~/.operis/credentials/zalozcajs/{account}.json
 *
 * Output: JSON to stdout
 *   { success: true, data: { groupId, groupName, members: [...], total } }
 *   { success: false, error: "..." }
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Zalo } from "zca-js";

// ── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { link: "", account: "default", maxPages: 0 };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--link":
      case "-l":
        parsed.link = args[++i] || "";
        break;
      case "--account":
      case "-a":
        parsed.account = args[++i] || "default";
        break;
      case "--max-pages":
      case "-m":
        parsed.maxPages = parseInt(args[++i] || "0", 10) || 0;
        break;
    }
  }

  if (!parsed.link) {
    console.error(JSON.stringify({ success: false, error: "Missing --link argument" }));
    process.exit(1);
  }

  return parsed;
}

// ── Credentials ─────────────────────────────────────────────────────────────

function credentialsPath(accountId) {
  return join(homedir(), ".operis", "credentials", "zalozcajs", `${accountId}.json`);
}

async function loadCredentials(accountId) {
  const path = credentialsPath(accountId);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw);
}

// ── Delay helper ────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main scrape logic ───────────────────────────────────────────────────────

async function scrapeGroup(link, accountId, maxPages) {
  // 1. Load credentials & login
  const creds = await loadCredentials(accountId);
  if (!creds) {
    return { success: false, error: `No credentials for account "${accountId}" at ${credentialsPath(accountId)}` };
  }

  let api;
  try {
    const zalo = new Zalo();
    api = await zalo.login(creds);
  } catch (err) {
    return { success: false, error: `Login failed: ${err.message}` };
  }

  // 2. Fetch first page
  let firstPage;
  try {
    firstPage = await api.getGroupLinkInfo({ link, memberPage: 1 });
  } catch (err) {
    return { success: false, error: `Failed to get group info from link: ${err.message}` };
  }

  const groupId = firstPage.groupId;
  const groupName = firstPage.name || "Unknown";
  const totalMembers = firstPage.totalMember || 0;
  const allMembers = [...(firstPage.currentMems || [])];
  let hasMore = !!firstPage.hasMoreMember;

  // 3. Pagination
  let page = 2;
  while (hasMore) {
    if (maxPages > 0 && page > maxPages) break;
    if (allMembers.length >= totalMembers) break;

    await delay(500);

    try {
      const pageInfo = await api.getGroupLinkInfo({ link, memberPage: page });
      const pageMembers = pageInfo.currentMems || [];
      if (pageMembers.length === 0) break;

      allMembers.push(...pageMembers);
      hasMore = !!pageInfo.hasMoreMember;
    } catch {
      // Stop pagination on error, return what we have
      break;
    }

    page++;
  }

  // 4. Get accurate roles via getGroupInfo
  let creatorId = firstPage.creatorId || "";
  let adminIds = firstPage.adminIds || [];

  try {
    const groupInfoResponse = await api.getGroupInfo(groupId);
    const groupData = groupInfoResponse?.gridInfoMap?.[groupId];
    if (groupData) {
      creatorId = groupData.creatorId || creatorId;
      adminIds = groupData.adminIds || adminIds;
    }
  } catch {
    // Use roles from getGroupLinkInfo as fallback
  }

  // 5. Transform members
  const members = allMembers.map((m) => {
    const userId = m.id || m.userId || "";
    let role = "MEMBER";
    if (userId === creatorId) role = "OWNER";
    else if (adminIds.includes(userId)) role = "ADMIN";

    return {
      userId,
      displayName: m.dName || m.displayName || m.zaloName || "Unknown",
      avatar: m.avatar || undefined,
      role,
    };
  });

  return {
    success: true,
    data: {
      groupId,
      groupName,
      members,
      total: members.length,
    },
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

const { link, account, maxPages } = parseArgs();

try {
  const result = await scrapeGroup(link, account, maxPages);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
} catch (err) {
  console.log(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
}
