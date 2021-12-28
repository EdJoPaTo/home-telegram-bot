import {Context as BaseContext, SessionFlavor} from 'grammy';

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

export type MyContext = BaseContext & SessionFlavor<Session>;
