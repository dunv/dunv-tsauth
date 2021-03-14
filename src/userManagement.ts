import React from 'react';
import { Role, TransferUser, User } from './models';
import {
    UAUTH_URL_CREATE_USER,
    UAUTH_URL_DELETE_USER,
    UAUTH_URL_GET_USER,
    UAUTH_URL_LIST_ROLES,
    UAUTH_URL_LIST_USERS,
    UAUTH_URL_UPDATE_USER,
} from './urls';
import { useApiRequest, UseRequest, useRequest } from './useRequest';

export const useUsers = (): UseRequest<User[]> => {
    return useRequest<User[]>((axios) => axios.get(UAUTH_URL_LIST_USERS), {
        process: (res) => {
            return res.data as User[];
        },
    });
};

export const useRoles = (): UseRequest<Role[]> => {
    return useRequest<Role[]>((axios) => axios.get(UAUTH_URL_LIST_ROLES), {
        process: (res) => {
            return res.data as Role[];
        },
    });
};

export const useGetUser = (): ((userId: string) => Promise<User>) => {
    const apiRequest = useApiRequest();
    return React.useCallback(
        async (userId: string) => {
            const { data } = await (await apiRequest()).get(UAUTH_URL_GET_USER, { params: { userId } });
            return data as User;
        },
        [apiRequest]
    );
};

export const useCreateUser = (): ((user: TransferUser) => Promise<void>) => {
    const apiRequest = useApiRequest();
    return React.useCallback(
        async (user: TransferUser) => {
            await (await apiRequest()).post(UAUTH_URL_CREATE_USER, user);
        },
        [apiRequest]
    );
};

export const useUpdateUser = (): ((userId: string, user: TransferUser) => Promise<void>) => {
    const apiRequest = useApiRequest();
    return React.useCallback(
        async (userId: string, user: TransferUser) => {
            await (await apiRequest()).post(UAUTH_URL_UPDATE_USER, user, { params: { userId } });
        },
        [apiRequest]
    );
};

export const useDeleteUser = (): ((userId: string) => Promise<void>) => {
    const apiRequest = useApiRequest();
    return React.useCallback(
        async (userId: string) => {
            await (await apiRequest()).delete(UAUTH_URL_DELETE_USER, { params: { userId } });
        },
        [apiRequest]
    );
};
