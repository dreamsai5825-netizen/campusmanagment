'use server';
/**
 * @fileOverview A flow for generating educational plans for teachers.
 *
 * - generatePlan - A function that handles the plan generation process.
 * - GeneratePlanInput - The input type for the generatePlan function.
 * - GeneratePlanOutput - The return type for the generatePlan function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GeneratePlanInputSchema = z.object({
  planType: z.literal('semester-plan'),
  subject: z.string().describe('The subject being taught, e.g., Mathematics.'),
  grade: z.string().describe('The grade level of the students, e.g., Grade 8.'),
  topic: z
    .string()
    .describe('The specific topic or focus for the plan.'),
  syllabusContent: z.string().optional().describe('The content of the syllabus file provided by the user.'),
  customPrompt: z.string().optional().describe('Additional instructions from the user.'),
});
export type GeneratePlanInput = z.infer<typeof GeneratePlanInputSchema>;

const GeneratePlanOutputSchema = z.object({
  plan: z
    .string()
    .describe('The generated educational plan content in markdown format.'),
});
export type GeneratePlanOutput = z.infer<typeof GeneratePlanOutputSchema>;

export async function generatePlan(
  input: GeneratePlanInput
): Promise<GeneratePlanOutput> {
  return generatePlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePlanPrompt',
  input: { schema: GeneratePlanInputSchema },
  output: { schema: GeneratePlanOutputSchema },
  prompt: `You are an expert educational assistant AI. Your task is to help a teacher create a structured and actionable plan.

Generate a semester plan for a {{grade}} {{subject}} class.

The main topic or focus is: '{{topic}}'.

{{#if syllabusContent}}
The following syllabus should be used as the primary reference for the plan structure and content:
--- SYLLABUS ---
{{{syllabusContent}}}
--- END SYLLABUS ---
{{/if}}

{{#if customPrompt}}
Follow these additional instructions from the teacher:
--- INSTRUCTIONS ---
{{{customPrompt}}}
--- END INSTRUCTIONS ---
{{/if}}

The output should be a well-formatted markdown document that is ready to be used by the teacher.

1. First, give a short high-level overview with topics, key learning objectives, and major assessments over a 15-week semester.

2. Then add a separate markdown section with the heading "Per-class breakdown".
   - Under that heading, include a single flat list (numbered or bulleted).
   - EACH list item must describe the PORTION TO BE COVERED IN ONE TEACHING HOUR, in chronological order, using short phrases (no long paragraphs).
   - Do NOT nest lists and do NOT use markdown tables for this section.

Return the entire text (including the "Per-class breakdown" section) in the single string field 'plan'.`,
});

const generatePlanFlow = ai.defineFlow(
  {
    name: 'generatePlanFlow',
    inputSchema: GeneratePlanInputSchema,
    outputSchema: GeneratePlanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate plan.');
    }
    return output;
  }
);
