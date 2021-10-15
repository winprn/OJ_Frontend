import { escapeRegExp, pick } from 'lodash';
import LRU from 'lru-cache';
import { Collection } from 'mongodb';
import { LoginError, UserAlreadyExistError, UserNotFoundError } from '../error';
import {
    FileInfo, Udict, Udoc,
    User as _User, VUdoc,
} from '../interface';
import pwhash from '../lib/hash.hydro';
import { Logger } from '../logger';
import * as bus from '../service/bus';
import db from '../service/db';
import { Value } from '../typeutils';
import { ArgMethod } from '../utils';
import { PERM, PRIV } from './builtin';
import domain from './domain';
import * as setting from './setting';
import * as system from './system';
import token from './token';

const coll: Collection<Udoc> = db.collection('user');
// Virtual user, only for display in contest.
const collV: Collection<VUdoc> = db.collection('vuser');
const logger = new Logger('model/user');
const cache = new LRU<string, User>({ max: 500, maxAge: 300 * 1000 });

export function deleteUserCache(udoc: User | Udoc | string | undefined | null, receiver = false) {
    if (!udoc) return;
    if (!receiver) {
        bus.broadcast(
            'user/delcache',
            JSON.stringify(typeof udoc === 'string' ? udoc : pick(udoc, ['uname', 'mail', '_id'])),
        );
    }
    if (typeof udoc === 'string') {
        // is domainId
        for (const key of cache.keys().filter((i) => i.endsWith(`/${udoc}`))) cache.del(key);
        return;
    }
    const id = [`id/${udoc._id.toString()}`, `name/${udoc.uname.toLowerCase()}`, `mail/${udoc.mail.toLowerCase()}`];
    for (const key of cache.keys().filter((k) => id.includes(`${k.split('/')[0]}/${k.split('/')[1]}`))) {
        cache.del(key);
    }
}
bus.on('user/delcache', (content) => deleteUserCache(JSON.parse(content), true));

class User implements _User {
    _id: number;

    _udoc: Udoc;
    _dudoc: any;
    _salt: string;
    _hash: string;
    _regip: string;
    _loginip: string;

    mail: string;
    uname: string;
    hashType: string;
    priv: number;
    regat: Date;
    loginat: Date;
    perm: bigint;
    role: string;
    scope: bigint;
    _files: FileInfo[];
    [key: string]: any;

    constructor(udoc: Udoc, dudoc, scope = PERM.PERM_ALL) {
        this._id = udoc._id;

        this._udoc = udoc;
        this._dudoc = dudoc;
        this._salt = udoc.salt;
        this._hash = udoc.hash;
        this._regip = udoc.ip?.[0] || '';
        this._loginip = udoc.loginip;
        this._files = udoc._files || [];

        this.mail = udoc.mail;
        this.uname = udoc.uname;
        this.hashType = udoc.hashType || 'hydro';
        this.priv = udoc.priv;
        this.regat = udoc.regat;
        this.loginat = udoc.loginat;
        this.perm = dudoc.perm;
        this.scope = typeof scope === 'string' ? BigInt(scope) : scope;
        this.role = dudoc.role || 'default';

        for (const key in setting.SETTINGS_BY_KEY) {
            this[key] = udoc[key] ?? setting.SETTINGS_BY_KEY[key].value;
        }

        for (const key in setting.DOMAIN_USER_SETTINGS_BY_KEY) {
            this[key] = dudoc[key] ?? setting.DOMAIN_USER_SETTINGS_BY_KEY[key].value;
        }
    }

    async init() {
        await bus.serial('user/get', this);
        return this;
    }

    own(doc: any, arg1: any = false): boolean {
        if (typeof arg1 === 'bigint' && !this.hasPerm(arg1)) return false;
        return (typeof arg1 === 'boolean' && arg1)
            ? doc.owner === this._id
            : doc.owner === this._id || (doc.maintainer || []).includes(this._id);
    }

    hasPerm(...perm: bigint[]) {
        for (const i in perm) {
            if ((this.perm & this.scope & perm[i]) === perm[i]) return true;
        }
        return false;
    }

    hasPriv(...priv: number[]) {
        for (const i in priv) {
            if ((this.priv & priv[i]) === priv[i]) return true;
        }
        return false;
    }

    checkPassword(password: string) {
        const h = global.Hydro.lib[`hash.${this.hashType}`];
        if (!h) throw new Error('Unknown hash method');
        if (h(password, this._salt, this) !== this._hash) {
            throw new LoginError(this.uname);
        } else if (this.hashType !== 'hydro') {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            UserModel.setPassword(this._id, password);
        }
    }
}

class UserModel {
    static User = User;
    static defaultUser: Udoc = {
        _id: 0,
        uname: 'Unknown User',
        unameLower: 'unknown user',
        avatar: 'gravatar:unknown@hydro.local',
        mail: 'unknown@hydro.local',
        mailLower: 'unknown@hydro.local',
        salt: '',
        hash: '',
        hashType: 'hydro',
        priv: 0,
        regat: new Date('2000-01-01'),
        loginat: new Date('2000-01-01'),
        ip: ['127.0.0.1'],
        loginip: '127.0.0.1',
    };

    @ArgMethod
    static async getById(domainId: string, _id: number, scope: bigint | string = PERM.PERM_ALL): Promise<User | null> {
        if (cache.has(`id/${_id}/${domainId}`)) return cache.get(`id/${_id}/${domainId}`) || null;
        const udoc = await (_id < -999 ? collV : coll).findOne({ _id });
        if (!udoc) return null;
        const dudoc = await domain.getDomainUser(domainId, udoc);
        if (typeof scope === 'string') scope = BigInt(scope);
        const res = await new User(udoc, dudoc, scope).init();
        cache.set(`id/${res._id}/${domainId}`, res);
        cache.set(`name/${res.uname.toLowerCase()}/${domainId}`, res);
        cache.set(`mail/${res.mail.toLowerCase()}/${domainId}`, res);
        return res;
    }

    static async getList(domainId: string, uids: number[]): Promise<Udict> {
        const _uids = new Set(uids);
        const r: Udict = {};
        // eslint-disable-next-line no-await-in-loop
        for (const uid of _uids) r[uid] = (await UserModel.getById(domainId, uid)) || new User(UserModel.defaultUser, {});
        return r;
    }

    @ArgMethod
    static async getByUname(domainId: string, uname: string): Promise<User | null> {
        const unameLower = uname.trim().toLowerCase();
        if (cache.has(`name/${unameLower}/${domainId}`)) return cache.get(`name/${unameLower}/${domainId}`) || null;
        let udoc = await coll.findOne({ unameLower });
        if (!udoc) udoc = await collV.findOne({ unameLower });
        if (!udoc) return null;
        const dudoc = await domain.getDomainUser(domainId, udoc);
        const res = await new UserModel.User(udoc, dudoc).init();
        cache.set(`id/${res._id}/${domainId}`, res);
        cache.set(`name/${res.uname.toLowerCase()}/${domainId}`, res);
        cache.set(`mail/${res.mail.toLowerCase()}/${domainId}`, res);
        return res;
    }

    @ArgMethod
    static async getByEmail(domainId: string, mail: string): Promise<User | null> {
        const mailLower = mail.trim().toLowerCase();
        if (cache.has(`mail/${mailLower}/${domainId}`)) return cache.get(`mail/${mailLower}/${domainId}`) || null;
        const udoc = await coll.findOne({ mailLower });
        if (!udoc) return null;
        const dudoc = await domain.getDomainUser(domainId, udoc);
        const res = await new UserModel.User(udoc, dudoc).init();
        cache.set(`id/${res._id}/${domainId}`, res);
        cache.set(`name/${res.uname.toLowerCase()}/${domainId}`, res);
        cache.set(`mail/${res.mail.toLowerCase()}/${domainId}`, res);
        return res;
    }

    @ArgMethod
    static async setById(uid: number, $set?: Partial<Udoc>, $unset?: Value<Partial<Udoc>, ''>) {
        if (uid < -999) return null;
        const op: any = {};
        if ($set && Object.keys($set).length) op.$set = $set;
        if ($unset && Object.keys($unset).length) op.$unset = $unset;
        if (op.$set?.loginIp) op.$addToSet = { ip: op.$set.loginIp };
        const res = await coll.findOneAndUpdate({ _id: uid }, op, { returnDocument: 'after' });
        deleteUserCache(res.value);
        return res;
    }

    @ArgMethod
    static setUname(uid: number, uname: string) {
        return UserModel.setById(uid, { uname, unameLower: uname.trim().toLowerCase() });
    }

    @ArgMethod
    static setEmail(uid: number, mail: string) {
        return UserModel.setById(uid, { mail, mailLower: mail.trim().toLowerCase() });
    }

    @ArgMethod
    static async setPassword(uid: number, password: string): Promise<Udoc | null> {
        const salt = String.random();
        const res = await coll.findOneAndUpdate(
            { _id: uid },
            { $set: { salt, hash: pwhash(password, salt), hashType: 'hydro' } },
            { returnDocument: 'after' },
        );
        deleteUserCache(res.value);
        return res.value || null;
    }

    @ArgMethod
    static async inc(_id: number, field: string, n: number = 1) {
        if (_id < -999) return null;
        const udoc = await coll.findOne({ _id });
        if (!udoc) throw new UserNotFoundError(_id);
        udoc[field] = udoc[field] + n || n;
        await coll.updateOne({ _id }, { $set: { [field]: udoc[field] } });
        deleteUserCache(udoc);
        return udoc;
    }

    @ArgMethod
    static async create(
        mail: string, uname: string, password: string,
        uid?: number, regip: string = '127.0.0.1', priv: number = system.get('default.priv'),
    ) {
        const salt = String.random();
        if (typeof uid !== 'number') {
            const [udoc] = await coll.find({}).sort({ _id: -1 }).limit(1).toArray();
            uid = Math.max((udoc?._id || 0) + 1, 2);
        }
        try {
            await coll.insertOne({
                _id: uid,
                mail,
                mailLower: mail.trim().toLowerCase(),
                uname,
                unameLower: uname.trim().toLowerCase(),
                hash: pwhash(password.toString(), salt),
                salt,
                hashType: 'hydro',
                regat: new Date(),
                ip: [regip],
                loginat: new Date(),
                loginip: regip,
                priv,
                avatar: `gravatar:${mail}`,
            });
        } catch (e) {
            logger.warn('%o', e);
            throw new UserAlreadyExistError([uid, uname, mail]);
        }
        return uid;
    }

    @ArgMethod
    static async ensureVuser(uname: string) {
        const [[min], current] = await Promise.all([
            collV.find({}).sort({ _id: 1 }).limit(1).toArray(),
            collV.findOne({ unameLower: uname.toLowerCase() }),
        ]);
        if (current) return current._id;
        const uid = min?._id ? min._id - 1 : -1000;
        await collV.insertOne({
            _id: uid,
            mail: `${-uid}@vuser.local`,
            mailLower: `${-uid}@vuser.local`,
            uname,
            unameLower: uname.trim().toLowerCase(),
            hash: '',
            salt: '',
            hashType: 'hydro',
            regat: new Date(),
            ip: ['127.0.0.1'],
            loginat: new Date(),
            loginip: '127.0.0.1',
            priv: 0,
        });
        return uid;
    }

    static getMulti(params: any = {}) {
        return coll.find(params);
    }

    @ArgMethod
    static async getPrefixList(domainId: string, prefix: string, limit: number = 50) {
        prefix = prefix.toLowerCase();
        const $regex = new RegExp(`\\A${escapeRegExp(prefix)}`, 'gmi');
        const udocs = await coll.find({ unameLower: { $regex } })
            .limit(limit).project({ _id: 1 }).toArray();
        const users = [];
        for (const { _id } of udocs) users.push(UserModel.getById(domainId, _id));
        return await Promise.all(users);
    }

    @ArgMethod
    static async setPriv(uid: number, priv: number): Promise<Udoc | null> {
        const res = await coll.findOneAndUpdate(
            { _id: uid },
            { $set: { priv } },
            { returnDocument: 'after' },
        );
        deleteUserCache(res.value);
        return res.value || null;
    }

    @ArgMethod
    static async setSuperAdmin(uid: number) {
        return await UserModel.setPriv(uid, PRIV.PRIV_ALL);
    }

    @ArgMethod
    static async setJudge(uid: number) {
        return await UserModel.setPriv(
            uid,
            PRIV.PRIV_USER_PROFILE | PRIV.PRIV_JUDGE | PRIV.PRIV_VIEW_ALL_DOMAIN
            | PRIV.PRIV_READ_PROBLEM_DATA,
        );
    }

    @ArgMethod
    static ban(uid: number) {
        return Promise.all([
            UserModel.setPriv(uid, PRIV.PRIV_NONE),
            token.delByUid(uid),
        ]);
    }
}

bus.once('app/started', () => db.ensureIndexes(
    coll,
    { key: { unameLower: 1 }, name: 'uname', unique: true },
    { key: { mailLower: 1 }, name: 'mail', unique: true },
));
export default UserModel;
global.Hydro.model.user = UserModel;
