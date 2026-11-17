import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const pluginUrl = pathToFileURL(join(
  process.cwd(),
  "plugins",
  "jg-spill-age",
  "lib",
  "index.js"
)).href;

function makeSession() {
  const events = new Map();
  const surface = [];
  let nextSeq = 0;
  const session = {
    header: { id: "session-test" },
    surface: { nodes: surface },
    eventAt(seq) {
      return events.get(seq);
    },
    deriveEventMessage(event) {
      return event.data.message;
    },
    add(type, data) {
      const seq = nextSeq++;
      const event = { type, seq, data };
      events.set(seq, event);
      surface.push(seq);
      return seq;
    },
    append(type, data, options) {
      const seq = nextSeq++;
      events.set(seq, { type, seq, data });
      if (type === "tool/result" && options?.surfaceOp?.op === "replace") {
        const index = surface.indexOf(options.surfaceOp.startSeq);
        if (index >= 0) surface[index] = seq;
      } else if (type === "tool/result") {
        surface.push(seq);
      }
      return { seq };
    },
    events
  };
  return session;
}

async function runPreStep(config) {
  const hooks = [];
  const saved = [];
  const ctx = {
    on(name, handler) {
      hooks.push({ name, handler });
    },
    get(name) {
      if (name !== "spillStore") return void 0;
      return {
        async saveText(input) {
          saved.push(input);
          return {
            locator: "C:\\temp\\age-spill.txt",
            retrievalHint: "Use read with offset/limit, or grep this path to search within it."
          };
        }
      };
    },
    logger: { info() {}, warn() {} }
  };
  const { apply } = await import(pluginUrl);
  apply(ctx, config);
  const preStep = hooks.find((hook) => hook.name === "agent/pre-step").handler;
  const session = makeSession();
  return { preStep, session, saved };
}

test("按龄外置只替换超过年龄阈值且超过字符阈值的结果", async () => {
  const { preStep, session, saved } = await runPreStep({
    maxInlineTokens: 6000,
    ageCalls: 8,
    ageMinChars: 6000,
    ageHeadChars: 3000,
    ageTailChars: 1500
  });
  const oldSeq = session.add("tool/result", {
    message: {
      role: "tool",
      source: { callId: "call-old" },
      content: [{ type: "text", text: `OLD-${"x".repeat(9996)}` }]
    }
  });
  for (let index = 0; index < 25; index += 1) {
    session.add("assistant/message", { message: { role: "assistant" } });
  }
  const recentSeq = session.add("tool/result", {
    message: {
      role: "tool",
      source: { callId: "call-recent" },
      content: [{ type: "text", text: `RECENT-${"y".repeat(9994)}` }]
    }
  });
  for (let index = 0; index < 5; index += 1) {
    session.add("assistant/message", { message: { role: "assistant" } });
  }

  const oldEvent = session.events.get(oldSeq);
  await preStep({ agent: { session } }, async () => {});

  assert.equal(saved.length, 1, "只外置足够旧的那条结果");
  assert.match(saved[0].content, /OLD-/);
  assert.equal(saved[0].content.length, 10000, "完整原文进入 spill");
  assert.ok(!session.surface.nodes.includes(oldSeq), "旧结果节点被替换");
  assert.ok(session.surface.nodes.includes(recentSeq), "最近结果保持完整");
  const replacement = session.events.get(session.surface.nodes[0]);
  assert.deepEqual(Object.keys(replacement.data), Object.keys(oldEvent.data), "替换事件不得新增字段");
  assert.equal(Object.hasOwn(replacement.data, "ageSpill"), false, "DSH 只允许替换 content，不能加 ageSpill 字段");
  const replacementText = replacement.data.message.content[0].text;
  assert.match(replacementText, /Full formatted result stored at: C:\\temp\\age-spill\.txt/);
  assert.match(replacementText, /Omitted \d+ bytes/);
  assert.equal(
    [...session.events.values()].filter((event) => event.type === "compaction/prune").length,
    1,
    "替换时记录一次裁剪事件"
  );
});

test("按龄外置在 ageCalls=8 的边界上精确触发", async () => {
  const { preStep, session, saved } = await runPreStep({
    maxInlineTokens: 6000,
    ageCalls: 8,
    ageMinChars: 6000,
    ageHeadChars: 3000,
    ageTailChars: 1500
  });
  const sevenSeq = session.add("tool/result", {
    message: {
      role: "tool",
      source: { callId: "call-seven" },
      content: [{ type: "text", text: `SEVEN-${"a".repeat(7994)}` }]
    }
  });
  for (let index = 0; index < 7; index += 1) {
    session.add("assistant/message", { message: { role: "assistant" } });
  }
  await preStep({ agent: { session } }, async () => {});
  assert.equal(saved.length, 0, "只有 7 次后续模型调用时不外置");
  assert.ok(session.surface.nodes.includes(sevenSeq));

  session.add("assistant/message", { message: { role: "assistant" } });
  await preStep({ agent: { session } }, async () => {});
  assert.equal(saved.length, 1, "达到 8 次后续模型调用时外置");
  assert.equal(saved[0].content.length, 8000, "完整原文进入 spill");
  assert.ok(!session.surface.nodes.includes(sevenSeq), "达到边界后旧结果节点被替换");
});

test("未超过年龄或字符阈值时不外置，非文本结果不改写", async () => {
  const { preStep, session, saved } = await runPreStep({
    maxInlineTokens: 6000,
    ageCalls: 8,
    ageMinChars: 6000,
    ageHeadChars: 3000,
    ageTailChars: 1500
  });
  const shortSeq = session.add("tool/result", {
    message: {
      role: "tool",
      source: { callId: "call-short" },
      content: [{ type: "text", text: "short" }]
    }
  });
  for (let index = 0; index < 25; index += 1) {
    session.add("assistant/message", { message: { role: "assistant" } });
  }
  const imageSeq = session.add("tool/result", {
    message: {
      role: "tool",
      source: { callId: "call-image" },
      content: [{ type: "image", source: { kind: "attachment", id: "img" } }]
    }
  });
  for (let index = 0; index < 25; index += 1) {
    session.add("assistant/message", { message: { role: "assistant" } });
  }
  session.add("tool/result", {
    message: {
      role: "tool",
      source: { callId: "call-fresh" },
      content: [{ type: "text", text: `FRESH-${"z".repeat(9995)}` }]
    }
  });
  for (let index = 0; index < 3; index += 1) {
    session.add("assistant/message", { message: { role: "assistant" } });
  }

  await preStep({ agent: { session } }, async () => {});

  assert.equal(saved.length, 0, "短结果、图片结果和最近结果都不外置");
  assert.ok(session.surface.nodes.includes(shortSeq));
  assert.ok(session.surface.nodes.includes(imageSeq));
  assert.equal(
    [...session.events.values()].filter((event) => event.type === "compaction/prune").length,
    0
  );
});
