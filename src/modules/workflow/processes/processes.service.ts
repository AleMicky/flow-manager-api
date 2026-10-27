
import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkflowProcess } from './entities/workflow-process.entity.js';
import { CreateProcessDto } from './dto/create-process.dto.js';

@Injectable()
export class ProcessesService {
    constructor(
        @InjectRepository(WorkflowProcess)
        private readonly repository: Repository<WorkflowProcess>,
    ) { }

    async create(dto: CreateProcessDto) {
        const exists = await this.repository.existsBy({
            key: dto.key,
        });

        if (exists) {
            throw new ConflictException(
                'Ya existe un proceso con esta clave',
            );
        }

        const process = this.repository.create({
            ...dto,
            active: dto.active ?? false,
        });

        return this.repository.save(process);
    }

    findAll() {
        return this.repository.find({
            order: { name: 'ASC' },
        });
    }

    findActive() {
        return this.repository.find({
            where: { active: true },
            order: { name: 'ASC' },
        });
    }

    async findOne(id: string) {
        const process = await this.repository.findOneBy({ id });

        if (!process) {
            throw new NotFoundException(
                'Proceso no encontrado',
            );
        }

        return process;
    }
}
