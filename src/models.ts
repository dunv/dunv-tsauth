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
    claims: DefaultJWTClaims;
    user: User;
}

export interface RefreshToken {
    claims: DefaultJWTClaims;
    userName: string;
    issuedAt?: Date;
    expiresAt?: Date;
}

export interface Tokens {
    accessToken: AccessToken;
    refreshToken: RefreshToken;
}

export interface RawTokens {
    accessToken: string;
    refreshToken: string;
}
