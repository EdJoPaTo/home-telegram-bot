import { MenuTemplate } from "grammy-inline-menu";
import { html as format } from "telegram-format";

import type { MyContext } from "./context.ts";
import * as connectedLogic from "./lib/connected-logic.ts";
import { timespan } from "./lib/format.ts";
import { getAll } from "./lib/mqtt-history.ts";

const PER_PAGE = 25;

function getRelevantTopics() {
	return getAll().filter(([topic]) => connectedLogic.isRelevantTopic(topic));
}

export const menu = new MenuTemplate<MyContext>((ctx) => {
	const topics = getRelevantTopics();
	if (topics.length <= PER_PAGE) {
		delete ctx.session.page;
	}

	const pageIndex = (ctx.session.page ?? 1) - 1;
	const offset = pageIndex * PER_PAGE;

	const lines = topics.slice(offset, offset + PER_PAGE).map(([topic, data]) => {
		const emoji = connectedLogic.fromTopic(topic, data.value);
		const parts = [emoji, format.monospace(topic)];

		if (data.time) {
			parts.push(timespan(Date.now() - data.time.getTime()));
		}

		return parts.join(" ");
	});

	if (lines.length === 0) {
		return { text: "Keine Einträge" };
	}

	const text = lines.join("\n");
	return { text, parse_mode: format.parse_mode };
});

menu.navigate(".", { text: "Update" });

menu.pagination("page", {
	getCurrentPage: (ctx) => ctx.session.page,
	getTotalPages: () => getRelevantTopics().length / PER_PAGE,
	setPage(ctx, page) {
		ctx.session.page = page;
	},
});
