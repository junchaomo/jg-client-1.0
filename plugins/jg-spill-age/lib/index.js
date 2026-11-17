const name = "jg-spill-age";
const inject = ["tools"];
const GAP = "\n\n[...]\n\n";

/** Estimate text content with the same text-only formula used by DSH. */
function estimateContent(content) {
	let total = 0;
	for (const block of content) {
		if (block?.type === "text") total += Math.ceil(String(block.text ?? "").length / 4) + 4;
	}
	return total;
}

/** Freeze the replacement message without freezing event-owned source objects. */
function freezeMessage(message) {
	const content = Array.isArray(message.content)
		? message.content.map((block) => Object.freeze({ ...block }))
		: message.content;
	return Object.freeze({ ...message, content });
}

/** Join text-only tool-result content; unsupported blocks keep the result untouched. */
function textOnly(content) {
	if (!Array.isArray(content) || content.some((block) => block?.type !== "text")) return null;
	return content.map((block) => String(block?.text ?? "")).join("");
}

/** Count assistant messages after a surface node; one message is one model call. */
function assistantCallsAfter(session, seq) {
	const nodes = session.surface.nodes;
	const index = nodes.indexOf(seq);
	if (index < 0) return 0;
	let count = 0;
	for (let cursor = index + 1; cursor < nodes.length; cursor += 1) {
		if (session.eventAt(nodes[cursor])?.type === "assistant/message") count += 1;
	}
	return count;
}

function assertInteger(value, label, minimum) {
	if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`jg-spill-age: ${label} must be an integer >= ${minimum}`);
}

function resolveConfig(config = {}) {
	const resolved = {
		ageCalls: config.ageCalls,
		ageMinChars: config.ageMinChars ?? 8000,
		ageHeadChars: config.ageHeadChars ?? 3000,
		ageTailChars: config.ageTailChars ?? 1000
	};
	assertInteger(resolved.ageCalls, "ageCalls", 0);
	assertInteger(resolved.ageMinChars, "ageMinChars", 1);
	assertInteger(resolved.ageHeadChars, "ageHeadChars", 0);
	assertInteger(resolved.ageTailChars, "ageTailChars", 0);
	if (resolved.ageHeadChars + resolved.ageTailChars >= resolved.ageMinChars) {
		throw new Error("jg-spill-age: ageHeadChars + ageTailChars must be smaller than ageMinChars");
	}
	return resolved;
}

/**
 * Replace old, oversized text tool results with a bounded preview and a
 * recoverable spill path. Recent results and non-text results are untouched.
 */
async function spillOldResults(ctx, session, config) {
	const store = ctx.get("spillStore");
	if (store === void 0) return;
	const owner = session.header?.id;
	if (owner === void 0) return;
	for (const seq of [...session.surface.nodes]) {
		const event = session.eventAt(seq);
		if (event?.type !== "tool/result") continue;
		const original = session.deriveEventMessage(event);
		const text = textOnly(original.content);
		if (text === null || text.length <= config.ageMinChars) continue;
		if (text.includes("Full formatted result stored at:")) continue;
		if (assistantCallsAfter(session, seq) < config.ageCalls) continue;
		const points = Array.from(text);
		if (points.length <= config.ageHeadChars + config.ageTailChars) continue;
		const source = event.data?.message?.source ?? {};
		const callId = String(source.callId ?? event.data?.toolCallId ?? `seq-${seq}`);
		const ref = await store.saveText({
			owner: { sessionId: owner },
			source: {
				kind: "tool",
				toolName: "tool",
				callId,
				label: "age-spill"
			},
			suggestedName: "age-spill.txt",
			content: text
		});
		const head = points.slice(0, config.ageHeadChars).join("");
		const tail = points.slice(-config.ageTailChars).join("");
		const omitted = Math.max(0, Buffer.byteLength(text, "utf8") - Buffer.byteLength(head + tail, "utf8"));
		const notice = `(Omitted ${omitted} bytes. Full formatted result stored at: ${ref.locator}. ${ref.retrievalHint})`;
		const replacementText = `${head}${GAP}${tail}\n\n${notice}`;
		const message = freezeMessage({
			...original,
			content: [{ type: "text", text: replacementText }]
		});
		session.append("compaction/prune", {
			shadowedRange: { start: seq, end: seq },
			shadowedSeqs: [seq],
			shadowedTokenCount: estimateContent([{ type: "text", text }])
		});
		session.append("tool/result", {
			...event.data,
			message
		}, {
			surfaceOp: {
				op: "replace",
				startSeq: seq,
				endSeq: seq
			},
			sourceEventSeqs: [seq]
		});
		ctx.logger.info(`jg-spill-age: spilled tool result seq ${seq} (${points.length} chars, ${config.ageCalls} calls old)`);
	}
}

function apply(ctx, config) {
	const resolved = resolveConfig(config);
	ctx.on("agent/pre-step", async ({ agent }, next) => {
		try {
			await spillOldResults(ctx, agent.session, resolved);
		} catch (error) {
			ctx.logger.warn(`jg-spill-age: failed: ${String(error)}; keeping old tool results inline`);
		}
		return next();
	}, { prepend: true });
}

export { apply, inject, name };
