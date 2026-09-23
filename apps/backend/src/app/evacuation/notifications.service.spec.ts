import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { EmergencyContact } from '../emergency-contacts/entities/emergency-contact.entity';

const mockCreate = jest.fn();

jest.mock('twilio', () => ({
  Twilio: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

function contact(overrides: Partial<EmergencyContact> = {}): EmergencyContact {
  return {
    id: 'contact-1',
    name: 'Marina',
    phone: '+5545999999999',
    companyGroupId: null,
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('NotificationsService', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns not_configured for both channels when Twilio credentials are missing', async () => {
    const service = new NotificationsService(configWith({}));

    const [result] = await service.notifyContacts([contact()], 'oi');

    expect(result).toEqual({ contactId: 'contact-1', sms: 'not_configured', whatsapp: 'not_configured' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('sends SMS and WhatsApp with the right from/to prefixes when fully configured', async () => {
    mockCreate.mockResolvedValue({ sid: 'SM123' });
    const service = new NotificationsService(
      configWith({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'secret',
        TWILIO_SMS_FROM: '+15550001111',
        TWILIO_WHATSAPP_FROM: '+15550002222',
      }),
    );

    const [result] = await service.notifyContacts([contact()], 'oi');

    expect(result).toEqual({ contactId: 'contact-1', sms: 'sent', whatsapp: 'sent' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ from: '+15550001111', to: '+5545999999999', body: 'oi' }),
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'whatsapp:+15550002222',
        to: 'whatsapp:+5545999999999',
        body: 'oi',
      }),
    );
  });

  it('reports failed for a channel whose send rejects, without throwing', async () => {
    mockCreate.mockRejectedValue(new Error('Twilio down'));
    const service = new NotificationsService(
      configWith({
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'secret',
        TWILIO_SMS_FROM: '+15550001111',
      }),
    );

    const [result] = await service.notifyContacts([contact()], 'oi');

    expect(result.sms).toBe('failed');
    expect(result.whatsapp).toBe('not_configured');
  });

  it('builds the public status link from PUBLIC_APP_URL', () => {
    const service = new NotificationsService(configWith({ PUBLIC_APP_URL: 'https://pet.example.com' }));

    expect(service.buildStatusLink('abc-123')).toBe('https://pet.example.com/status/abc-123');
  });
});
