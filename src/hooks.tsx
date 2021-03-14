import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { get as getCookie, remove as removeCookie, set as setCookie } from 'es-cookie';
import jwtDecode from 'jwt-decode';
import * as React from 'react';
import { AccessToken, RawTokens, RefreshToken, Tokens, User } from './models';

export const COOKIE_NAME_ACCESS_TOKEN = 'dunv-auth-access-token';
export const COOKIE_NAME_REFRESH_TOKEN = 'dunv-auth-refresh-token';

export const UAUTH_ERROR_INVALID_REFRESH_TOKEN = 'ErrInvalidRefreshToken';
export const UAUTH_ERROR_INVALID_USER = 'ErrInvalidUser';

// For some reason need to provide a default context...
const authContext = React.createContext<UAuthValues>({
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

export const useIsLoggedIn = (): boolean => {
    const { tokens } = React.useContext(authContext);
    return tokens !== undefined;
};

export const useRawAccessToken = (): string | undefined => {
    const { rawTokens } = React.useContext(authContext);
    return rawTokens?.accessToken;
};

export const useUser = (): User | undefined => {
    const { tokens } = React.useContext(authContext);
    return tokens?.accessToken.user;
};

export const useUrl = (): string => {
    const { url } = React.useContext(authContext);
    return url;
};

export const useSetRawToken = (): ((rawTokens?: RawTokens) => void) => {
    const { setRawTokens } = React.useContext(authContext);
    return setRawTokens;
};

/**
 * Helper for logging in an storing auth-information as needed
 * @param userName userName
 * @param password password in plaintext
 */
export const useLogin = (): ((userName: string, password: string) => Promise<boolean>) => {
    const { url, setRawTokens, debug } = React.useContext(authContext);
    return React.useCallback(
        async (userName: string, password: string) => {
            try {
                debug && console.debug('dunv-tsauth: logging in via request...');
                const res = await axios.post(`${url}/uauth/login`, { user: { userName, password } });
                if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
                    throw new Error('Could not find accessToken and/or refreshToken in response');
                }
                setRawTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
                debug && console.debug('dunv-tsauth: ...success logging in via request');
                return true;
            } catch (e) {
                setRawTokens(undefined);
                debug && console.debug('dunv-tsauth: ...failed logging in via request');
                if (e.response?.data?.error) {
                    if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                        throw new Error(e.response.data.error);
                    }
                    throw new Error('unexpected error ocurred' + JSON.stringify(e.response.data));
                }
                throw new Error('unexpected error ocurred' + JSON.stringify(e));
            }
        },
        [url, setRawTokens]
    );
};

/**
 * Helper for constructing a authed request against the backend (based on axios)
 * @param timeout timeout of the request in milliseconds
 */
export const useApiRequest = (): ((timeout?: number) => Promise<AxiosInstance>) => {
    const { url, rawTokens, setRawTokens, tokens, debug } = React.useContext(authContext);
    return React.useCallback(
        (timeout?: number) => {
            if (!rawTokens || !tokens) throw new Error('needs to be authorized first');
            return _apiRequest(url, rawTokens, setRawTokens, tokens, debug, timeout);
        },
        [url, rawTokens, setRawTokens, tokens, debug]
    );
};

export interface RequestConfig<T> {
    process?: (response: AxiosResponse) => T;
    timeout?: number;
}

/**
 * A hook for loading data
 */
export const useRequest = <T extends unknown>(
    fn: (instance: AxiosInstance) => Promise<AxiosResponse>,
    config?: RequestConfig<T>
): [T | undefined, boolean, AxiosError | undefined, () => void] => {
    const [data, setData] = React.useState<T>();
    const [loadingError, setLoadingError] = React.useState<AxiosError>();
    const apiRequest = useApiRequest();
    const isLoggedIn = useIsLoggedIn();
    const [refresh, setRefresh] = React.useState<boolean>(false);

    const refreshFn = React.useRef<() => void>(() => setRefresh(!refresh));
    React.useEffect(() => {
        refreshFn.current = () => setRefresh(!refresh);
    }, [refresh]);

    const savedFn = React.useRef<(instance: AxiosInstance) => Promise<AxiosResponse>>();
    React.useEffect(() => {
        savedFn.current = fn;
    }, [fn]);

    const savedConfig = React.useRef<RequestConfig<T>>();
    React.useEffect(() => {
        savedConfig.current = config;
    }, [config]);

    React.useEffect(() => {
        if (isLoggedIn && savedFn && savedFn?.current) {
            (async () => {
                try {
                    const res = await savedFn!.current!(await apiRequest(savedConfig?.current?.timeout || 5000));
                    setLoadingError(undefined);
                    if (savedConfig?.current?.process) {
                        setData(savedConfig.current.process(res));
                    } else {
                        setData(res.data);
                    }
                } catch (e) {
                    setLoadingError(e);
                }
            })();
        }
    }, [apiRequest, refresh, isLoggedIn, savedFn, savedConfig]);

    return [data, data === undefined && loadingError === undefined, loadingError, refreshFn.current];
};

/**
 * Helper for constructing a request to the backend WITHOUT auth (based on axios)
 * @param timeout timeout of the request in milliseconds
 */
export const useApiRequestWithoutAuth = (): ((timeout?: number) => Promise<AxiosInstance>) => {
    const { url } = React.useContext(authContext);
    return React.useCallback(async (timeout = 5000) => axios.create({ baseURL: url, timeout }), [url]);
};

/**
 * Helper for logging out (cleans up AuthStore and tries to delete the current refreshToken)
 */
export const useLogout = (): (() => void) => {
    const { url, rawTokens, setRawTokens, debug } = React.useContext(authContext);
    const apiRequest = useApiRequest();
    return React.useCallback(async () => {
        if (rawTokens) {
            debug && console.debug('dunv-tsauth: logging out...');
            await _deleteRefreshToken(apiRequest(), url, debug, rawTokens?.refreshToken, rawTokens, setRawTokens);
            setRawTokens(undefined);
            debug && console.debug('dunv-tsauth: ...success (logging out)');
        }
    }, [apiRequest, debug, url, rawTokens, setRawTokens]);
};

/**
 * Helper for listing refreshTokens of the current user
 */
export const useRefreshTokens = (): {
    refreshTokens:
        | {
              decoded: RefreshToken;
              raw: string;
          }[]
        | undefined;
    isLoading: boolean;
    loadingError: AxiosError | undefined;
    refresh: () => void;
} => {
    const [data, isLoading, loadingError, refresh] = useRequest<
        | {
              decoded: RefreshToken;
              raw: string;
          }[]
        | undefined
    >((axios) => axios.get(`/uauth/listRefreshTokens`), {
        process: (res) =>
            res.data?.refreshTokens?.map((token: string) => {
                const decoded = jwtDecode<RefreshToken>(token);
                decoded.issuedAt = new Date(decoded.claims.iat * 1000);
                decoded.expiresAt = new Date(decoded.claims.exp * 1000);
                return {
                    decoded,
                    raw: token,
                };
            }),
    });
    return {
        refreshTokens: data,
        isLoading,
        loadingError,
        refresh,
    };
};

/**
 * Helper for deleting any refreshToken of the current user
 * @param refreshToken refreshToken to be deleted
 */
export const useDeleteRefreshToken = (): ((refreshToken: string) => Promise<void>) => {
    const { url, rawTokens, setRawTokens, debug } = React.useContext(authContext);
    const apiRequest = useApiRequest();
    return React.useCallback(async (refreshToken: string) => _deleteRefreshToken(apiRequest(), url, debug, refreshToken, rawTokens, setRawTokens), [
        url,
        apiRequest,
        rawTokens,
        setRawTokens,
    ]);
};

/**
 * INTERNAL: deleteRefreshToken
 */
const _deleteRefreshToken = async (
    apiRequest: Promise<AxiosInstance>,
    url: string,
    debug: boolean,
    refreshToken: string,
    rawTokens: RawTokens | undefined,
    setRawTokens: (rawTokens?: RawTokens) => void
): Promise<void> => {
    try {
        debug && console.log('dunv-tsauth: deleting refreshToken...');
        await (await apiRequest).post(`${url}/uauth/deleteRefreshToken`, { refreshToken });
        if (refreshToken === rawTokens?.refreshToken) {
            debug && console.log('dunv-tsauth: - deleted current refreshToken (-> implicit logout)');
            setRawTokens(undefined);
        }
        debug && console.log('dunv-tsauth: ...success deleting refreshToken');
    } catch (e) {
        debug && console.log(`dunv-tsauth: ...failed deleting current refreshToken (${e})`);
        throw e;
    }
};

/**
 * INTERNAL: apiRequest
 */
const _apiRequest = async (
    url: string,
    rawTokens: RawTokens,
    setRawTokens: (rawTokens?: RawTokens) => void,
    tokens: Tokens,
    debug: boolean,
    timeout = 5000
): Promise<AxiosInstance> => {
    const accessTokenValid = new Date(tokens.accessToken.claims.exp * 1000) > new Date();
    const refreshTokenValid = new Date(tokens.refreshToken.claims.exp * 1000) > new Date();
    // const remainingAccessTokenValidity = (new Date(tokens.accessToken.claims.exp * 1000).getTime() - new Date().getTime()) / 1000;
    const remainingRefreshTokenValidity = (new Date(tokens.refreshToken.claims.exp * 1000).getTime() - new Date().getTime()) / 1000;
    // const totalAccessTokenValidity =
    //     (new Date(tokens.accessToken.claims.exp * 1000).getTime() - new Date(tokens.accessToken.claims.iat * 1000).getTime()) / 1000;
    const totalRefreshTokenValidity =
        (new Date(tokens.refreshToken.claims.exp * 1000).getTime() - new Date(tokens.refreshToken.claims.iat * 1000).getTime()) / 1000;

    // console.log(
    //     `accessToken remaining:${remainingAccessTokenValidity}s (${
    //         Math.round((remainingAccessTokenValidity / totalAccessTokenValidity) * 100 * 100) / 100
    //     }%)`
    // );
    // console.log(
    //     `refreshToken remaining:${remainingRefreshTokenValidity}s (${
    //         Math.round((remainingRefreshTokenValidity / totalRefreshTokenValidity) * 100 * 100) / 100
    //     }%)`
    // );

    // renew refreshToken if nearing its expiry
    if (remainingRefreshTokenValidity / totalRefreshTokenValidity < 0.5 && refreshTokenValid) {
        debug && console.log('dunv-tsauth: less than 50% of refreshTokenValidity remaining -> refreshing now');
        const updatedRawTokens = await _renewRefreshToken(url, rawTokens);
        setRawTokens(updatedRawTokens);
        return axios.create({ baseURL: url, timeout, headers: { Authorization: `Bearer ${updatedRawTokens.accessToken}` } });
    }

    // get accessToken if refreshToken is still valid but not nearing its expiry
    if (!accessTokenValid && refreshTokenValid) {
        console.log('dunv-tsauth: accessToken expired, refreshing it using refreshToken');
        const updatedRawTokens = await _accessTokenFromRefreshToken(url, rawTokens);
        setRawTokens(updatedRawTokens);
        return axios.create({ baseURL: url, timeout, headers: { Authorization: `Bearer ${updatedRawTokens.accessToken}` } });
    }

    // if access token is still valid, just use it
    if (accessTokenValid) {
        return axios.create({ baseURL: url, timeout, headers: { Authorization: `Bearer ${rawTokens.accessToken}` } });
    }

    // if all tokens expired, the only thing remaining is logging in again
    debug && console.log('dunv-tsauth: accessToken and refreshToken expired');
    setRawTokens(undefined);
    throw new Error('cannot create apiRequest (accessToken and refreshToken expired)');
};

/**
 * INTERNAL: Get access token from refreshToken
 * only getter, will not change state
 */
const _accessTokenFromRefreshToken = async (url: string, rawTokens: RawTokens): Promise<RawTokens> => {
    if (!rawTokens) throw new Error('needs to be authorized first');
    try {
        const res = await axios.post(`${url}/uauth/accessTokenFromRefreshToken`, { refreshToken: rawTokens?.refreshToken });
        if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
            throw new Error('Could not find accessToken and/or refreshToken in response');
        }
        return { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken };
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                throw new Error('refreshToken has been deleted');
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                throw new Error('user has been deleted');
            }
        }
        throw new Error('unexpected error ocurred' + JSON.stringify(e));
    }
};

/**
 * INTERNAL: Extend lifetime of a refreshToken
 * only getter, will not change state
 */
const _renewRefreshToken = async (url: string, rawTokens: RawTokens): Promise<RawTokens> => {
    if (!rawTokens) throw new Error('needs to be authorized first');
    try {
        const res = await axios.post(`${url}/uauth/renewRefreshToken`, { refreshToken: rawTokens.refreshToken });
        if (!res.data || !res.data.refreshToken) {
            throw new Error('Could not find refreshToken in response');
        }
        return { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken };
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                throw new Error('refreshToken has been deleted');
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                throw new Error('user has been deleted');
            }
        }
        throw new Error('unexpected error ocurred' + JSON.stringify(e.response.data));
    }
};
