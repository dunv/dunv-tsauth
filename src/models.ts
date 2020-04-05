export type User = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    permissions: string[];
    roles: string[];
    jwt: string;
    additionalAttributes?: any;
    refreshTokens: string[];
};

export interface DefaultJWTClaims {
    iat: number;
    exp: number;
}

export interface AccessToken {
    raw: string;
    claims: DefaultJWTClaims;
    user: User;
}

export interface RefreshToken {
    raw: string;
    claims: DefaultJWTClaims;
    userName: string;
    issuedAt?: Date;
    expiresAt?: Date;
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
