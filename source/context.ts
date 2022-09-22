import type {Context as BaseContext, SessionFlavor} from 'grammy';
import type {Rule} from './lib/notify-rules.js';

export type Session = {
	notify?: Partial<Rule>;
	page?: number;
	topicFilter?: string;
};

export type MyContext = BaseContext & SessionFlavor<Session>;
