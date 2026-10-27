
import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';

import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';

@Injectable()
export class BpmnValidatorService {
    validate(xml: string): string[] {
        if (
            /<!DOCTYPE|<!ENTITY/i.test(xml)
        ) {
            throw new BadRequestException(
                'No se permiten DTD ni entidades XML',
            );
        }

        try {
            SyntaxValidator.validate(xml);
        } catch {
            throw new BadRequestException(
                'El XML no tiene una estructura válida',
            );
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            removeNSPrefix: true,
            attributeNamePrefix: '@_',
            parseAttributeValue: false,
        });

        let document: Record<string, any>;

        try {
            document = parser.parse(xml);
        } catch {
            throw new BadRequestException(
                'No se pudo interpretar el BPMN',
            );
        }

        const definitions = document.definitions;

        if (
            !definitions ||
            typeof definitions !== 'object'
        ) {
            throw new BadRequestException(
                'No existe el elemento definitions de BPMN',
            );
        }

        const processes = definitions.process;

        if (!processes) {
            throw new BadRequestException(
                'El BPMN no contiene procesos',
            );
        }

        const processList = Array.isArray(processes)
            ? processes
            : [processes];

        const keys = processList.map((process: Record<string, unknown>) => {
            const id = process['@_id'];
            const executable = process['@_isExecutable'];

            if (
                typeof id !== 'string' ||
                !id.trim()
            ) {
                throw new BadRequestException(
                    'Cada proceso debe tener un identificador',
                );
            }

            if (
                executable === 'false' ||
                executable === false
            ) {
                throw new BadRequestException(
                    `El proceso ${id} no es ejecutable`,
                );
            }

            return id;
        });

        if (new Set(keys).size !== keys.length) {
            throw new BadRequestException(
                'El BPMN tiene identificadores de proceso duplicados',
            );
        }

        return keys;
    }
}
