import { Redirect } from 'expo-router';

import { DEFAULT_PUZZLE_ID } from '@/data/puzzle-catalog';

export default function LegacyPuzzleRoute() {
  return (
    <Redirect
      href={{
        pathname: '/puzzle/[id]',
        params: { id: DEFAULT_PUZZLE_ID },
      }}
    />
  );
}
