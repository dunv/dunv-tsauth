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

export interface DefaultJWTClaims {
    iat: number;
    exp: number;
}

export interface AccessToken {
    claims: DefaultJWTClaims;
    user: User;
}

export interface RefreshToken {
    claims: DefaultJWTClaims;
    userName: string;
}

export interface ConnectToAuthProps {
    uauth?: UAuthProps;
}

export interface UAuthProps {
    loggedIn: boolean;
    user?: User;
    accessToken?: string;
    accessTokenValidUntil?: Date;
    refreshToken?: string;
    refreshTokenValidUntil?: Date;
}
