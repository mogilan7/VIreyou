import { describe, it, expect } from 'vitest';
import { detectDeviations, detectCrossDomainLinks } from '../insights';
import { CONFIG } from '../config';

describe('Insights Layer Tests', () => {
  it('should detect a positive spike in HRV', () => {
    const historical = [50, 52, 55, 48, 51]; // median = 51, sd approx 2.3
    const today = 60; // diff = 9, which > 1.5 * 2.3 (3.45)
    
    const deviation = detectDeviations(today, historical, 'hrv', false);
    expect(deviation).not.toBeNull();
    expect(deviation?.domain).toBe('hrv');
    expect(deviation?.type).toBe('spike');
    expect(deviation?.direction).toBe('up');
  });

  it('should not detect a spike if within normal range', () => {
    const historical = [50, 52, 55, 48, 51];
    const today = 53; 
    
    const deviation = detectDeviations(today, historical, 'hrv', false);
    expect(deviation).toBeNull();
  });

  it('should fallback to 10% SD if variance is 0', () => {
    const historical = [50, 50, 50, 50, 50]; // median = 50, sd = 5
    const today = 58; // diff 8 > 1.5 * 5 (7.5)
    
    const deviation = detectDeviations(today, historical, 'hrv', false);
    expect(deviation).not.toBeNull();
    expect(deviation?.direction).toBe('up');
  });

  it('should detect a target-based deviation (steps)', () => {
    const target = 10000;
    const today = 6000; // missing 40%
    
    const deviation = detectDeviations(today, [], 'steps', true, target);
    expect(deviation).not.toBeNull();
    expect(deviation?.direction).toBe('down');
  });

  it('should detect a cross-domain link (alcohol -> sleep)', () => {
    const pairs = [
      { triggerValue: true, effectValue: 40 },
      { triggerValue: true, effectValue: 42 },
      { triggerValue: true, effectValue: 39 },
      { triggerValue: true, effectValue: 41 },
      { triggerValue: true, effectValue: 43 },
      { triggerValue: false, effectValue: 55 } // Should be ignored
    ];
    
    const baseline = 50; // trigger condition: < 45
    
    const insight = detectCrossDomainLinks(pairs, baseline, 'alcohol_sleep');
    expect(insight).not.toBeNull();
    expect(insight?.confidence).toBe(1);
    expect(insight?.occurrences).toBe(5);
  });

  it('should not detect a cross-domain link if < MIN_PAIRS', () => {
    const pairs = [
      { triggerValue: true, effectValue: 40 },
      { triggerValue: true, effectValue: 42 },
      { triggerValue: true, effectValue: 39 },
    ];
    
    const baseline = 50; 
    
    const insight = detectCrossDomainLinks(pairs, baseline, 'alcohol_sleep');
    expect(insight).toBeNull();
  });
});
