import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { EmergencyContact } from '../emergency-contacts/entities/emergency-contact.entity';

export type DeliveryStatus = 'sent' | 'failed' | 'not_configured';

export interface ContactDelivery {
  contactId: string;
  sms: DeliveryStatus;
  whatsapp: DeliveryStatus;
}

/**
 * Envio de SMS/WhatsApp via Twilio. Mesmo padrão do OPENAI_API_KEY em
 * PetAnalysisService: sem as variáveis de ambiente, o client fica `null` e
 * o serviço não tenta chamar a API — devolve `not_configured` em vez de
 * derrubar o acionamento da evacuação (o alerta visual e o link de status
 * continuam funcionando mesmo sem Twilio configurado).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly client: Twilio | null;
  private readonly smsFrom: string | null;
  private readonly whatsappFrom: string | null;
  private readonly publicAppUrl: string;

  constructor(configService: ConfigService) {
    const accountSid = configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = configService.get<string>('TWILIO_AUTH_TOKEN');
    this.client = accountSid && authToken ? new Twilio(accountSid, authToken) : null;
    this.smsFrom = configService.get<string>('TWILIO_SMS_FROM') || null;
    this.whatsappFrom = configService.get<string>('TWILIO_WHATSAPP_FROM') || null;
    this.publicAppUrl = configService.get<string>('PUBLIC_APP_URL', 'http://localhost:58080');
  }

  buildStatusLink(alertId: string): string {
    return `${this.publicAppUrl}/status/${alertId}`;
  }

  async notifyContacts(contacts: EmergencyContact[], message: string): Promise<ContactDelivery[]> {
    return Promise.all(
      contacts.map(async (contact) => ({
        contactId: contact.id,
        sms: await this.sendOne(this.smsFrom, contact.phone, message, false),
        whatsapp: await this.sendOne(this.whatsappFrom, contact.phone, message, true),
      })),
    );
  }

  private async sendOne(
    from: string | null,
    to: string,
    body: string,
    whatsapp: boolean,
  ): Promise<DeliveryStatus> {
    if (!this.client || !from) return 'not_configured';
    try {
      await this.client.messages.create({
        body,
        from: whatsapp ? `whatsapp:${from}` : from,
        to: whatsapp ? `whatsapp:${to}` : to,
      });
      return 'sent';
    } catch (err) {
      this.logger.warn(
        `Falha ao enviar ${whatsapp ? 'WhatsApp' : 'SMS'} para ${to}: ${(err as Error).message}`,
      );
      return 'failed';
    }
  }
}
