
import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { DeployProcessDto } from '../dto/deploy-process.dto.js';
import { BpmnValidatorService } from './bpmn-validator.service.js';

export interface FlowableDeployment {
    id: string;
    name?: string;
    deploymentTime?: string;
    tenantId?: string;
}

export interface FlowableDefinition {
    id: string;
    key: string;
    name: string;
    version: number;
    deploymentId: string;
    suspended: boolean;
}

export interface FlowablePage<T> {
    data: T[];
    total: number;
    start: number;
    size: number;
}

@Injectable()
export class BpmnDeploymentService {
    private readonly logger = new Logger(
        BpmnDeploymentService.name,
    );

    private readonly baseUrl: string;

    constructor(
        private readonly config: ConfigService,
        private readonly validator: BpmnValidatorService,
    ) {
        this.baseUrl = this.config
            .getOrThrow<string>('FLOWABLE_URL')
            .replace(/\/+$/, '');
    }

    private get client() {
        return axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            maxRedirects: 0,
            auth: {
                username: this.config.getOrThrow<string>(
                    'FLOWABLE_USERNAME',
                ),
                password: this.config.getOrThrow<string>(
                    'FLOWABLE_PASSWORD',
                ),
            },
        });
    }

    private handleError(error: unknown): never {
        if (axios.isAxiosError(error)) {
            this.logger.error(
                `Flowable deployment: ${error.message}`,
            );

            if (error.response?.status === 400) {
                throw new BadRequestException(
                    'Flowable rechazó el BPMN. Revisa los elementos, '
                    + 'referencias, expresiones y gateways.',
                );
            }
        }

        throw new BadGatewayException(
            'No se pudo comunicar con Flowable',
        );
    }

    async deploy(dto: DeployProcessDto) {
        const processKeys = this.validator.validate(dto.xml);
        const filename = `${dto.name}.bpmn20.xml`;
        const form = new FormData();

        form.append(
            'file',
            new Blob([dto.xml], {
                type: 'application/xml',
            }),
            filename,
        );

        if (dto.tenantId) {
            form.append('tenantId', dto.tenantId);
        }

        let deployment: FlowableDeployment;

        try {
            const response =
                await this.client.post<FlowableDeployment>(
                    '/repository/deployments',
                    form,
                );

            deployment = response.data;
        } catch (error) {
            this.handleError(error);
        }

        // Consultar qué definiciones creó este despliegue.
        let definitions: FlowableDefinition[] = [];

        try {
            const response =
                await this.client.get<
                    FlowablePage<FlowableDefinition>
                >('/repository/process-definitions', {
                    params: {
                        deploymentId: deployment.id,
                        size: 100,
                    },
                });

            definitions = response.data.data;
        } catch {
            this.logger.warn(
                'Se publicó el BPMN pero no se pudo consultar '
                + 'el detalle de sus definiciones',
            );
        }

        return {
            deploymentId: deployment.id,
            deploymentName: deployment.name ?? filename,
            deployedAt: deployment.deploymentTime ?? null,
            processKeys,
            definitions: definitions.map((definition) => ({
                id: definition.id,
                key: definition.key,
                name: definition.name,
                version: definition.version,
                suspended: definition.suspended,
            })),
            deployed: true,
        };
    }

    async findVersions(key: string) {
        try {
            const response = await this.client.get<
                FlowablePage<FlowableDefinition>
            >('/repository/process-definitions', {
                params: {
                    key,
                    size: 100,
                    sort: 'version',
                    order: 'desc',
                },
            });

            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async getXml(id: string): Promise<string> {
        try {
            const response = await this.client.get<string>(
                `/repository/process-definitions/${encodeURIComponent(id)
                }/resourcedata`,
                {
                    responseType: 'text',
                },
            );

            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }
}
