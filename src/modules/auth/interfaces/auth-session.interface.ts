
declare module 'express-session' {
    interface SessionData {
        oidc?: {
            state: string;
            verifier: string;
            createdAt: number;
        };

        tokens?: {
            accessToken: string;
            refreshToken?: string;
            idToken?: string;
            expiresAt: number;
        };

        csrfToken?: string;

        authenticatedAt?: number;
    }
}

export { };
