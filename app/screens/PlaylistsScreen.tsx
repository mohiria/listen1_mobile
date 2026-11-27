import React from 'react';

import SelfCheck from '../SelfCheck';
import { usePalette } from '../theme';
import Screen from './Screen';

// TEMP(B-03): holds the self check until the playlist screens arrive.
export default function PlaylistsScreen() {
  const palette = usePalette();

  return (
    <Screen>
      <SelfCheck color={palette.primaryColor} />
    </Screen>
  );
}
