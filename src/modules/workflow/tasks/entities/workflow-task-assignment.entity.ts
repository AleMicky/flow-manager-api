import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workflow_task_assignments')
@Index(
  'uq_workflow_task_assignment_process_task',
  ['processDefinitionKey', 'taskDefinitionKey'],
  { unique: true },
)
export class WorkflowTaskAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  processDefinitionKey!: string;

  @Column({ type: 'varchar', length: 150 })
  taskDefinitionKey!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  taskName!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  candidateGroups!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  candidateUsers!: string[];

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

