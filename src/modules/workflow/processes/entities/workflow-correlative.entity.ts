import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workflow_correlatives')
@Unique(['processDefinitionKey', 'year'])
export class WorkflowCorrelative {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  processDefinitionKey!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int', default: 0 })
  currentValue!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

