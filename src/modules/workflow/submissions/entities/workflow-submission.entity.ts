
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { WorkflowProcess } from '../../processes/entities/workflow-process.entity.js';

export enum WorkflowSubmissionStatus {
    PENDING_START = 'PENDING_START',
    START_FAILED = 'START_FAILED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

@Entity('workflow_submissions')
export class WorkflowSubmission {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    processId!: string;

    @ManyToOne(() => WorkflowProcess)
    @JoinColumn({ name: 'processId' })
    process!: WorkflowProcess;

    @Column({ type: 'varchar', length: 250 })
    title!: string;

    @Column({
        type: 'varchar',
        length: 150,
        nullable: true,
        unique: true,
    })
    processInstanceId!: string | null;

    @Column({
        type: 'varchar',
        length: 200,
        nullable: true,
    })
    processDefinitionId!: string | null;

    @Column({ type: 'varchar', length: 150 })
    startedBy!: string;

    @Column({ type: 'jsonb' })
    data!: Record<string, unknown>;

    @Column({
        type: 'varchar',
        length: 50,
        default: WorkflowSubmissionStatus.PENDING_START,
    })
    status!: WorkflowSubmissionStatus;

    @Column({ type: 'text', nullable: true })
    errorMessage!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;
}
