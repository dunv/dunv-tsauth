import { set as setCookie, get as getCookie, remove as removeCookie } from 'es-cookie';
import { User } from './models';
import jwtDecode from 'jwt-decode';
import { boundMethod } from 'autobind-decorator';

export const COOKIE_NAME = 'dunv-ts-auth';

export interface Subscriber {
    (loggedIn: boolean, user?: User): void;
}

export interface Unsubscribe {
    (): void;
}

export class AuthStore {
    private static instance: AuthStore;
    private _jwtToken?: string;
    private subscribers: Subscriber[];
    private _url?: string;

    private constructor() {
        this.subscribers = [];
        const res = getCookie(COOKIE_NAME);
        if (res) {
            this._jwtToken = res;
        }
    }

    public static get(): AuthStore {
        if (this.instance) {
            return this.instance;
        }
        this.instance = new AuthStore();
        return this.instance;
    }

    public set url(value: string) {
        this._url = value;
    }

    public get url(): string {
        return this._url || '';
    }

    @boundMethod
    public user(): User | undefined {
        if (this._jwtToken) {
            return jwtDecode(this._jwtToken);
        }
        return undefined;
    }

    @boundMethod
    public login(jwtToken: string): void {
        this._jwtToken = jwtToken;
        setCookie(COOKIE_NAME, jwtToken);
        this.notifySubscribers(true, this.user());
    }

    @boundMethod
    public logout(): void {
        removeCookie(COOKIE_NAME);
        this._jwtToken = undefined;
        this.notifySubscribers(false);
    }

    public get jwtToken(): string | undefined {
        return this._jwtToken;
    }

    @boundMethod
    public addSubscriber(fn: Subscriber): Unsubscribe {
        this.subscribers.push(fn);
        return () => {
            this.subscribers = this.subscribers.filter(func => func !== fn);
        };
    }

    @boundMethod
    private notifySubscribers(loggedIn: boolean, user?: User) {
        this.subscribers.forEach(subscriber => subscriber(loggedIn, user));
    }
}
