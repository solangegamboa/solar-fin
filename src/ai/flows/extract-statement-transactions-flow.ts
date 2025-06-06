
'use server';
/**
 * @fileOverview Extracts multiple transactions from an image of a bank statement.
 *
 * - extractStatementTransactionsFromImage - A function that handles the extraction.
 * - ExtractStatementTransactionsInput - The input type for the function.
 * - ExtractStatementTransactionsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type {
  ExtractStatementTransactionsInput as FlowInputType,
  ExtractStatementTransactionsOutput as FlowOutputType,
  ExtractedTransaction as ExtractedTransactionType
} from '@/types';

// Schema for a single extracted transaction by AI (before user review)
const ExtractedTransactionSchema = z.object({
  rawText: z.string().nullable().describe('The raw text segment from the statement line that was identified as a transaction.'),
  description: z.string().nullable().describe('The extracted description of the transaction (e.g., "PADARIA DO ZE", "PIX RECEBIDO JOSE S.").'),
  amount: z.number().nullable().describe('The monetary amount of the transaction. Negative for expenses, positive for income. Null if not clearly identifiable.'),
  date: z.string().nullable().describe('The date of the transaction in YYYY-MM-DD format. Null if not clearly identifiable. The AI should try to infer the year if only day/month is present, using the defaultYear provided in input if available.'),
  typeSuggestion: z.enum(['income', 'expense', 'unknown']).nullable().describe('AI suggestion for the transaction type. "unknown" if it cannot determine or if it is ambiguous.'),
});

// Input schema for the Genkit flow
const ExtractStatementTransactionsInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a bank statement, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  defaultYear: z.number().optional().describe('Optional. The default year to assume for dates where only day/month is present (e.g., 2023). If not provided, AI should attempt to infer or use current year contextually.'),
});
export type ExtractStatementTransactionsInput = FlowInputType;


// Output schema for the Genkit flow
const ExtractStatementTransactionsOutputSchema = z.object({
  transactions: z.array(ExtractedTransactionSchema).describe('A list of transactions extracted from the statement.'),
  statementPeriod: z.string().nullable().describe('The overall period of the statement if identifiable (e.g., "Junho/2023", "01/06/2023 - 30/06/2023").'),
  accountName: z.string().nullable().describe('The name of the bank or account holder if identifiable from the statement.'),
});
export type ExtractStatementTransactionsOutput = FlowOutputType;
export type ExtractedTransaction = ExtractedTransactionType;


export async function extractStatementTransactionsFromImage(input: ExtractStatementTransactionsInput): Promise<ExtractStatementTransactionsOutput> {
  return extractStatementTransactionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractStatementTransactionsPrompt',
  input: {schema: ExtractStatementTransactionsInputSchema},
  output: {schema: ExtractStatementTransactionsOutputSchema},
  prompt: `You are an expert AI assistant specialized in analyzing images of Brazilian bank statements (extratos bancários) to extract transaction details.
Analyze the provided image of a bank statement.

Image: {{media url=imageDataUri}}
{{#if defaultYear}}Default Year for partial dates (DD/MM): {{{defaultYear}}}{{/if}}

Instructions:
1.  **Identify Transaction Lines:** Carefully scan the image for lines that represent individual financial transactions. These often include a date, a description, and a value.
2.  **For each transaction line, extract the following:**
    *   \`rawText\`: The full text of the line or segment you identified as a transaction.
    *   \`description\`: The textual description of the transaction (e.g., "Compra Supermercado", "PIX Maria Silva", "Pagamento Conta Luz"). Try to be concise but informative.
    *   \`amount\`: The monetary value.
        *   Look for common Brazilian currency indicators (R$).
        *   Crucially, determine if it's an income (entrada/crédito, usually positive or without a clear negative sign next to the value itself but implied by context like "SALDO ANTERIOR" vs "SALDO ATUAL") or an expense (saída/débito, often indicated by a minus sign "-", a "D" or "C" notation, or columns). Represent expenses as NEGATIVE numbers (e.g., -50.35) and income as POSITIVE numbers (e.g., 1200.00). If the sign is ambiguous, make a best guess or return null.
    *   \`date\`: The date of the transaction.
        *   Attempt to parse dates in DD/MM or DD/MM/YYYY format.
        *   If only DD/MM is found, use the 'defaultYear' provided in the input to construct a full YYYY-MM-DD date. If 'defaultYear' is not provided, or if the month suggests a year change (e.g., statement is for Jan, previous entries were Dec), try to infer the correct year based on the context of other dates in the statement or assume the current year. If impossible to determine, return null. Format as YYYY-MM-DD.
    *   \`typeSuggestion\`: Suggest 'income', 'expense', or 'unknown' based on the amount's sign or context. If amount is positive, suggest 'income'. If negative, suggest 'expense'.
3.  **Overall Statement Info (if available):**
    *   \`statementPeriod\`: If the statement shows a period (e.g., "Extrato de Maio/2023", "01/05/2023 a 31/05/2023"), extract it.
    *   \`accountName\`: If a bank name (e.g., "Banco Itaú", "Nubank") or account holder name is clearly visible and associated with the statement, extract it.
4.  **Format:** Return all extracted data in the specified JSON format. If a field for a specific transaction cannot be determined, return null for that field. If no transactions are found, return an empty array for 'transactions'.

Common Brazilian terms:
- Débito (D), C/D (Compra Débito): Expense
- Crédito (C): Income
- Pix Enviado: Expense
- Pix Recebido: Income
- Pagamento (Pgto, Pag): Expense
- Transferência (Transf.): Can be income or expense, check context. TED/DOC enviado is expense, recebido is income.
- Saque: Expense
- Depósito (Dep): Income
- Saldo Anterior / Saldo Atual: Not transactions themselves, but can give context for amounts.

Focus on individual transaction lines. Avoid summarizing or calculating balances.
`,
});

const extractStatementTransactionsFlow = ai.defineFlow(
  {
    name: 'extractStatementTransactionsFlow',
    inputSchema: ExtractStatementTransactionsInputSchema,
    outputSchema: ExtractStatementTransactionsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (output && output.transactions) {
      // Ensure amounts are numbers and types are reasonable
      output.transactions = output.transactions.map(tx => {
        let numericAmount = tx.amount;
        if (typeof tx.amount === 'string') {
          try {
            numericAmount = parseFloat(tx.amount.replace('.', '').replace(',', '.'));
          } catch {
            numericAmount = null;
          }
        }
        
        let suggestedType = tx.typeSuggestion;
        if (numericAmount !== null && numericAmount > 0 && suggestedType !== 'income') {
            suggestedType = 'income';
        } else if (numericAmount !== null && numericAmount < 0 && suggestedType !== 'expense') {
            suggestedType = 'expense';
        } else if (numericAmount === 0) {
             suggestedType = 'unknown'; // Or handle as per specific logic for zero-amount entries
        }


        return {
          ...tx,
          amount: numericAmount,
          typeSuggestion: suggestedType || 'unknown'
        };
      });
    }
    return output || { transactions: [], statementPeriod: null, accountName: null };
  }
);

