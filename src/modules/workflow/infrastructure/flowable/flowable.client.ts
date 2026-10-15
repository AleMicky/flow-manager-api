import {
  Injectable,
  BadGatewayException,
  GatewayTimeoutException,
  Logger,
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

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const err = error as AxiosError;

      this.logger.error(`Flowable REST error: ${err.message}`);

      if (err.code === 'ECONNABORTED') {
        throw new GatewayTimeoutException('Flowable no respondió a tiempo');
      }
    }

    throw new BadGatewayException(
      'No se pudo completar la operación en Flowable',
    );
  }


  async delete<T>(
    url: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await this.http.delete<T>(url, {
        params,
      });

      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

}
