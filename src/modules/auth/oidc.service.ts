
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oidc from 'openid-client';

@Injectable()
export class OidcService {
    private configurationPromise?: Promise<oidc.Configuration>;

    constructor(private readonly env: ConfigService) { }

    private configuration(): Promise<oidc.Configuration> {
        if (!this.configurationPromise) {
            const issuerUrl = new URL(
                this.env.getOrThrow<string>(
                    'KEYCLOAK_ISSUER',
                ),
            );

            this.configurationPromise = oidc.discovery(
                issuerUrl,
                this.env.getOrThrow<string>(
                    'KEYCLOAK_BFF_CLIENT_ID',
                ),
                this.env.getOrThrow<string>(
                    'KEYCLOAK_BFF_CLIENT_SECRET',
                ),
                undefined,
                issuerUrl.protocol === 'http:'
                    ? { execute: [oidc.allowInsecureRequests] }
                    : undefined,
            ).catch((error: unknown) => {
                this.configurationPromise = undefined;
                throw error;
            });
        }

        return this.configurationPromise;
    }

    async createLogin() {
        const config = await this.configuration();

        const verifier = oidc.randomPKCECodeVerifier();
        const challenge =
            await oidc.calculatePKCECodeChallenge(verifier);
        const state = oidc.randomState();

        const url = oidc.buildAuthorizationUrl(config, {
            redirect_uri: this.env.getOrThrow<string>(
                'AUTH_CALLBACK_URL',
            ),
            response_type: 'code',
            scope: 'openid profile email',
            code_challenge: challenge,
            code_challenge_method: 'S256',
            state,
        });

        return {
            url: url.toString(),
            state,
            verifier,
        };
    }

    async exchangeCode(
        callbackUrl: URL,
        state: string,
        verifier: string,
    ) {
        return oidc.authorizationCodeGrant(
            await this.configuration(),
            callbackUrl,
            {
                expectedState: state,
                pkceCodeVerifier: verifier,
                idTokenExpected: true,
            },
        );
    }

    async refresh(refreshToken: string) {
        return oidc.refreshTokenGrant(
            await this.configuration(),
            refreshToken,
        );
    }

    async logoutUrl(idToken?: string) {
        const redirectUri =
            this.env.get<string>('KEYCLOAK_POST_LOGOUT_REDIRECT_URI') ??
            this.env.get<string>('APP_URL');

        const params: Record<string, string> = {
            client_id: this.env.getOrThrow<string>(
                'KEYCLOAK_BFF_CLIENT_ID',
            ),
        };

        if (redirectUri && redirectUri !== 'none') {
            params.post_logout_redirect_uri = redirectUri;
        }

        if (idToken) {
            params.id_token_hint = idToken;
        }

        return oidc.buildEndSessionUrl(
            await this.configuration(),
            params,
        ).toString();
    }
}