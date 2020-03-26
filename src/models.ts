export type User = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    permissions: string[];
    roles: string[];
    jwt: string;
    additionalAttributes?: any;
};

export interface ConnectToAuthProps {
    loggedIn?: boolean;
    user?: User;
}
