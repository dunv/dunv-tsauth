import { set as setCookie, get as getCookie, remove as removeCookie } from 'es-cookie';
import { User, AccessToken, RefreshToken, UAuthProps } from './models';
import jwtDecode from 'jwt-decode';
import { boundMethod } from 'autobind-decorator';

export const COOKIE_NAME_ACCESS_TOKEN = 'dunv-auth-access-token';
export const COOKIE_NAME_REFRESH_TOKEN = 'dunv-auth-refresh-token';

export interface Subscriber {
    (props: UAuthProps): void;
}

export interface Unsubscribe {
    (): void;
}

export class AuthStore {
    private static instance: AuthStore;

    private _isLoggedIn: boolean;

    private _accessToken?: string;
    private _accessTokenValidUntil?: Date;

    private _refreshToken?: string;
    private _refreshTokenValidUntil?: Date;

    private subscribers: Subscriber[];
    private _url?: string;

    private constructor() {
        this.subscribers = [];

        // instantiate with values from cookies
        const accessToken = getCookie(COOKIE_NAME_ACCESS_TOKEN);
        if (accessToken) {
            this._accessToken = accessToken;
        }

        // instantiate with values from cookies
        const refreshToken = getCookie(COOKIE_NAME_REFRESH_TOKEN);
        if (refreshToken) {
            this._refreshToken = refreshToken;
        }

        this._isLoggedIn = false;
        this.calculateDerivedProps();
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
        if (this._accessToken != null) {
            return jwtDecode<AccessToken>(this._accessToken).user;
        }
        return undefined;
    }

    @boundMethod
    public login(accessToken: string, refreshToken: string): void {
        this._accessToken = accessToken;
        this._refreshToken = refreshToken;
        setCookie(COOKIE_NAME_ACCESS_TOKEN, accessToken);
        setCookie(COOKIE_NAME_REFRESH_TOKEN, refreshToken);
        this.calculateDerivedProps();

        this.notifySubscribers(this.props);
    }

    @boundMethod
    public renewRefreshToken(refreshToken: string): void {
        this._refreshToken = refreshToken;
        setCookie(COOKIE_NAME_REFRESH_TOKEN, refreshToken);
        this.calculateDerivedProps();

        this.notifySubscribers(this.props);
    }

    public get props(): UAuthProps {
        return {
            loggedIn: this._isLoggedIn,
            user: this.user(),
            accessToken: this._accessToken,
            accessTokenValidUntil: this._accessTokenValidUntil,
            refreshToken: this._refreshToken,
            refreshTokenValidUntil: this._refreshTokenValidUntil,
        };
    }

    @boundMethod
    public logout(): void {
        removeCookie(COOKIE_NAME_ACCESS_TOKEN);
        removeCookie(COOKIE_NAME_REFRESH_TOKEN);
        this._accessToken = undefined;
        this._refreshToken = undefined;
        this.calculateDerivedProps();

        this.notifySubscribers({ loggedIn: false });
    }

    public get accessToken(): string | undefined {
        return this._accessToken;
    }

    public get accessTokenValidUntil(): Date | undefined {
        return this._accessTokenValidUntil;
    }

    public get refreshToken(): string | undefined {
        return this._refreshToken;
    }

    public get refreshTokenValidUntil(): Date | undefined {
        return this._refreshTokenValidUntil;
    }

    public get isLoggedIn(): boolean {
        return this._isLoggedIn;
    }

    @boundMethod
    public addSubscriber(fn: Subscriber): Unsubscribe {
        this.subscribers.push(fn);
        return () => {
            this.subscribers = this.subscribers.filter((func) => func !== fn);
        };
    }

    @boundMethod
    private notifySubscribers(props: UAuthProps) {
        this.subscribers.forEach((subscriber) => subscriber(props));
    }

    private calculateDerivedProps() {
        if (this._accessToken && this._refreshToken) {
            const parsedAccessToken = jwtDecode<AccessToken>(this._accessToken);
            this._accessTokenValidUntil = new Date(parsedAccessToken.claims.exp * 1000);
            const parsedRefreshToken = jwtDecode<RefreshToken>(this._refreshToken);
            this._refreshTokenValidUntil = new Date(parsedRefreshToken.claims.exp * 1000);
            this._isLoggedIn = true;
        } else {
            this._accessTokenValidUntil = undefined;
            this._refreshTokenValidUntil = undefined;
            this._isLoggedIn = false;
        }
    }
}
