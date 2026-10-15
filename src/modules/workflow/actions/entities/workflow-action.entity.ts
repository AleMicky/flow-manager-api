import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workflow_actions')
@Index(
  'uq_workflow_action_definition_task_code',
  ['processDefinitionId', 'taskDefinitionKey', 'code'],
  { unique: true },
)
export class WorkflowAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  processDefinitionId!: string;

  @Column({ type: 'varchar', length: 150 })
  taskDefinitionKey!: string;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  label!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  variables!: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder!: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  businessStatus!: string | null;


  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
