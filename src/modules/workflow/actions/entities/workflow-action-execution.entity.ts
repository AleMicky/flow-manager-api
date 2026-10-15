
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum WorkflowExecutionStatus {
    PENDING = 'PENDING',
    ENGINE_COMPLETED = 'ENGINE_COMPLETED',
    SYNCED = 'SYNCED',
    RECONCILIATION_REQUIRED = 'RECONCILIATION_REQUIRED',
}

@Entity('workflow_action_executions')
export class WorkflowActionExecution {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 150, unique: true })
    taskId!: string;

    @Column({ type: 'uuid' })
    actionId!: string;

    @Column({ type: 'varchar', length: 150 })
    processInstanceId!: string;

    @Column({ type: 'varchar', length: 150 })
    executedBy!: string;

    @Column({
        type: 'varchar',
        length: 40,
        default: WorkflowExecutionStatus.PENDING,
    })
    status!: WorkflowExecutionStatus;

    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
    })
    businessStatus!: string | null;

    @Column({ type: 'text', nullable: true })
    errorMessage!: string | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
