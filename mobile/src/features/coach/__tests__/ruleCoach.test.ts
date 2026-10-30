import { COACH_SCENARIOS } from '../scenarios';
import { coachWithRules } from '../ruleCoach';

const scenario = COACH_SCENARIOS[0]!;

function feedback(message: string, scenarioId = scenario.id) {
  const target = COACH_SCENARIOS.find((item) => item.id === scenarioId) ?? scenario;
  return coachWithRules({ scenarioId, message, scenario: target });
}

describe('rule-based conversation coach', () => {
  it('reports that no model was used', () => {
    const result = feedback('I am a computing student. What are you working on?');
    expect(result.generatedByModel).toBe(false);
    expect(result.provider).toBe('converge-rule-engine');
  });

  it('flags a missing question as a specific improvement', () => {
    const result = feedback('I am a computing student working on a small web project.');
    expect(result.improvements.some((item) => /no question/i.test(item))).toBe(true);
  });

  it('credits a question as a strength', () => {
    const result = feedback('I am learning photography. What do you shoot with?');
    expect(result.strengths.some((item) => /question/i.test(item))).toBe(true);
  });

  it('quotes the filler phrase it objects to', () => {
    const result = feedback('I just wanted to say hello and ask what you are building?');
    const improvement = result.improvements.find((item) => /just wanted to/i.test(item));
    expect(improvement).toBeDefined();
    expect(improvement).toContain('just wanted to');
  });

  it('removes filler from the suggested revision', () => {
    const result = feedback('I just wanted to say hello. What do you work on?');
    expect(result.suggestedRevision.toLowerCase()).not.toContain('just wanted to');
  });

  it('warns when a first message is too long', () => {
    const long = `I am a student. ${'This is a detail about my project and what I enjoy. '.repeat(20)}`;
    const result = feedback(long);
    expect(result.improvements.some((item) => /long for a first message/i.test(item))).toBe(true);
  });

  it('asks for more detail when the message is very short', () => {
    const result = feedback('Hi there');
    expect(result.improvements.some((item) => /very short/i.test(item))).toBe(true);
  });

  it('asks for an introduction in the introduce-yourself scenario', () => {
    const result = feedback('What do you like about photography?', 'introduce-yourself');
    expect(result.improvements.some((item) => /who you are/i.test(item))).toBe(true);
  });

  it('always provides a next step and a revision', () => {
    const result = feedback('Hello');
    expect(result.nextStep.length).toBeGreaterThan(10);
    expect(result.suggestedRevision.length).toBeGreaterThan(0);
  });

  it('has a strength even for an empty-ish message so feedback is never blank', () => {
    const result = feedback('   ');
    expect(result.strengths.length).toBeGreaterThan(0);
  });
});
