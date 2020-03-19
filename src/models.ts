export type User<T> = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    permissions: string[];
    roles: string[];
    jwt: string;
    additionalAttributes?: T;
};
