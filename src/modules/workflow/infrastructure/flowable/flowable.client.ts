import {
  Injectable,
  BadGatewayException,
  GatewayTimeoutException,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

@Injectable()
export class FlowableClient {
  private readonly logger = new Logger(FlowableClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: this.config.getOrThrow<string>('FLOWABLE_BASE_URL'),
      auth: {
        username: this.config.getOrThrow<string>('FLOWABLE_USERNAME'),
        password: this.config.getOrThrow<string>('FLOWABLE_PASSWORD'),
      },
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async get<T>(url: string, params?: object): Promise<T> {
    try {
      const response = await this.http.get<T>(url, { params });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async post<T>(url: string, data: unknown): Promise<T> {
    try {
      const response = await this.http.post<T>(url, data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }


  async delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.http.delete<T>(url, {
        params,
      });

      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }


  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 400) {
        throw new BadRequestException(
          'Flowable rechazó la operación',
        );
      }

      if (status === 401 || status === 403) {
        throw new BadGatewayException(
          'Error de autenticación con Flowable',
        );
      }

      if (status === 404) {
        throw new NotFoundException(
          'Recurso no encontrado en Flowable',
        );
      }

      if (status === 409) {
        throw new ConflictException(
          'La tarea o proceso fue modificado por otra operación',
        );
      }

      if (
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT'
      ) {
        throw new GatewayTimeoutException(
          'Flowable no respondió a tiempo',
        );
      }

      this.logger.error(
        `Flowable REST: ${error.message}`,
      );
    }

    throw new BadGatewayException(
      'No se pudo completar la operación en Flowable',
    );
  }

}
