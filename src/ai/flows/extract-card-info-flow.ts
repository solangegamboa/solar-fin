
'use server';
/**
 * @fileOverview Extracts credit card issuer, network, and product name from an image.
 *
 * - extractCardInfoFromImage - A function that handles the extraction.
 * - ExtractCardInfoInput - The input type for the function.
 * - ExtractCardInfoOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { ExtractCardInfoInput as FlowInputType, ExtractCardInfoOutput as FlowOutputType } from '@/types';

const ExtractCardInfoInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a credit card, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractCardInfoInput = FlowInputType;


const ExtractCardInfoOutputSchema = z.object({
  issuerName: z
    .string()
    .nullable()
    .describe('The name of the card issuer or bank (e.g., "Nubank", "Bradesco", "Itaú"). Return null if not identifiable.'),
  cardNetwork: z
    .string()
    .nullable()
    .describe('The card network (e.g., "Visa", "Mastercard", "Amex", "Elo"). Return null if not identifiable.'),
  cardProductName: z
    .string()
    .nullable()
    .describe('Any specific product name visible on the card (e.g., "Platinum", "Gold", "Black", "Ultravioleta"). Return null if not identifiable.'),
  suggestedCardName: z
    .string()
    .nullable()
    .describe('A suggested full name for the card, combining issuer, network, and product name if available. Example: "Nubank Mastercard Ultravioleta". Return null if insufficient info.'),
});
export type ExtractCardInfoOutput = FlowOutputType;


export async function extractCardInfoFromImage(input: ExtractCardInfoInput): Promise<ExtractCardInfoOutput> {
  return extractCardInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractCardInfoPrompt',
  input: {schema: ExtractCardInfoInputSchema},
  output: {schema: ExtractCardInfoOutputSchema},
  prompt: `You are an AI assistant specialized in extracting information from images of Brazilian credit cards.
Analyze the provided image of a credit card. Your goal is to identify the card issuer (bank), the card network (brand like Visa, Mastercard), and any specific product name (like Gold, Platinum, Black, Ultravioleta).

Image: {{media url=imageDataUri}}

Instructions:
1.  Identify the **Issuer Name**: This is the bank or financial institution that issued the card (e.g., Nubank, Itaú, Bradesco, Santander, Banco do Brasil, Caixa). If not clear, return null.
2.  Identify the **Card Network**: This is the brand of the card (e.g., Visa, Mastercard, Elo, American Express, Hipercard). If not clear, return null.
3.  Identify the **Card Product Name**: This is any specific tier or product name mentioned on the card, often associated with benefits (e.g., Gold, Platinum, Black, Grafite, Nanquim, Signature, Infinite, Ultravioleta). If not clear, return null.
4.  Based on the extracted information, formulate a **Suggested Card Name**. Combine the issuer, network, and product name in a logical order. For example, "Nubank Mastercard Ultravioleta" or "Bradesco Visa Gold". If any part is missing, construct the name with available parts. If no significant information is found, return null for suggestedCardName.
5.  **IMPORTANT SECURITY NOTE:** DO NOT attempt to extract or return the full credit card number, expiration date, CVV, or cardholder name. Only return the issuer, network, product name, and the suggested combined card name.

Return the information in the specified JSON format. If a piece of information cannot be clearly identified, return null for that specific field.
`,
});

const extractCardInfoFlow = ai.defineFlow(
  {
    name: 'extractCardInfoFlow',
    inputSchema: ExtractCardInfoInputSchema,
    outputSchema: ExtractCardInfoOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    
    // Post-processing to construct suggestedCardName if AI didn't do it or to refine it
    if (output) {
        if (!output.suggestedCardName && (output.issuerName || output.cardNetwork || output.cardProductName)) {
            const parts = [output.issuerName, output.cardNetwork, output.cardProductName].filter(Boolean);
            output.suggestedCardName = parts.join(' ');
        }
        if (output.suggestedCardName?.trim() === "") {
            output.suggestedCardName = null;
        }
        return output;
    }
    
    return {
        issuerName: null,
        cardNetwork: null,
        cardProductName: null,
        suggestedCardName: null
    };
  }
);
