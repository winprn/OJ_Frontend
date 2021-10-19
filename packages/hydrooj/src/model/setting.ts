/* eslint-disable max-len */
/* eslint-disable no-await-in-loop */
import yaml from 'js-yaml';
import { Dictionary } from 'lodash';
import moment from 'moment-timezone';
import { parseLang } from '@hydrooj/utils/lib/lang';
import { retry } from '@hydrooj/utils/lib/utils';
import { Setting as _Setting } from '../interface';
import { Logger } from '../logger';
import * as bus from '../service/bus';
import * as builtin from './builtin';

type SettingDict = Dictionary<_Setting>;

const logger = new Logger('model/setting');
const countries = moment.tz.countries();
const tzs = new Set();
for (const country of countries) {
    const tz = moment.tz.zonesForCountry(country);
    for (const t of tz) tzs.add(t);
}
const timezones = Array.from(tzs).sort().map((tz) => [tz, tz]) as [string, string][];
const langRange: Dictionary<string> = {};

for (const lang in global.Hydro.locales) {
    langRange[lang] = global.Hydro.locales[lang].__langname;
}

export const FLAG_HIDDEN = 1;
export const FLAG_DISABLED = 2;
export const FLAG_SECRET = 4;
export const FLAG_PRO = 8;

export const PREFERENCE_SETTINGS: _Setting[] = [];
export const ACCOUNT_SETTINGS: _Setting[] = [];
export const DOMAIN_SETTINGS: _Setting[] = [];
export const DOMAIN_USER_SETTINGS: _Setting[] = [];
export const SYSTEM_SETTINGS: _Setting[] = [];
export const SETTINGS: _Setting[] = [];
export const SETTINGS_BY_KEY: SettingDict = {};
export const DOMAIN_USER_SETTINGS_BY_KEY: SettingDict = {};
export const DOMAIN_SETTINGS_BY_KEY: SettingDict = {};
export const SYSTEM_SETTINGS_BY_KEY: SettingDict = {};

// eslint-disable-next-line max-len
export type SettingType = 'text' | 'yaml' | 'number' | 'float' | 'markdown' | 'password' | 'boolean' | 'textarea' | [string, string][] | Record<string, string>;

export const Setting = (
    family: string, key: string, value: any = null,
    type: SettingType = 'text', name = '', desc = '', flag = 0,
): _Setting => {
    let subType = '';
    if (type === 'yaml' && typeof value !== 'string') {
        value = yaml.dump(value);
        type = 'textarea';
        subType = 'yaml';
    }
    if (name == 'preferredEditorType') name = 'default_editor_type', family = 'code_editor';
    if (name == 'monacoTheme') name = 'default_theme', family = 'code_editor';
    if (name == 'showInvisibleChar') name = 'show_invisible_char', family = 'other_settings';
    if (name == 'formatCode') name = 'format_code', family = 'other_settings';
    return {
        family,
        key,
        value,
        name,
        desc,
        flag,
        subType,
        type: typeof type === 'object' ? 'select' : type,
        range: typeof type === 'object' ? type : null,
    };
};

export const PreferenceSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        PREFERENCE_SETTINGS.push(setting);
        SETTINGS.push(setting);
        SETTINGS_BY_KEY[setting.key] = setting;
    }
};
export const AccountSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        ACCOUNT_SETTINGS.push(setting);
        SETTINGS.push(setting);
        SETTINGS_BY_KEY[setting.key] = setting;
    }
};
export const DomainUserSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        DOMAIN_USER_SETTINGS.push(setting);
        DOMAIN_USER_SETTINGS_BY_KEY[setting.key] = setting;
    }
};
export const DomainSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        DOMAIN_SETTINGS.push(setting);
        DOMAIN_SETTINGS_BY_KEY[setting.key] = setting;
    }
};
export const SystemSetting = (...settings: _Setting[]) => {
    for (const setting of settings) {
        SYSTEM_SETTINGS.push(setting);
        SYSTEM_SETTINGS_BY_KEY[setting.key] = setting;
    }
};

const LangSettingNode = {
    family: 'setting_usage',
    key: 'codeLang',
    value: 'c',
    name: 'codeLang',
    desc: 'Default Code Language',
    flag: 0,
    subType: '',
    type: 'select',
    range: {},
};

PreferenceSetting(
    Setting('setting_display', 'viewLang', null, langRange, 'default_language'),
    Setting('setting_display', 'timeZone', 'Asia/Shanghai', timezones, 'timezone'),
    LangSettingNode,
    Setting('setting_usage', 'codeTemplate', '', 'textarea', 'default_code',
        'template_note'),
);

AccountSetting(
    Setting('setting_info', 'avatar', '', 'text', 'Avatar',
        'Allow using gravatar:email qq:id github:name url:link format.'),
    Setting('setting_info', 'qq', null, 'text', 'QQ'),
    Setting('setting_info', 'gender', builtin.USER_GENDER_OTHER, builtin.USER_GENDER_RANGE, 'Gender'),
    Setting('setting_info', 'bio', null, 'markdown', 'Bio'),
    Setting('setting_customize', 'backgroundImage',
        '/components/profile/backgrounds/1.jpg', 'text', 'Profile Background Image',
        'Choose the background image in your profile page.'),
    Setting('setting_storage', 'unreadMsg', 0, 'number', 'Unread Message Count', null, FLAG_DISABLED | FLAG_HIDDEN),
    Setting('setting_storage', 'badge', '', 'text', 'badge info', null, FLAG_DISABLED | FLAG_HIDDEN),
);

DomainSetting(
    Setting('setting_domain', 'name', 'New domain', 'text', 'name'),
    Setting('setting_domain', 'avatar', '', 'text', 'avatar', 'Will be used as the domain icon.'),
    Setting('setting_domain', 'share', '', 'text', 'Share problem with domain (* for any)'),
    Setting('setting_domain', 'bulletin', '', 'markdown', 'Bulletin'),
    Setting('setting_domain', 'langs', '', 'text', 'Allowed langs', null),
    Setting('setting_storage', 'host', '', 'text', 'Custom host', null, FLAG_HIDDEN | FLAG_DISABLED),
);

DomainUserSetting(
    Setting('setting_info', 'displayName', null, 'text', 'Display Name'),
    Setting('setting_storage', 'nAccept', 0, 'number', 'nAccept', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'nSubmit', 0, 'number', 'nSubmit', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'nLike', 0, 'number', 'nLike', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'rp', 1500, 'number', 'RP', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'rpdelta', 0, 'number', 'RP.delta', null, FLAG_HIDDEN | FLAG_DISABLED),
    Setting('setting_storage', 'rank', 0, 'number', 'Rank', null, FLAG_DISABLED | FLAG_HIDDEN),
    Setting('setting_storage', 'level', 0, 'number', 'level', null, FLAG_HIDDEN | FLAG_DISABLED),
);

const ignoreUA = [
    'bingbot',
    'Gatus',
    'Googlebot',
    'Uptime',
    'YandexBot',
].join('\n');

SystemSetting(
    Setting('setting_file', 'file.endPoint', 'http://127.0.0.1:9000', 'text', 'file.endPoint', 'Storage engine endPoint'),
    Setting('setting_file', 'file.accessKey', null, 'text', 'file.accessKey', 'Storage engine accessKey'),
    Setting('setting_file', 'file.secretKey', null, 'password', 'file.secretKey', 'Storage engine secret', FLAG_SECRET),
    Setting('setting_file', 'file.bucket', 'hydro', 'text', 'file.bucket', 'Storage engine bucket'),
    Setting('setting_file', 'file.region', 'us-east-1', 'text', 'file.region', 'Storage engine region'),
    Setting('setting_file', 'file.pathStyle', true, 'boolean', 'file.pathStyle', 'pathStyle endpoint'),
    Setting('setting_file', 'file.endPointForUser', '/fs/', 'text', 'file.endPointForUser', 'EndPoint for user'),
    Setting('setting_file', 'file.endPointForJudge', '/fs/', 'text', 'file.endPointForJudge', 'EndPoint for judge'),
    Setting('setting_smtp', 'smtp.user', null, 'text', 'smtp.user', 'SMTP Username'),
    Setting('setting_smtp', 'smtp.pass', null, 'password', 'smtp.pass', 'SMTP Password', FLAG_SECRET),
    Setting('setting_smtp', 'smtp.host', null, 'text', 'smtp.host', 'SMTP Server Host'),
    Setting('setting_smtp', 'smtp.port', 465, 'number', 'smtp.port', 'SMTP Server Port'),
    Setting('setting_smtp', 'smtp.from', null, 'text', 'smtp.from', 'Mail From'),
    Setting('setting_smtp', 'smtp.secure', false, 'boolean', 'smtp.secure', 'SSL'),
    Setting('setting_smtp', 'smtp.verify', true, 'boolean', 'smtp.verify', 'Verify register email'),
    Setting('setting_server', 'server.center', 'https://hydro.undefined.moe:8443/center', 'text', 'server.center', '', FLAG_HIDDEN),
    Setting('setting_server', 'server.name', 'Hydro', 'text', 'server.name', 'Server Name'),
    Setting('setting_server', 'server.displayName', 'Hydro', 'text', 'server.name', 'Server Name (Global Display)', FLAG_PRO),
    Setting('setting_server', 'server.url', '/', 'text', 'server.url', 'Server BaseURL'),
    Setting('setting_server', 'server.upload', '256m', 'text', 'server.upload', 'Max upload file size'),
    Setting('setting_server', 'server.cdn', '/', 'text', 'server.cdn', 'CDN Prefix'),
    Setting('setting_server', 'server.port', 8888, 'number', 'server.port', 'Server Port'),
    Setting('setting_server', 'server.xff', null, 'text', 'server.xff', 'IP Header'),
    Setting('setting_server', 'server.xhost', null, 'text', 'server.xhost', 'Hostname Header'),
    Setting('setting_server', 'server.language', 'zh_CN', langRange, 'server.language', 'Default display language'),
    Setting('setting_server', 'server.login', true, 'boolean', 'server.login', 'Allow builtin-login', FLAG_PRO),
    Setting('setting_server', 'server.message', true, 'boolean', 'server.message', 'Allow users send messages'),
    Setting('setting_server', 'server.ignoreUA', ignoreUA, 'textarea', 'server.ignoreUA', 'ignoredUA'),
    Setting('setting_limits', 'limit.problem_files_max', 100, 'number', 'limit.problem_files_max', 'Max files per problem'),
    Setting('setting_limits', 'limit.problem_files_size_max', 128 * 1024 * 1024, 'number', 'limit.problem_files_size_max', 'Max files size per problem'),
    Setting('setting_limits', 'limit.user_files', 100, 'number', 'limit.user_files', 'Max files for user'),
    Setting('setting_limits', 'limit.user_files_size', 128 * 1024 * 1024, 'number', 'limit.user_files_size', 'Max total file size for user'),
    Setting('setting_limits', 'limit.submission', 30, 'number', 'limit.submission', 'Max submission count per minute'),
    Setting('setting_limits', 'limit.pretest', 60, 'number', 'limit.pretest', 'Max pretest count per minute'),
    Setting('setting_basic', 'default.priv', builtin.PRIV.PRIV_DEFAULT, 'number', 'default.priv', 'Default Privilege', FLAG_PRO),
    Setting('setting_basic', 'discussion.nodes', builtin.DEFAULT_NODES, 'yaml', 'discussion.nodes', 'Discussion Nodes'),
    Setting('setting_basic', 'problem.categories', builtin.CATEGORIES, 'yaml', 'problem.categories', 'Problem Categories'),
    Setting('setting_basic', 'pagination.problem', 100, 'number', 'pagination.problem', 'Problems per page'),
    Setting('setting_basic', 'pagination.contest', 20, 'number', 'pagination.contest', 'Contests per page'),
    Setting('setting_basic', 'pagination.discussion', 50, 'number', 'pagination.discussion', 'Discussions per page'),
    Setting('setting_basic', 'pagination.record', 100, 'number', 'pagination.record', 'Records per page'),
    Setting('setting_basic', 'pagination.solution', 20, 'number', 'pagination.solution', 'Solutions per page'),
    Setting('setting_basic', 'pagination.training', 10, 'number', 'pagination.training', 'Trainings per page'),
    Setting('setting_basic', 'pagination.reply', 50, 'number', 'pagination.reply', 'Replies per page'),
    Setting('setting_session', 'session.keys', [String.random(32)], 'text', 'session.keys', 'session.keys', FLAG_HIDDEN),
    Setting('setting_session', 'session.secure', false, 'boolean', 'session.secure', 'session.secure', FLAG_HIDDEN),
    Setting('setting_session', 'session.saved_expire_seconds', 3600 * 24 * 30,
        'number', 'session.saved_expire_seconds', 'Saved session expire seconds'),
    Setting('setting_session', 'session.unsaved_expire_seconds', 3600 * 3,
        'number', 'session.unsaved_expire_seconds', 'Unsaved session expire seconds'),
    Setting('setting_storage', 'db.ver', 0, 'number', 'db.ver', 'Database version', FLAG_DISABLED | FLAG_HIDDEN),
    Setting('setting_storage', 'installid', String.random(64), 'text', 'installid', 'Installation ID', FLAG_HIDDEN | FLAG_DISABLED),
);

// eslint-disable-next-line import/no-mutable-exports
export let langs = {};

bus.once('app/started', async () => {
    logger.debug('Ensuring settings');
    const system = global.Hydro.model.system;
    for (const setting of SYSTEM_SETTINGS) {
        if (setting.value) {
            const current = await global.Hydro.service.db.collection('system').findOne({ _id: setting.key });
            if (!current || current.value == null || current.value === '') {
                await retry(system.set, setting.key, setting.value);
            }
        }
    }
    try {
        langs = parseLang(system.get('hydrooj.langs'));
        global.Hydro.model.setting.langs = langs;
        const range = {};
        for (const key in langs) range[key] = langs[key].display;
        LangSettingNode.range = range;
    } catch (e) { /* Ignore */ }
});

bus.on('system/setting', (args) => {
    if (args.hydrooj?.langs) {
        langs = parseLang(args.hydrooj.langs);
        global.Hydro.model.setting.langs = langs;
        const range = {};
        for (const key in langs) range[key] = langs[key].display;
        LangSettingNode.range = range;
    }
});

global.Hydro.model.setting = {
    Setting,
    PreferenceSetting,
    AccountSetting,
    DomainSetting,
    DomainUserSetting,
    SystemSetting,
    FLAG_HIDDEN,
    FLAG_DISABLED,
    FLAG_SECRET,
    FLAG_PRO,
    PREFERENCE_SETTINGS,
    ACCOUNT_SETTINGS,
    SETTINGS,
    SETTINGS_BY_KEY,
    SYSTEM_SETTINGS,
    SYSTEM_SETTINGS_BY_KEY,
    DOMAIN_SETTINGS,
    DOMAIN_SETTINGS_BY_KEY,
    DOMAIN_USER_SETTINGS,
    DOMAIN_USER_SETTINGS_BY_KEY,
    langs,
};
