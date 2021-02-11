import axios, { AxiosInstance, AxiosResponse } from 'axios';
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
    setRawTokens: () => {
        throw new Error('using unitialized context');
    },
    url: 'uninitialized',
});
authContext.displayName = 'dunv-tsauth';

interface UAuthProps {
    url: string;
    children: JSX.Element[] | JSX.Element;
}

interface UAuthValues {
    rawTokens?: RawTokens;
    tokens?: Tokens;
    url: string;
    setRawTokens: (rawTokens?: RawTokens) => void;
}

export const UAuth: React.FC<UAuthProps> = ({ url, children }: UAuthProps) => {
    // Read cookies here on initial run, so no effects get called with invalid values. (i.e. rawTokens of undefined, even if they should not be)
    const [rawTokens, setRawTokens] = React.useState<RawTokens | undefined>((): RawTokens | undefined => {
        const accessToken = getCookie(COOKIE_NAME_ACCESS_TOKEN);
        const refreshToken = getCookie(COOKIE_NAME_REFRESH_TOKEN);
        if (accessToken && refreshToken) {
            return { accessToken, refreshToken };
        }
        return undefined;
    });
    const [tokens, setTokens] = React.useState<Tokens>();

    React.useEffect(() => {
        if (rawTokens) {
            const accessToken = jwtDecode<AccessToken>(rawTokens.accessToken);
            const refreshToken = jwtDecode<RefreshToken>(rawTokens.refreshToken);
            setCookie(COOKIE_NAME_ACCESS_TOKEN, rawTokens.accessToken, { expires: new Date(accessToken.claims.exp * 1000) });
            setCookie(COOKIE_NAME_REFRESH_TOKEN, rawTokens.refreshToken, { expires: new Date(refreshToken.claims.exp * 1000) });
            setTokens({ accessToken, refreshToken });
            return;
        }
        removeCookie(COOKIE_NAME_ACCESS_TOKEN);
        removeCookie(COOKIE_NAME_REFRESH_TOKEN);
        setTokens(undefined);
    }, [rawTokens]);

    return (
        <authContext.Provider
            value={{
                rawTokens,
                tokens,
                url,
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

/**
 * Helper for logging in an storing auth-information as needed
 * @param userName userName
 * @param password password in plaintext
 */
export const useLogin = (): ((userName: string, password: string) => Promise<boolean>) => {
    const { url, setRawTokens } = React.useContext(authContext);
    return React.useCallback(
        async (userName: string, password: string) => {
            try {
                const res = await axios.post(`${url}/uauth/login`, { user: { userName, password } });
                if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
                    throw new Error('Could not find accessToken and/or refreshToken in response');
                }
                setRawTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
                return true;
            } catch (e) {
                setRawTokens(undefined);
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
    const { url, rawTokens, setRawTokens, tokens } = React.useContext(authContext);
    return React.useCallback(
        (timeout?: number) => {
            if (!rawTokens || !tokens) throw new Error('needs to authorized first');
            return _apiRequest(url, rawTokens, setRawTokens, tokens, timeout);
        },
        [url, rawTokens, setRawTokens, tokens]
    );
};

/**
 * A hook for loading data
 * @param fn needs to return the Axios-Promise (e.g. axios => axios.get('...'))
 * @param timeout timeout for the axios-instance
 * @returns [res.data, isLoading, loadingError, refresh()]
 */
export const useRequest = <T extends unknown>(
    fn: (instance: AxiosInstance) => Promise<AxiosResponse>,
    config?: {
        process?: (response: AxiosResponse) => T;
        timeout?: number;
    }
): [T | undefined, boolean, Error | undefined, () => void] => {
    const [data, setData] = React.useState<T>();
    const [loadingError, setLoadingError] = React.useState<Error>();
    const apiRequest = useApiRequest();
    const isLoggedIn = useIsLoggedIn();
    const [refresh, setRefresh] = React.useState<boolean>(false);

    React.useEffect(() => {
        if (isLoggedIn) {
            (async () => {
                try {
                    const res = await fn(await apiRequest(config?.timeout || 5000));
                    if (config?.process) {
                        setData(config.process(res));
                    } else {
                        setData(data);
                    }
                } catch (e) {
                    setLoadingError(e);
                }
            })();
        }
    }, [refresh, isLoggedIn]);

    return [data, data === undefined && loadingError === undefined, loadingError, () => setRefresh(!refresh)];
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
    const { setRawTokens } = React.useContext(authContext);
    return React.useCallback(() => setRawTokens(undefined), [setRawTokens]);
};

/**
 * Helper for deleting the current refreshToken
 * Cleans up authStore and requests deletion of the current token
 */
// export const deleteCurrentRefreshToken = (): Promise<void> {
//     const { url, rawTokens, setRawTokens } = React.useContext(authContext);

//     try {
//         await (await apiRequest()).post(`${url}/uauth/deleteRefreshToken`, { refreshToken: authStore.refreshToken });
//         authStore.logout();
//     } catch (e) {
//         authStore.logout();
//         throw e;
//     }
// }

/**
 * Helper for deleting any refreshToken of the current user
 * @param refreshToken refreshToken to be deleted
 */
// export async function deleteRefreshToken(refreshToken: string): Promise<void> {
//     const { url, authStore } = helper();

//     try {
//         await (await apiRequest()).post(`${url}/uauth/deleteRefreshToken`, { refreshToken: refreshToken });
//         if (authStore.refreshToken === refreshToken) authStore.logout();
//     } catch (e) {
//         throw e;
//     }
// }

/**
 * Helper for listing refreshTokens of the current user
 */
// export const useRefreshTokens = (): (() => Promise<RefreshToken[]>) => {
//     try {
//         const {
//             data: { refreshTokens },
//         } = await(await apiRequest()).get(`${url}/uauth/listRefreshTokens`);
//         return refreshTokens.map((token: string) => {
//             const decoded = jwtDecode<RefreshToken>(token);
//             decoded.raw = token;
//             decoded.issuedAt = new Date(decoded.claims.iat * 1000);
//             decoded.expiresAt = new Date(decoded.claims.exp * 1000);
//             return decoded;
//         });
//     } catch (e) {
//         throw e;
//     }
// };

/**
 * INTERNAL: apiRequest
 */
export const _apiRequest = async (
    url: string,
    rawTokens: RawTokens,
    setRawTokens: (rawTokens?: RawTokens) => void,
    tokens: Tokens,
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
        console.log('dunv-tsauth: less than 50% of refreshTokenValidity remaining -> refreshing now');
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
    console.log('dunv-tsauth: accessToken and refreshToken expired');
    setRawTokens(undefined);
    throw new Error('cannot create apiRequest (accessToken and refreshToken expired)');
};

/**
 * INTERNAL: Get access token from refreshToken
 * only getter, will not change state
 */
const _accessTokenFromRefreshToken = async (url: string, rawTokens: RawTokens): Promise<RawTokens> => {
    if (!rawTokens) throw new Error('needs to authorized first');
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
    if (!rawTokens) throw new Error('needs to authorized first');
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
