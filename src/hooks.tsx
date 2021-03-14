import axios from 'axios';
import jwtDecode from 'jwt-decode';
import * as React from 'react';
import { authContext, UAUTH_ERROR_INVALID_USER } from './AuthContext';
import { _deleteRefreshToken } from './internal';
import { RawTokens, RefreshToken, User } from './models';
import { UAUTH_URL_LIST_REFRESH_TOKENS, UAUTH_URL_LOGIN } from './urls';
import { UseRequest, useRequest } from './useRequest';

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
                const res = await axios.post(`${url}${UAUTH_URL_LOGIN}`, { user: { userName, password } });
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
        [url, setRawTokens, debug]
    );
};
/**
 * Helper for logging out (cleans up AuthStore and tries to delete the current refreshToken)
 */
export const useLogout = (): (() => void) => {
    const { url, rawTokens, setRawTokens, debug } = React.useContext(authContext);
    return React.useCallback(async () => {
        if (rawTokens) {
            debug && console.debug('dunv-tsauth: logging out...');
            try {
                await _deleteRefreshToken(url, debug, rawTokens?.refreshToken, rawTokens, setRawTokens);
            } catch (e) {
                throw e;
            } finally {
                setRawTokens(undefined);
                debug && console.debug('dunv-tsauth: ...success (logging out)');
            }
        }
    }, [debug, url, rawTokens, setRawTokens]);
};

/**
 * Helper for listing refreshTokens of the current user
 */
export const useRefreshTokens = (): UseRequest<
    {
        decoded: RefreshToken;
        raw: string;
    }[]
> => {
    return useRequest<
        {
            decoded: RefreshToken;
            raw: string;
        }[]
    >((axios) => axios.get(UAUTH_URL_LIST_REFRESH_TOKENS), {
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
};

/**
 * Helper for deleting any refreshToken of the current user
 * @param refreshToken refreshToken to be deleted
 */
export const useDeleteRefreshToken = (): ((refreshToken: string) => Promise<void>) => {
    const { url, rawTokens, setRawTokens, debug } = React.useContext(authContext);
    return React.useCallback(async (refreshToken: string) => _deleteRefreshToken(url, debug, refreshToken, rawTokens, setRawTokens), [
        url,
        rawTokens,
        setRawTokens,
        debug,
    ]);
};
