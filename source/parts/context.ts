import {Context as TelegrafContext} from 'telegraf';

import {Position, Rule, Type} from '../lib/notify-rules';

export interface Status {
	types?: readonly string[];
}

export interface Graph {
	positions: Position[];
	type?: Type;
	timeframe?: string;
	positionsPage?: number;
}

export interface Session {
	graph: Graph;
	notify?: Partial<Rule>;
	page?: number;
	status?: Status;
}

export interface MyContext extends TelegrafContext {
	readonly session: Session;
}
