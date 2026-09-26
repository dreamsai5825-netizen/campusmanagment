import { NextRequest, NextResponse } from 'next/server';
import { getOMRMLDatasetSamples } from '@/ai/flows/omr-valuation-flow';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit')) || 60;
    const offset = Number(searchParams.get('offset')) || 0;
    const category = searchParams.get('category') || 'all';

    const samples = await getOMRMLDatasetSamples(limit, offset, category);
    return NextResponse.json(samples);
  } catch (error: any) {
    console.error('[API /api/omr/ml/samples Error]:', error);
    return NextResponse.json(
      {
        total: 0,
        filled_count: 0,
        unfilled_count: 0,
        samples: [],
        error: error.message || 'Failed to fetch dataset samples',
      },
      { status: 200 }
    );
  }
}
