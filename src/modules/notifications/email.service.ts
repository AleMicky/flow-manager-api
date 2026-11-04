import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;
  private readonly isEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<number>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true' || port === 465;

    this.fromAddress =
      this.config.get<string>('SMTP_FROM') ||
      '"ENDE ANDINA S.A.M. - Adquisiciones" <notificaciones@endeandina.bo>';

    if (host) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user && pass ? { user, pass } : undefined,
          tls: { rejectUnauthorized: false },
        });
        this.isEnabled = true;
        this.logger.log(`Servicio de correo SMTP inicializado hacia ${host}:${port}`);
      } catch (err) {
        this.logger.warn(`Error al inicializar transporte SMTP: ${err instanceof Error ? err.message : String(err)}`);
        this.isEnabled = false;
      }
    } else {
      this.isEnabled = false;
      this.logger.log('SMTP_HOST no configurado. Las notificaciones por correo se registrarán en los logs del sistema.');
    }
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    const recipients = Array.isArray(options.to) ? options.to.filter(Boolean) : [options.to];
    if (recipients.length === 0) {
      this.logger.debug('No hay destinatarios válidos para la notificación por correo.');
      return false;
    }

    const toStr = recipients.join(', ');

    if (!this.isEnabled || !this.transporter) {
      this.logger.log(`\n================= [SIMULACIÓN NOTIFICACIÓN EMAIL - ENDE ANDINA] =================\nPara: ${toStr}\nAsunto: ${options.subject}\nRemitente: ${this.fromAddress}\n--------------------------------------------------------------------------------\n${options.text || 'Contenido HTML enviado (revisar plantilla en cliente)'}\n================================================================================`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: toStr,
        cc: options.cc,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      this.logger.log(`Correo institucional enviado con éxito a: ${toStr} | Asunto: ${options.subject}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Fallo al enviar correo a ${toStr}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

