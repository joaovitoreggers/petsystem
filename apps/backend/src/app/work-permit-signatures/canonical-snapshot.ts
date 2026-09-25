import { createHash } from 'crypto';

/**
 * Serialização estável (chaves ordenadas, recursiva) do conteúdo assinado —
 * é o que garante que o mesmo conteúdo sempre produz o mesmo hash,
 * independente da ordem em que os campos chegaram no corpo da requisição.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Hash do conteúdo assinado — sempre calculado aqui, no back-end, nunca
 * aceito vindo do cliente (ver WorkPermitSignaturesService e
 * WorkPermitsService.create/close).
 */
export function computeContentHash(snapshot: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalize(snapshot)).digest('hex');
}
