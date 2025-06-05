
'use server';
/**
 * @fileOverview Extracts transaction details (like amount) from an image of a receipt or invoice.
 *
 * - extractTransactionDetailsFromImage - A function that handles the extraction.
 * - ExtractTransactionDetailsInput - The input type for the function.
 * - ExtractTransactionDetailsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { ExtractTransactionDetailsInput as FlowInputType, ExtractTransactionDetailsOutput as FlowOutputType } from '@/types'; // Using types from global types

const ExtractTransactionDetailsInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a receipt, invoice, or payment slip, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
// Ensure our global type matches Zod schema for type safety, not strictly enforced by Zod but good practice
export type ExtractTransactionDetailsInput = FlowInputType;


const ExtractTransactionDetailsOutputSchema = z.object({
  extractedAmount: z
    .number()
    .nullable()
    .describe('The primary total monetary amount found in the document. Return null if no amount is clearly identifiable or if the document is not a financial receipt/invoice.'),
});
export type ExtractTransactionDetailsOutput = FlowOutputType;


export async function extractTransactionDetailsFromImage(input: ExtractTransactionDetailsInput): Promise<ExtractTransactionDetailsOutput> {
  return extractTransactionDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTransactionDetailsPrompt',
  input: {schema: ExtractTransactionDetailsInputSchema},
  output: {schema: ExtractTransactionDetailsOutputSchema},
  prompt: `You are an AI assistant specialized in extracting information from receipts and invoices.
Analyze the provided image. Your primary goal is to identify and extract the main total monetary value.

Image: {{media url=imageDataUri}}

Instructions:
1. Look for values typically labeled as 'Total', 'Valor Total', 'Amount Due', 'Pagamento', etc.
2. Prioritize the final amount paid or due.
3. If there are multiple amounts, try to determine the most relevant one (e.g., the one after discounts or taxes if applicable, or the largest clear sum).
4. Return the amount as a number (e.g., 123.45). Do not include currency symbols or thousands separators in the number itself.
5. If no clear monetary value can be identified, or if the image is not a receipt/invoice, return null for extractedAmount.
6. Only return the numerical value for 'extractedAmount'.
`,
});

const extractTransactionDetailsFlow = ai.defineFlow(
  {
    name: 'extractTransactionDetailsFlow',
    inputSchema: ExtractTransactionDetailsInputSchema,
    outputSchema: ExtractTransactionDetailsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (output && typeof output.extractedAmount === 'number') {
      // Ensure the number is not NaN, which can happen if AI returns something unexpected
      return { extractedAmount: isNaN(output.extractedAmount) ? null : output.extractedAmount };
    }
    return {extractedAmount: null};
  }
);
