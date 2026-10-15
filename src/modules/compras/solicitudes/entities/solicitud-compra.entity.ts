import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EstadoSolicitudCompra {
  BORRADOR = 'BORRADOR',
  SOLICITADO = 'SOLICITADO',
  EN_REVISION = 'EN_REVISION',
  OBSERVADO = 'OBSERVADO',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

@Entity('solicitudes_compra')
export class SolicitudCompra {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  numero!: string;

  @Column({ type: 'varchar', length: 200 })
  concepto!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  monto!: string;

  @Column({ type: 'uuid' })
  solicitanteId!: string;

  @Column({
    type: 'enum',
    enum: EstadoSolicitudCompra,
    default: EstadoSolicitudCompra.BORRADOR,
  })
  estado!: EstadoSolicitudCompra;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  processInstanceId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
