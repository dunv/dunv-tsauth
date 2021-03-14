import { get as getCookie, remove as removeCookie, set as setCookie } from 'es-cookie';
import jwtDecode from 'jwt-decode';
import * as React from 'react';
import { _accessTokenFromRefreshToken } from './internal';
import { AccessToken, RawTokens, RefreshToken, Tokens } from './models';

export const COOKIE_NAME_ACCESS_TOKEN = 'dunv-auth-access-token';
export const COOKIE_NAME_REFRESH_TOKEN = 'dunv-auth-refresh-token';

export const UAUTH_ERROR_INVALID_REFRESH_TOKEN = 'ErrInvalidRefreshToken';
export const UAUTH_ERROR_INVALID_USER = 'ErrInvalidUser';

// For some reason need to provide a default context...
export const authContext = React.createContext<UAuthValues>({
    debug: false,
    setRawTokens: () => {
        throw new Error('using unitialized context');
    },
    url: 'uninitialized',
});
authContext.displayName = 'dunv-tsauth';

interface UAuthProps {
    url: string;
    debug?: boolean;
    children: JSX.Element[] | JSX.Element;
}

interface UAuthValues {
    rawTokens?: RawTokens;
    debug: boolean;
    tokens?: Tokens;
    url: string;
    setRawTokens: (rawTokens?: RawTokens) => void;
}

export const UAuth: React.FC<UAuthProps> = ({ url, children, debug = false }: UAuthProps) => {
    const [initComplete, setInitComplete] = React.useState<boolean>(false);
    const [rawTokens, setRawTokens] = React.useState<RawTokens>();
    const [tokens, setTokens] = React.useState<Tokens>();

    React.useEffect(() => {
        (async () => {
            const accessToken = getCookie(COOKIE_NAME_ACCESS_TOKEN);
            const refreshToken = getCookie(COOKIE_NAME_REFRESH_TOKEN);

            debug && console.debug('dunv-tsauth: logging in via cookie...');
            if (accessToken && refreshToken) {
                debug && console.debug('dunv-tsauth: ...success logging in via cookie');
                setInitComplete(true);
                setRawTokens({ accessToken, refreshToken });
                return;
            }

            if (refreshToken) {
                debug && console.debug('dunv-tsauth: - found only refreshToken, refreshing accessToken');
                try {
                    const refreshedTokens = await _accessTokenFromRefreshToken(url, { accessToken: '', refreshToken });
                    setInitComplete(true);
                    setRawTokens(refreshedTokens);
                    debug && console.debug('dunv-tsauth: ...success loggin in via cookie');
                } catch (e) {
                    setInitComplete(true);
                    debug && console.log(`dunv-tsauth: ...failed logging in via cookie (${e})`);
                }
                return;
            }

            setInitComplete(true);
            debug && console.log('dunv-tsauth: ...failed logging in via cookie (no tokens present)');
        })();
    }, []);

    // Decode/renew tokens or cleanup
    React.useEffect(() => {
        (async () => {
            if (initComplete) {
                debug && console.log('dunv-tsauth: running token-decode...');
                if (rawTokens) {
                    const refreshToken = jwtDecode<RefreshToken>(rawTokens.refreshToken);
                    setCookie(COOKIE_NAME_REFRESH_TOKEN, rawTokens.refreshToken, {
                        expires: new Date(refreshToken.claims.exp * 1000),
                        sameSite: 'lax',
                    });
                    const accessToken = jwtDecode<AccessToken>(rawTokens.accessToken);
                    setCookie(COOKIE_NAME_ACCESS_TOKEN, rawTokens.accessToken, {
                        expires: new Date(accessToken.claims.exp * 1000),
                        sameSite: 'lax',
                    });
                    setTokens({ accessToken, refreshToken });
                    debug && console.log('dunv-tsauth: ...success running token-decode');
                    return;
                }

                removeCookie(COOKIE_NAME_ACCESS_TOKEN);
                removeCookie(COOKIE_NAME_REFRESH_TOKEN);
                setTokens(undefined);
                debug && console.log('dunv-tsauth: ...failed running token-decode (no rawTokens present)');
            }
        })();
    }, [rawTokens, debug, initComplete]);

    return (
        <authContext.Provider
            value={{
                rawTokens,
                tokens,
                url,
                debug,
                setRawTokens,
            }}
        >
            {children}
        </authContext.Provider>
    );
};
