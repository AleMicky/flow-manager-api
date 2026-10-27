
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('workflow_processes')
export class WorkflowProcess {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 150, unique: true })
    key!: string;

    @Column({ type: 'varchar', length: 200 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 150 })
    processDefinitionKey!: string;

    @Column({ type: 'jsonb' })
    startFormSchema!: Record<string, unknown>;

    @Column({ type: 'boolean', default: false })
    active!: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;
}
