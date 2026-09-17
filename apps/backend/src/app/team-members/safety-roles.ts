/**
 * Funções de segurança que um funcionário pode exercer numa atividade.
 *
 * Lista fechada de propósito: não é cadastro livre. Habilitar alguém como
 * vigia é decisão do SESMT com capacitação por trás, então uma função nova
 * entra aqui junto com a regra que a sustenta — e não por digitação numa
 * tela.
 *
 * Não confundir com cargo profissional (`TeamMember.role`): cargo é a
 * profissão da pessoa, função de segurança é o papel dela dentro da PET.
 */
export const SAFETY_ROLES = ['vigia', 'socorrista'] as const;

export type SafetyRole = (typeof SAFETY_ROLES)[number];
