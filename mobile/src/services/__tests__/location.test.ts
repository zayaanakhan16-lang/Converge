/**
 * Place search tests.
 *
 * The backend module is the only thing mocked, so what is verified here is the
 * contract `searchPlaces` presents to the screens: a result list, or a reason
 * the lookup could not be done. The distinction matters, because a screen that
 * cannot tell those apart tells a member a place does not exist when the
 * lookup actually failed.
 */

import { searchPlaces } from '../location';
import { BackendUnavailableError } from '../backend';

jest.mock('../backend', () => {
  const actual = jest.requireActual('../backend');
  return {
    ...actual,
    backend: { searchPlaces: jest.fn() },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { backend } = require('../backend') as {
  backend: { searchPlaces: jest.Mock };
};

const LAGOS = {
  label: 'Lagos, Nigeria',
  name: 'Lagos',
  kind: 'city' as const,
  latitude: 6.4550575,
  longitude: 3.3941795,
  city: 'Lagos',
  region: null,
  country: 'Nigeria',
  countryCode: 'NG',
};

describe('searchPlaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the provider results on success', async () => {
    backend.searchPlaces.mockResolvedValue([LAGOS]);

    const outcome = await searchPlaces('Lagos');

    expect(outcome).toEqual({ status: 'ok', results: [LAGOS] });
    expect(backend.searchPlaces).toHaveBeenCalledWith({
      query: 'Lagos',
      limit: undefined,
      kind: undefined,
    });
  });

  it('does not call the backend for a query that is too short', async () => {
    const outcome = await searchPlaces('L');

    expect(outcome).toEqual({ status: 'ok', results: [] });
    expect(backend.searchPlaces).not.toHaveBeenCalled();
  });

  it('trims the query before searching', async () => {
    backend.searchPlaces.mockResolvedValue([]);

    await searchPlaces('  Berlin  ');

    expect(backend.searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Berlin' }),
    );
  });

  it('passes a kind filter through to the backend', async () => {
    backend.searchPlaces.mockResolvedValue([LAGOS]);

    await searchPlaces('Lagos', { kind: 'city', limit: 3 });

    expect(backend.searchPlaces).toHaveBeenCalledWith({
      query: 'Lagos',
      kind: 'city',
      limit: 3,
    });
  });

  it('reports a genuine empty result as ok, not as a failure', async () => {
    backend.searchPlaces.mockResolvedValue([]);

    const outcome = await searchPlaces('asdkjhasdjkhasd');

    expect(outcome).toEqual({ status: 'ok', results: [] });
  });

  it('reports an unconfigured backend as unavailable with a fixable reason', async () => {
    backend.searchPlaces.mockRejectedValue(new BackendUnavailableError());

    const outcome = await searchPlaces('Lagos');

    expect(outcome.status).toBe('unavailable');
    if (outcome.status === 'unavailable') {
      expect(outcome.message).toContain('EXPO_PUBLIC_BACKEND_URL');
    }
  });

  it('reports a provider failure as unavailable rather than as no matches', async () => {
    backend.searchPlaces.mockRejectedValue(
      new Error('Converge backend returned 503: provider-unavailable'),
    );

    const outcome = await searchPlaces('Lagos');

    expect(outcome.status).toBe('unavailable');
    if (outcome.status === 'unavailable') {
      // The reason reaches the member instead of an empty list that would read
      // as "no such place".
      expect(outcome.message).toContain('503');
    }
  });

  it('falls back to a readable message when the error carries none', async () => {
    backend.searchPlaces.mockRejectedValue(new Error(''));

    const outcome = await searchPlaces('Lagos');

    expect(outcome.status).toBe('unavailable');
    if (outcome.status === 'unavailable') {
      expect(outcome.message.length).toBeGreaterThan(0);
    }
  });
});
