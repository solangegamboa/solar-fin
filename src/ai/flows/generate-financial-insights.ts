// src/ai/flows/generate-financial-insights.ts
'use server';

/**
 * @fileOverview Generates personalized financial insights and saving tips based on user's financial data.
 *
 * - generateFinancialInsights - A function that generates financial insights.
 * - FinancialDataInput - The input type for the generateFinancialInsights function.
 * - FinancialInsightsOutput - The return type for the generateFinancialInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialDataInputSchema = z.object({
  income: z.number().describe('The user monthly income in Brazilian Real.'),
  expenses: z.array(
    z.object({
      category: z.string().describe('The category of the expense.'),
      amount: z.number().describe('The amount spent in Brazilian Real for this category.'),
    })
  ).describe('A list of expenses, including the category and amount.'),
  loans: z.array(
    z.object({
      description: z.string().describe('Description of the loan'),
      amount: z.number().describe('The loan amount in Brazilian Real.'),
      interestRate: z.number().describe('The interest rate of the loan.'),
      monthlyPayment: z.number().describe('The monthly payment amount in Brazilian Real.'),
    })
  ).describe('A list of loans the user has.'),
  creditCards: z.array(
    z.object({
      name: z.string().describe('The name of the credit card.'),
      limit: z.number().describe('The credit card limit in Brazilian Real.'),
      balance: z.number().describe('The current balance on the credit card in Brazilian Real.'),
      dueDate: z.string().describe('The due date of the credit card bill (YYYY-MM-DD).'),
    })
  ).describe('A list of credit cards the user has.'),
});

export type FinancialDataInput = z.infer<typeof FinancialDataInputSchema>;

const FinancialInsightsOutputSchema = z.object({
  savingTips: z.array(z.string()).describe('A list of personalized saving tips for the user.'),
  summary: z.string().describe('A short summary of the user financial situation.'),
});

export type FinancialInsightsOutput = z.infer<typeof FinancialInsightsOutputSchema>;

export async function generateFinancialInsights(input: FinancialDataInput): Promise<FinancialInsightsOutput> {
  return generateFinancialInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'financialInsightsPrompt',
  input: {schema: FinancialDataInputSchema},
  output: {schema: FinancialInsightsOutputSchema},
  prompt: `Você é um especialista financeiro pessoal no Brasil.

  Analise os dados financeiros fornecidos e forneça dicas de economia personalizadas e um resumo da situação financeira do usuário. Use Real Brasileiro (BRL) para todas as quantias monetárias.

  Dados Financeiros:
  Renda Mensal: {{{income}}} BRL
  Despesas:
  {{#each expenses}}
  - Categoria: {{{category}}}, Valor: {{{amount}}} BRL
  {{/each}}
  Empréstimos:
  {{#each loans}}
  - Descrição: {{{description}}}, Valor: {{{amount}}} BRL, Taxa de Juros: {{{interestRate}}}, Pagamento Mensal: {{{monthlyPayment}}} BRL
  {{/each}}
  Cartões de Crédito:
  {{#each creditCards}}
  - Nome: {{{name}}}, Limite: {{{limit}}} BRL, Saldo: {{{balance}}} BRL, Vencimento: {{{dueDate}}}
  {{/each}}

  Instruções:
  1. Forneça um resumo conciso da situação financeira do usuário.
  2. Elabore uma lista de dicas de economia personalizadas, identificando áreas onde o usuário pode reduzir gastos e otimizar suas finanças. Seja específico e prático.
`,
});

const generateFinancialInsightsFlow = ai.defineFlow(
  {
    name: 'generateFinancialInsightsFlow',
    inputSchema: FinancialDataInputSchema,
    outputSchema: FinancialInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
