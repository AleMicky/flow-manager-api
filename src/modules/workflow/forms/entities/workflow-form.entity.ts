import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workflow_forms')
@Index(
  'uq_workflow_form_definition_task',
  ['processDefinitionId', 'taskDefinitionKey'],
  { unique: true },
)
export class WorkflowForm {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  processDefinitionId!: string;

  @Column({ type: 'varchar', length: 150 })
  taskDefinitionKey!: string;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb' })
  schema!: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
