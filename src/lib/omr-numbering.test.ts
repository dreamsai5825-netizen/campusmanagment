import { describe, it, expect } from 'vitest';
import { normalizeAnswersCasing } from './omr-pdf-generator';

describe('OMR Numbering & Normalization', () => {
  it('correctly normalizes continuous sequential numbering across multiple subjects', () => {
    // 3 subjects with 25 questions each.
    // Total questions = 75 (which is <= 120, so questionsPerColumn is 30).
    // Under sequential numbering:
    // - Physics: local 1-25 -> global 1-25
    // - Chemistry: local 1-25 -> global 26-50
    // - Maths: local 1-25 -> global 51-75
    const expectedSubjects = [
      { name: 'Physics', questionCount: 25 },
      { name: 'Chemistry', questionCount: 25 },
      { name: 'Maths', questionCount: 25 },
    ];

    // Mock parsed answers from resolver
    // Chemistry first question should be read from global "26" or "026"
    // Maths first question should be read from global "51" or "051"
    const parsedAnswers = {
      'Physics': {
        '1': 'A',
        '25': 'B',
      },
      'Chemistry': {
        '26': 'C', // global 26 (local 1)
        '50': 'D', // global 50 (local 25)
      },
      'Maths': {
        '051': 'A', // global 51 (local 1)
        '075': 'B', // global 75 (local 25)
      },
    };

    const normalized = normalizeAnswersCasing(parsedAnswers, expectedSubjects);

    // Verify Physics (1-25 mapped to local 1-25)
    expect(normalized['Physics']['1']).toBe('A');
    expect(normalized['Physics']['25']).toBe('B');

    // Verify Chemistry (local 1-25 mapped from global 26-50)
    expect(normalized['Chemistry']['1']).toBe('C');
    expect(normalized['Chemistry']['25']).toBe('D');

    // Verify Maths (local 1-25 mapped from global 51-75)
    expect(normalized['Maths']['1']).toBe('A');
    expect(normalized['Maths']['25']).toBe('B');
  });

  it('uses 30 questions per column universally even when total questions exceeds 120', () => {
    const expectedSubjects = [
      { name: 'Physics', questionCount: 40 }, // colsNeeded = ceil(40/30) = 2. Physics uses cols 0, 1. Starts col 0.
      { name: 'Chemistry', questionCount: 20 }, // colsNeeded = ceil(20/30) = 1. Chem uses col 2. Starts col 2.
    ];

    // Under sequential numbering:
    // - Physics: local 1-40 -> global 1-40
    // - Chemistry: local 1-20 -> global 41-60
    // Start col for Chem is 2.
    // Let's check Chemistry local q=1.
    // colRel = floor(0/30) = 0
    // colIdx = 2 + 0 = 2
    // rowIdx = 0 % 30 = 0
    // globalQNum = 41
    const parsedAnswers = {
      'Physics': {
        '1': 'A',
        '40': 'B',
      },
      'Chemistry': {
        '41': 'C', // global 41 (local 1)
        '60': 'D', // global 60 (local 20)
      },
    };

    const normalized = normalizeAnswersCasing(parsedAnswers, expectedSubjects);

    expect(normalized['Physics']['1']).toBe('A');
    expect(normalized['Physics']['40']).toBe('B');
    expect(normalized['Chemistry']['1']).toBe('C');
    expect(normalized['Chemistry']['20']).toBe('D');
  });
});
