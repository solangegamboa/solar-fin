
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-financial-insights.ts';
import '@/ai/flows/extract-transaction-details-flow.ts';
import '@/ai/flows/extract-card-info-flow.ts';
import '@/ai/flows/extract-statement-transactions-flow.ts';
import '@/ai/flows/extract-card-invoice-items-flow.ts';

    