import type {Context as BaseContext, SessionFlavor} from 'grammy';
import type {Rule} from './lib/notify-rules.ts';

export type Session = {
	deviceClass?: string;
	notify?: Partial<Rule>;
	page?: number;
};

export type MyContext = BaseContext & SessionFlavor<Session>;
