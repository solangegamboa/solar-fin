
'use server';
/**
 * @fileOverview Extracts multiple purchase items from an image of a credit card invoice/statement.
 *
 * - extractCardInvoiceItemsFromImage - A function that handles the extraction.
 * - ExtractCardInvoiceInput - The input type for the function.
 * - ExtractCardInvoiceOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type {
  ExtractCardInvoiceInput as FlowInputType,
  ExtractCardInvoiceOutput as FlowOutputType,
  ExtractedInvoiceItem as ExtractedInvoiceItemType
} from '@/types';

// Schema for a single extracted item by AI (before user review)
const ExtractedInvoiceItemSchema = z.object({
  rawText: z.string().nullable().describe('The raw text segment from the invoice line that was identified as a purchase item.'),
  description: z.string().nullable().describe('The extracted description of the purchase (e.g., "UBER TRIP", "SPOTIFY AB", "MERCADOLIVRE").'),
  amount: z.number().nullable().describe('The monetary amount of the purchase item. This should always be a positive number representing the charge. Null if not clearly identifiable.'),
  date: z.string().nullable().describe('The date of the purchase in YYYY-MM-DD format. Null if not clearly identifiable. The AI should try to infer the year and month using the defaultMonthYear or billingPeriod provided in input if available.'),
});

// Input schema for the Genkit flow
const ExtractCardInvoiceInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo or screenshot of a credit card invoice/statement, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  defaultMonthYear: z.string().optional().describe('Optional. The default month and year (e.g., "07/2024" or "2024-07") to assume for dates where only day is present. This can be derived from the invoice billing period.'),
});
export type ExtractCardInvoiceInput = FlowInputType;


// Output schema for the Genkit flow
const ExtractCardInvoiceOutputSchema = z.object({
  items: z.array(ExtractedInvoiceItemSchema).describe('A list of purchase items extracted from the invoice.'),
  billingPeriod: z.string().nullable().describe('The overall billing period of the invoice if identifiable (e.g., "Julho/2024", "Vencimento 10/08/2024 referente a Julho/2024").'),
  cardLastDigits: z.string().nullable().describe('Last 4 digits of the credit card number, if visible on the invoice.'),
  cardNameHint: z.string().nullable().describe('Any name or label associated with the card on the invoice (e.g., "Meu Cartão Visa", "Cartão Final 1234").'),
});
export type ExtractCardInvoiceOutput = FlowOutputType;
export type ExtractedInvoiceItem = ExtractedInvoiceItemType;


export async function extractCardInvoiceItemsFromImage(input: ExtractCardInvoiceInput): Promise<ExtractCardInvoiceOutput> {
  return extractCardInvoiceItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractCardInvoiceItemsPrompt',
  input: {schema: ExtractCardInvoiceInputSchema},
  output: {schema: ExtractCardInvoiceOutputSchema},
  prompt: `You are an expert AI assistant specialized in analyzing images of Brazilian credit card invoices (faturas de cartão de crédito) to extract individual purchase items.
Analyze the provided image of a credit card invoice.

Image: {{media url=imageDataUri}}
{{#if defaultMonthYear}}Default Month/Year for partial dates (DD): {{{defaultMonthYear}}} (format MM/YYYY or YYYY-MM){{/if}}

Instructions:
1.  **Identify Purchase Item Lines:** Carefully scan the image for lines that represent individual purchases or charges. These typically include a date of purchase, a description (merchant name), and a value. Ignore summary lines like "Total da Fatura", "Pagamento Recebido", "Saldo Anterior".
2.  **For each purchase item line, extract the following:**
    *   \`rawText\`: The full text of the line or segment you identified as a purchase.
    *   \`description\`: The textual description of the purchase (e.g., "UBER DO BRASIL TECNOLOGIA", "SPOTIFY", "PAG*NOMEDALOJA", "IFOOD"). Try to capture the merchant name.
    *   \`amount\`: The monetary value of the purchase. This should be a POSITIVE number. Values in invoices are typically charges. If you see credits or payments, try to ignore them unless they are clearly purchase refunds (which are rare as line items).
    *   \`date\`: The date of the purchase.
        *   Look for dates in DD/MM format. Use the 'defaultMonthYear' (if provided) or infer from a visible 'billingPeriod' on the invoice to construct a full YYYY-MM-DD date. For example, if 'defaultMonthYear' is "07/2024" and the line shows "15/07", the date is "2024-07-15". If only "15" is visible and the invoice refers to "Julho/2024", the date is "2024-07-15". If impossible to determine, return null. Format as YYYY-MM-DD.
3.  **Overall Invoice Info (if available):**
    *   \`billingPeriod\`: If the invoice shows a billing period (e.g., "Fatura de Julho/2024", "Período de 20/06/2024 a 19/07/2024"), extract it.
    *   \`cardLastDigits\`: If the last 4 digits of the credit card are visible (e.g., "final 1234"), extract just the digits "1234".
    *   \`cardNameHint\`: If there's a name associated with the card on the invoice (e.g. "Meu Cartão", "Cartão Adicional"), extract it.
4.  **Format:** Return all extracted data in the specified JSON format. If a field for a specific item cannot be determined, return null for that field. If no purchase items are found, return an empty array for 'items'.
5.  **Focus on individual charges/purchases.** Do not include interest, fees, or payments made towards the invoice total as items, unless they are explicitly listed like product purchases.

Common Brazilian invoice terms:
- COMPRA APROVADA, PAGAMENTO APROVADO: Often prefixes for purchases.
- ESTABELECIMENTO: Merchant.
- VALOR (R$): Amount.
- DATA: Date of purchase.
- PARCELA X/Y: Indicates an installment. For this task, extract the line item as a single purchase; installment handling will be done later. Extract the full amount of the charge shown on that line for that month.

Example item: "15/07 UBER TRIP SAO PAULO R$ 25,30"
- description: "UBER TRIP SAO PAULO"
- amount: 25.30
- date: (e.g., "2024-07-15" if defaultMonthYear is "07/2024")

Ignore lines that are clearly totals, payments, or adjustments unless they are itemized like regular purchases.
`,
});

const extractCardInvoiceItemsFlow = ai.defineFlow(
  {
    name: 'extractCardInvoiceItemsFlow',
    inputSchema: ExtractCardInvoiceInputSchema,
    outputSchema: ExtractCardInvoiceOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (output && output.items) {
      // Ensure amounts are numbers and positive
      output.items = output.items.map(item => {
        let numericAmount = item.amount;
        if (typeof item.amount === 'string') {
          try {
            numericAmount = parseFloat(String(item.amount).replace(/[^0-9,.-]+/g,"").replace('.', '').replace(',', '.'));
          } catch {
            numericAmount = null;
          }
        }
        // Amounts from card statements are charges, so they should be positive.
        // If AI extracts a negative value, it might be a refund or error, make it positive for now.
        if (numericAmount !== null && numericAmount < 0) {
            numericAmount = Math.abs(numericAmount);
        }

        return {
          ...item,
          amount: numericAmount,
        };
      });
    }
    return output || { items: [], billingPeriod: null, cardLastDigits: null, cardNameHint: null };
  }
);

    