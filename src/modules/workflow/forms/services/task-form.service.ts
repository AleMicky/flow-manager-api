import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import _Ajv, { type ErrorObject } from 'ajv';
import _addFormats from 'ajv-formats';

const Ajv = _Ajv.default;
const addFormats = _addFormats.default;
type Ajv = _Ajv.default;

import { FormsService } from '../forms.service.js';
import type { FormValidationResult } from '../interfaces/form-validation.interface.js';

@Injectable()
export class TaskFormService {
  private readonly ajv: Ajv;

  constructor(private readonly formsService: FormsService) {
    this.ajv = new Ajv({
      allErrors: true,
      strict: true,
      coerceTypes: false,
      removeAdditional: false,
      useDefaults: false,
    });

    addFormats(this.ajv);
  }

  async getForm(taskId: string) {
    return this.formsService.findByTask(taskId);
  }

  async validate(
    taskId: string,
    data: Record<string, unknown>,
  ): Promise<FormValidationResult> {
    const form = await this.getForm(taskId);

    let validate;

    try {
      validate = this.ajv.compile(form.schema);
    } catch {
      throw new BadRequestException('El esquema del formulario es inválido');
    }

    const valid = validate(data);

    const errors: FormValidationResult['errors'] = (validate.errors ?? []).map(
      (error: ErrorObject) => ({
        field:
          error.keyword === 'required'
            ? String(error.params.missingProperty)
            : error.instancePath,
        message: error.message ?? 'Valor inválido',
        keyword: error.keyword,
      }),
    );

    return {
      valid,
      errors,
    };
  }

  async validateOrThrow(
    taskId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const result = await this.validate(taskId, data);

    if (!result.valid) {
      throw new UnprocessableEntityException({
        message: 'El formulario contiene errores',
        errors: result.errors,
      });
    }
  }
}
