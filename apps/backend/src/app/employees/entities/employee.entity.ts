import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Funcionário: pessoa de campo que carrega um crachá (QR) e é validada nas
 * tentativas de entrada — não necessariamente um Usuario (que faz login no
 * sistema). As duas permissões abaixo são independentes uma da outra.
 */
@Entity('employees')
export class Employee {
  // Mesmo padrão do User: uuid gerado em código (ver EmployeeRepository.create),
  // e é esse valor que vira o conteúdo do QR do crachá.
  @PrimaryColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  role!: string;

  @Column({ name: 'can_access_risk_areas', default: false })
  canAccessRiskAreas!: boolean;

  @Column({ name: 'can_perform_corrective_service', default: false })
  canPerformCorrectiveService!: boolean;

  // Dono de verdade do registro para isolamento entre tenants — mesma
  // lógica de TeamMember/WorkPermit. Sem campo de unidade em texto livre
  // aqui (o crachá nunca teve um), então `branchId` só existe quando quem
  // cadastrou já estava restrito a uma filial específica.
  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
