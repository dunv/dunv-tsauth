import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import * as React from 'react';
import { authContext } from './AuthContext';
import { useIsLoggedIn } from './hooks';
import { _apiRequest } from './internal';

export interface UseRequestConfig<T> {
    process?: (response: AxiosResponse) => T;
    timeout?: number;
}

export interface UseRequest<T> {
    data: T | undefined;
    isLoading: boolean;
    hasError: AxiosError | undefined;
    refresh: () => void;
}

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

/**
 * Helper for constructing a request to the backend WITHOUT auth (based on axios)
 * @param timeout timeout of the request in milliseconds
 */
export const useApiRequestWithoutAuth = (): ((timeout?: number) => Promise<AxiosInstance>) => {
    const { url } = React.useContext(authContext);
    return React.useCallback(async (timeout = 5000) => axios.create({ baseURL: url, timeout }), [url]);
};

/**
 * A hook for loading data
 */
export const useRequest = <T extends unknown>(
    fn: (instance: AxiosInstance) => Promise<AxiosResponse>,
    config?: UseRequestConfig<T>
): UseRequest<T> => {
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

    const savedConfig = React.useRef<UseRequestConfig<T>>();
    React.useEffect(() => {
        savedConfig.current = config;
    }, [config]);

    React.useEffect(() => {
        (async () => {
            if (isLoggedIn && savedFn?.current) {
                try {
                    const res = await savedFn.current(await apiRequest(savedConfig?.current?.timeout || 5000));
                    setLoadingError(undefined);
                    if (savedConfig?.current?.process) {
                        setData(savedConfig.current.process(res));
                    } else {
                        setData(res.data);
                    }
                } catch (e) {
                    setLoadingError(e);
                }
            }
        })();
    }, [apiRequest, refresh, isLoggedIn, savedFn, savedConfig]);

    return {
        data,
        isLoading: data === undefined && loadingError === undefined,
        hasError: loadingError,
        refresh: refreshFn.current,
    };
};
