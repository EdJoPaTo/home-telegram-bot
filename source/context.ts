import type { Context as BaseContext, SessionFlavor } from "grammy";

import type { PublishConfig } from "./lib/config.ts";
import type { Rule } from "./lib/notify-rules.ts";

export type Session = {
	deviceClass?: string;
	notify?: Partial<Rule>;
	page?: number;
	publish?: Partial<PublishConfig>;
};

export type MyContext = BaseContext & SessionFlavor<Session>;
