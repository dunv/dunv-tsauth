import axios, { AxiosInstance } from 'axios';
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
    console.log('creatingApiRequest');
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
 * INTERNAL: Get access token from refreshToken
 */
const _accessTokenFromRefreshToken = async (url: string, rawTokens: RawTokens, setRawTokens: (rawTokens?: RawTokens) => void) => {
    if (!rawTokens) throw new Error('needs to authorized first');
    try {
        const res = await axios.post(`${url}/uauth/accessTokenFromRefreshToken`, { refreshToken: rawTokens?.refreshToken });
        if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
            throw new Error('Could not find accessToken and/or refreshToken in response');
        }
        setRawTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
        return;
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                setRawTokens(undefined);
                throw new Error('refreshToken has been deleted');
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                setRawTokens(undefined);
                throw new Error('user has been deleted');
            }
        }
        throw new Error('unexpected error ocurred' + JSON.stringify(e));
    }
};

/**
 * INTERNAL: Extend lifetime of a refreshToken
 */
// const _renewRefreshToken = async (url: string, rawTokens: RawTokens, setRawTokens: (rawTokens?: RawTokens) => void) => {
//     if (!rawTokens) throw new Error('needs to authorized first');
//     try {
//         const res = await axios.post(`${url}/uauth/renewRefreshToken`, { refreshToken: rawTokens.refreshToken });
//         if (!res.data || !res.data.refreshToken) {
//             throw new Error('Could not find refreshToken in response');
//         }
//         return _accessTokenFromRefreshToken(url, rawTokens, setRawTokens);
//     } catch (e) {
//         if (e.response?.data?.error) {
//             if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
//                 setRawTokens(undefined);
//                 throw new Error('refreshToken has been deleted');
//             } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
//                 setRawTokens(undefined);
//                 throw new Error('user has been deleted');
//             }
//         }
//         throw new Error('unexpected error ocurred' + JSON.stringify(e.response.data));
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
    // console.log('accessTokenValidUntil', new Date(tokens.accessToken.claims.exp * 1000));
    // console.log('refreshTokenValidUntil', new Date(tokens.refreshToken.claims.exp * 1000));

    // check if accessToken is still valid
    if (new Date(tokens.accessToken.claims.exp * 1000) < new Date()) {
        // accessToken is not valid anymore
        if (new Date(tokens.refreshToken.claims.exp * 1000) < new Date()) {
            // refreshToken is not valid anymore
            setRawTokens(undefined);
            throw new Error('cannot create apiRequest (accessToken and refreshToken expired)');
        } else {
            // refreshToken is still valid -> get a new accessToken
            await _accessTokenFromRefreshToken(url, rawTokens, setRawTokens);
        }
    }

    return axios.create({ baseURL: url, timeout, headers: { Authorization: `Bearer ${rawTokens.accessToken}` } });
};
