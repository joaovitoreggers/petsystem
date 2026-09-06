import { WorkPermitAtmosphereAlert, WorkPermitGasKey, WorkPermitGasReading } from './entities/work-permit.entity';

interface GasLimit {
  label: string;
  unit: string;
  min?: number;
  max: number;
  decimals: number;
}

// Limites de segurança conforme NR-33 — mesmos valores usados no front-end
// (apps/frontend/.../pet-mock-data.ts GAS_LIMITS). Duplicado aqui para que a
// checagem valha mesmo se a chamada à API não vier do wizard/tela de
// medição (defesa em profundidade).
const GAS_LIMITS: Record<WorkPermitGasKey, GasLimit> = {
  o2: { label: 'O₂', unit: '%', min: 19.5, max: 23, decimals: 1 },
  co: { label: 'CO', unit: 'ppm', max: 25, decimals: 0 },
  h2s: { label: 'H₂S', unit: 'ppm', max: 8, decimals: 1 },
  lel: { label: 'LEL', unit: '%', max: 10, decimals: 0 },
};

/**
 * Retorna um alerta de atmosfera para cada gás fora do limite de segurança
 * na leitura informada. Array vazio quando todos os parâmetros estão dentro
 * da faixa segura.
 */
export function findGasViolations(gas: WorkPermitGasReading, timestamp: string): WorkPermitAtmosphereAlert[] {
  const alerts: WorkPermitAtmosphereAlert[] = [];
  (Object.keys(GAS_LIMITS) as WorkPermitGasKey[]).forEach((key) => {
    const limit = GAS_LIMITS[key];
    const value = gas[key];
    const v = value.toFixed(limit.decimals);
    let message: string | null = null;
    if (limit.min !== undefined && value < limit.min) {
      message = `${limit.label} em ${v} ${limit.unit}, abaixo do mínimo de ${limit.min} ${limit.unit}.`;
    } else if (value > limit.max) {
      message = `${limit.label} em ${v} ${limit.unit}, acima do limite de ${limit.max} ${limit.unit}.`;
    }
    if (message) {
      const limitText = limit.min !== undefined ? `${limit.min}–${limit.max} ${limit.unit}` : `máx. ${limit.max} ${limit.unit}`;
      alerts.push({ gas: key, value, limitText, message, timestamp });
    }
  });
  return alerts;
}
