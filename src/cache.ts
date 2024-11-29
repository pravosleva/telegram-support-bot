import { Cache, Config } from './interfaces';
import TelegramAddon from './addons/telegram';
import * as YAML from 'yaml';
import * as fs from 'fs';
import { getConfigPath, log } from '~/utils';

const cache: Cache = {
  ticketID: undefined,
  ticketIDs: new Set(),
  ticketStatus: {},
  ticketSent: [],
  html: '',
  noSound: '',
  markdown: '',
  io: {},
  bot: {} as TelegramAddon,
  config: {} as Config,
};

log({ label: '- cache', msgs: [] })

cache.config = YAML.parse(
  fs.readFileSync(getConfigPath(process.env.NODE_ENV), 'utf8'),
);

export default cache;
