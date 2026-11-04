import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { KeycloakUsersService } from '../keycloak-admin/services/keycloak-users.service.js';
import { KeycloakGroupsService } from '../keycloak-admin/services/keycloak-groups.service.js';

export interface WorkflowNotificationContext {
  processInstanceId: string;
  processDefinitionKey: string;
  correlativo: string;
  objetoContratacion?: string;
  montoEstimadoBs?: number;
  categoria?: string;
  solicitante?: string;
  solicitanteEmail?: string;
  taskDefinitionKey?: string;
  taskName?: string;
  decision?: string;
  comentarios?: string;
  comiteEvaluador?: string;
  responsableRecepcion?: string;
  encargadoContratacionUserId?: string;
}

@Injectable()
export class WorkflowNotificationsService {
  private readonly logger = new Logger(WorkflowNotificationsService.name);
  private readonly appUrl: string;

  constructor(
    private readonly emailService: EmailService,
    private readonly keycloakUsers: KeycloakUsersService,
    private readonly keycloakGroups: KeycloakGroupsService,
    private readonly config: ConfigService,
  ) {
    this.appUrl = this.config.get<string>('APP_URL') || 'http://localhost:5173';
  }

  /**
   * Obtiene los correos de los usuarios que pertenecen a un grupo específico de Keycloak
   */
  async getEmailsForGroup(groupName: string): Promise<string[]> {
    try {
      const groups = await this.keycloakGroups.findGroups({
        first: 0,
        max: 10,
        search: groupName,
      });
      const targetGroup = groups.find(
        (g) => g.name.toLowerCase() === groupName.toLowerCase(),
      );

      if (!targetGroup) {
        this.logger.debug(`Grupo Keycloak [${groupName}] no encontrado.`);
        return [];
      }

      const members = await this.keycloakGroups.findGroupMembers(targetGroup.id, 0, 50);
      const emails = members
        .map((m) => m.email)
        .filter((e): e is string => Boolean(e && e.includes('@')));

      return emails;
    } catch (err) {
      this.logger.debug(
        `No se pudieron resolver correos para el grupo [${groupName}]: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /**
   * Obtiene el correo de un usuario por su ID o username
   */
  async getEmailForUser(userIdOrUsername?: string): Promise<string | null> {
    if (!userIdOrUsername) return null;
    try {
      // Si ya tiene formato de correo
      if (userIdOrUsername.includes('@')) return userIdOrUsername;

      // Buscar por ID
      try {
        const user = await this.keycloakUsers.findUserById(userIdOrUsername);
        if (user?.email) return user.email;
      } catch {
        // Intentar buscar por username
      }

      const users = await this.keycloakUsers.findUsers({
        first: 0,
        max: 5,
        username: userIdOrUsername,
      });
      const found = users.data?.find((u) => u.username === userIdOrUsername);
      return found?.email || null;
    } catch {
      return null;
    }
  }

  /**
   * 1. Notificación al Iniciar Proceso (PR-GAF-08)
   * Dispara simultáneamente a Existencias/Almacenes y Presupuestos
   */
  async notifyProcessStarted(ctx: WorkflowNotificationContext) {
    const almacenesEmails = await this.getEmailsForGroup('encargado-almacenes');
    const presupuestosEmails = await this.getEmailsForGroup('encargado-presupuestos');
    const allRecipients = Array.from(new Set([...almacenesEmails, ...presupuestosEmails]));

    const fallbackRecipients =
      allRecipients.length > 0
        ? allRecipients
        : ['almacenes@endeandina.bo', 'presupuestos@endeandina.bo'];

    const subject = `[PR-GAF-08] Solicitud Registrada: ${ctx.correlativo} - Verificación Simultánea Requerida`;

    const html = this.buildEmailTemplate({
      title: 'Nueva Solicitud de Adquisición Registrada',
      badgeText: 'Inicio - Verificación Simultánea',
      badgeColor: '#2563eb',
      correlativo: ctx.correlativo,
      objeto: ctx.objetoContratacion || 'No especificado',
      solicitante: ctx.solicitante || 'Unidad Solicitante',
      categoria: ctx.categoria || 'Categoría I',
      montoBs: ctx.montoEstimadoBs,
      message: `Se ha generado una nueva solicitud de adquisiciones en el sistema. Conforme al procedimiento institucional <strong>PR-GAF-08</strong>, se requiere la verificación simultánea de existencias/activos en inventario y disponibilidad presupuestaria.`,
      nextSteps: [
        'Encargado de Activos Fijos / Almacenes: Verificar existencia técnica en inventario.',
        'Encargado de Presupuestos: Confirmar disponibilidad presupuestaria y partida.',
      ],
      instanceId: ctx.processInstanceId,
    });

    await this.emailService.sendMail({
      to: fallbackRecipients,
      subject,
      html,
      text: `Solicitud ${ctx.correlativo} registrada. Requiere verificación simultánea de almacenes y presupuestos. Ingrese a ${this.appUrl}`,
    });
  }

  /**
   * 2. Notificación cuando las verificaciones de existencias y presupuestos están aprobadas
   * Informa a la Unidad de Adquisiciones para la asignación de encargado
   */
  async notifyVerificacionesCompletadas(ctx: WorkflowNotificationContext) {
    const adquisicionesEmails = await this.getEmailsForGroup('jefe-adquisiciones');
    const recipients =
      adquisicionesEmails.length > 0 ? adquisicionesEmails : ['adquisiciones@endeandina.bo'];

    const subject = `[PR-GAF-08] VoBo Existencias y Presupuesto Concluido: ${ctx.correlativo}`;

    const html = this.buildEmailTemplate({
      title: 'Verificación de Existencias y Presupuesto Aprobada',
      badgeText: 'VoBo Verificaciones Aprobado',
      badgeColor: '#16a34a',
      correlativo: ctx.correlativo,
      objeto: ctx.objetoContratacion || 'Adquisición de bienes o servicios',
      solicitante: ctx.solicitante || 'Unidad Solicitante',
      categoria: ctx.categoria || 'Categoría I',
      montoBs: ctx.montoEstimadoBs,
      message: `Las fases simultáneas de <strong>Verificación de Existencias / Activos</strong> y <strong>Verificación de Presupuesto</strong> han sido aprobadas satisfactoriamente. Corresponde proceder a la asignación de la solicitud al Encargado de Contratación.`,
      nextSteps: [
        'Jefatura de Adquisiciones: Asignar al Encargado de Contratación responsable del trámite.',
      ],
      instanceId: ctx.processInstanceId,
    });

    await this.emailService.sendMail({
      to: recipients,
      subject,
      html,
    });
  }

  /**
   * 3. Notificación al asignar Encargado de Contratación
   */
  async notifyEncargadoAsignado(ctx: WorkflowNotificationContext) {
    const userEmail = await this.getEmailForUser(ctx.encargadoContratacionUserId);
    const recipients = userEmail ? [userEmail] : ['adquisiciones@endeandina.bo'];

    const subject = `[PR-GAF-08] Asignación de Solicitud de Contratación: ${ctx.correlativo}`;

    const html = this.buildEmailTemplate({
      title: 'Proceso de Contratación Asignado a su Cargo',
      badgeText: 'Encargado Asignado',
      badgeColor: '#0284c7',
      correlativo: ctx.correlativo,
      objeto: ctx.objetoContratacion || 'Adquisición',
      solicitante: ctx.solicitante || 'Unidad Solicitante',
      categoria: ctx.categoria || 'Categoría I',
      montoBs: ctx.montoEstimadoBs,
      message: `Ha sido asignado como <strong>Encargado de Contratación</strong> para la tramitación de la solicitud ${ctx.correlativo}. Proceda con la revisión de la documentación, anexos y remisión al Jefe Inmediato Superior.`,
      nextSteps: [
        'Adjuntar PDFs firmados, ETs/TDRs, cotizaciones y anexos.',
        'Verificar si corresponde a Bien o Servicio.',
        'Remitir al Inmediato Superior para su aprobación.',
      ],
      instanceId: ctx.processInstanceId,
    });

    await this.emailService.sendMail({
      to: recipients,
      subject,
      html,
    });
  }

  /**
   * 4. Notificación para Aprobación de Inmediato Superior
   */
  async notifyRemisionSuperior(ctx: WorkflowNotificationContext) {
    const superiorEmails = await this.getEmailsForGroup('jefe-inmediato-superior');
    const recipients =
      superiorEmails.length > 0 ? superiorEmails : ['inmediato.superior@endeandina.bo'];

    const subject = `[PR-GAF-08] Solicitud para su Aprobación: ${ctx.correlativo}`;

    const html = this.buildEmailTemplate({
      title: 'Solicitud de Aprobación por Inmediato Superior',
      badgeText: 'Revisión Jerárquica',
      badgeColor: '#eab308',
      correlativo: ctx.correlativo,
      objeto: ctx.objetoContratacion || 'Adquisición',
      solicitante: ctx.solicitante || 'Unidad Solicitante',
      categoria: ctx.categoria || 'Categoría I',
      montoBs: ctx.montoEstimadoBs,
      message: `El Encargado de Contratación ha revisado la documentación técnica y administrativa correspondiente al trámite <strong>${ctx.correlativo}</strong> y la remite para su consideración y visto bueno.`,
      nextSteps: [
        'Jefe Inmediato Superior: Aprobar para continuar el flujo institucional o rechazar con observaciones.',
      ],
      instanceId: ctx.processInstanceId,
    });

    await this.emailService.sendMail({
      to: recipients,
      subject,
      html,
    });
  }

  /**
   * 5. Notificación de VoBos Simultáneos (Financiero + Legal) Concluidos (Cat. II, III y Especial)
   */
  async notifyVobosCompletados(ctx: WorkflowNotificationContext) {
    const gafEmails = await this.getEmailsForGroup('gerencia-administrativa-financiera');
    const gerenciaGeneralEmails = await this.getEmailsForGroup('gerente-general');
    const recipients = Array.from(new Set([...gafEmails, ...gerenciaGeneralEmails]));

    const fallback = recipients.length > 0 ? recipients : ['gaf@endeandina.bo'];

    const subject = `[PR-GAF-08] VoBos Financiero y Legal Concluidos: ${ctx.correlativo}`;

    const html = this.buildEmailTemplate({
      title: 'Vistos Buenos Financiero y Legal Otorgados',
      badgeText: 'VoBos Aprobados',
      badgeColor: '#16a34a',
      correlativo: ctx.correlativo,
      objeto: ctx.objetoContratacion || 'Adquisición',
      solicitante: ctx.solicitante || 'Unidad Solicitante',
      categoria: ctx.categoria || 'Categoría II / III / Especial',
      montoBs: ctx.montoEstimadoBs,
      message: `Se han completado y aprobado los vistos buenos de la <strong>Jefatura Administrativa Financiera</strong> y la <strong>Jefatura Legal</strong>. El proceso avanza a la Gerencia Administrativa Financiera para la designación formal de comités y posterior decisión final.`,
      nextSteps: [
        'GAF: Designación de Comité Evaluador y Responsable de Recepción.',
        'Responsable de Contratación (Gerente General): Decisión definitiva.',
      ],
      instanceId: ctx.processInstanceId,
    });

    await this.emailService.sendMail({
      to: fallback,
      subject,
      html,
    });
  }

  /**
   * 6. Notificación de Decisión Final (Aprobado, Observado o Rechazado)
   */
  async notifyDecisionFinal(ctx: WorkflowNotificationContext) {
    const solicitanteEmail =
      ctx.solicitanteEmail || (await this.getEmailForUser(ctx.solicitante));
    const encargadoEmail = await this.getEmailForUser(ctx.encargadoContratacionUserId);
    const adquisicionesEmails = await this.getEmailsForGroup('jefe-adquisiciones');

    const baseRecipients = Array.from(
      new Set(
        [solicitanteEmail, encargadoEmail, ...adquisicionesEmails].filter(
          (e): e is string => Boolean(e),
        ),
      ),
    );

    const isAprobado = ctx.decision === 'APROBADO';
    const isObservado = ctx.decision === 'OBSERVADO';
    const isRechazado = ctx.decision === 'RECHAZADO';

    let title = 'Resolución de Decisión Final';
    let badgeText = 'Decisión Final';
    let badgeColor = '#64748b';
    let messageText = '';
    const nextSteps: string[] = [];

    if (isAprobado) {
      title = 'Proceso de Adquisición Aprobado';
      badgeText = 'Aprobado Definitivo';
      badgeColor = '#16a34a';
      messageText = `El Responsable de Contratación ha emitido la <strong>APROBACIÓN DEFINITIVA</strong> para dar inicio formal a la contratación del trámite ${ctx.correlativo}.`;
      nextSteps.push('Encargado de Contratación: Proceder con la adjudicación / ejecución.');
      if (ctx.comiteEvaluador) {
        nextSteps.push(`Comité Evaluador Designado: ${ctx.comiteEvaluador}`);
      }
      if (ctx.responsableRecepcion) {
        nextSteps.push(`Responsable de Recepción Designado: ${ctx.responsableRecepcion}`);
      }
    } else if (isObservado) {
      title = 'Solicitud de Adquisición Observada';
      badgeText = 'Observado - Retorna para Subsanación';
      badgeColor = '#d97706';
      messageText = `La solicitud ha sido <strong>OBSERVADA</strong> por el Responsable de Contratación. Observaciones registradas: <em>"${ctx.comentarios || 'Revisar antecedentes y subsanar documentación'}"</em>.`;
      nextSteps.push('Unidad Solicitante / Adquisiciones: Subsanar las observaciones indicadas y reenviar.');
    } else if (isRechazado) {
      title = 'Solicitud de Adquisición Rechazada y Cancelada';
      badgeText = 'Rechazado y Cancelado';
      badgeColor = '#dc2626';
      messageText = `El proceso ha sido <strong>RECHAZADO</strong> por el Responsable de Contratación. Conforme a normativa PR-GAF-08, se procede a la solicitud de los Informes Técnico y Legal motivados para el archivo definitivo.`;
      nextSteps.push('Encargado de Contratación: Adjuntar informes técnico y legal motivados.');
      nextSteps.push('Archivo definitivo del expediente.');
    }

    const subject = `[PR-GAF-08] Decisión Final: ${ctx.correlativo} - ${badgeText}`;

    const html = this.buildEmailTemplate({
      title,
      badgeText,
      badgeColor,
      correlativo: ctx.correlativo,
      objeto: ctx.objetoContratacion || 'Adquisición',
      solicitante: ctx.solicitante || 'Unidad Solicitante',
      categoria: ctx.categoria || 'Categoría I',
      montoBs: ctx.montoEstimadoBs,
      message: messageText,
      nextSteps,
      instanceId: ctx.processInstanceId,
    });

    await this.emailService.sendMail({
      to: baseRecipients.length > 0 ? baseRecipients : ['adquisiciones@endeandina.bo'],
      subject,
      html,
    });
  }

  /**
   * 7. Notificación general de rechazo / devolución intermedia (para Almacenes, Presupuestos o Superior)
   */
  async notifyObservacionIntermedia(ctx: WorkflowNotificationContext, fase: string) {
    const solicitanteEmail =
      ctx.solicitanteEmail || (await this.getEmailForUser(ctx.solicitante));
    const recipients = solicitanteEmail ? [solicitanteEmail] : ['adquisiciones@endeandina.bo'];

    const subject = `[PR-GAF-08] Trámite Observado en ${fase}: ${ctx.correlativo}`;

    const html = this.buildEmailTemplate({
      title: `Observación en ${fase}`,
      badgeText: 'Observado / Devuelto',
      badgeColor: '#d97706',
      correlativo: ctx.correlativo,
      objeto: ctx.objetoContratacion || 'Adquisición',
      solicitante: ctx.solicitante || 'Unidad Solicitante',
      categoria: ctx.categoria || 'Categoría I',
      montoBs: ctx.montoEstimadoBs,
      message: `El proceso <strong>${ctx.correlativo}</strong> fue observado durante la etapa de <strong>${fase}</strong>. Observación registrada: <em>"${ctx.comentarios || 'Subsanación documental requerida'}"</em>.`,
      nextSteps: [
        'La solicitud fue devuelta a su bandeja para ajuste documental o desistimiento.',
        'Ingrese al sistema para corregir las observaciones y reenviar el trámite.',
      ],
      instanceId: ctx.processInstanceId,
    });

    await this.emailService.sendMail({
      to: recipients,
      subject,
      html,
    });
  }

  /**
   * Generador de plantilla HTML corporativa institucional para ENDE ANDINA S.A.M.
   */
  private buildEmailTemplate(params: {
    title: string;
    badgeText: string;
    badgeColor: string;
    correlativo: string;
    objeto: string;
    solicitante: string;
    categoria: string;
    montoBs?: number;
    message: string;
    nextSteps: string[];
    instanceId: string;
  }): string {
    const trackingUrl = `${this.appUrl}/seguimiento?processKey=prGaf08Adquisiciones&instanceId=${params.instanceId}`;
    const montoFormatted = params.montoBs
      ? `Bs. ${Number(params.montoBs).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`
      : 'A determinar';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${params.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <!-- Header Institucional -->
          <tr style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);">
            <td style="padding: 24px 30px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #93c5fd;">
                      ENDE ANDINA S.A.M.
                    </div>
                    <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 4px;">
                      Flujo de Aprobaciones de Adquisiciones (PR-GAF-08)
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 6px 14px; background-color: ${params.badgeColor}; color: #ffffff; font-size: 12px; font-weight: 600; border-radius: 20px;">
                      ${params.badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #0f172a; font-weight: 600;">
                ${params.title}
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                ${params.message}
              </p>

              <!-- Ficha de Datos del Proceso -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px;">
                      <tr>
                        <td width="35%" style="color: #64748b; font-weight: 600;">N° Solicitud / Correlativo:</td>
                        <td width="65%" style="color: #0f172a; font-weight: 700;">${params.correlativo}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Objeto de Contratación:</td>
                        <td style="color: #0f172a;">${params.objeto}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Unidad Solicitante:</td>
                        <td style="color: #0f172a;">${params.solicitante}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Categoría / Nivel:</td>
                        <td style="color: #0f172a;">${params.categoria}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Monto Estimado:</td>
                        <td style="color: #0f172a; font-weight: 600;">${montoFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Siguientes Pasos -->
              ${
                params.nextSteps.length > 0
                  ? `
              <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Siguientes Acciones / Responsables:
                </div>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
                  ${params.nextSteps.map((step) => `<li>${step}</li>`).join('')}
                </ul>
              </div>`
                  : ''
              }

              <!-- Botón de Acción -->
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="${trackingUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 600; border-radius: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                  Ver Expediente y Dar Seguimiento
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer Institucional -->
          <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <td style="padding: 20px 30px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
              Este es un correo institucional generado automáticamente por el Sistema de Flujo de Aprobaciones de Adquisiciones de <strong>ENDE ANDINA S.A.M.</strong> conforme al procedimiento PR-GAF-08.<br>
              Por favor no responda directamente a esta dirección de correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
