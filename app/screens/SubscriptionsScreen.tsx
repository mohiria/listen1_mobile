import React from 'react';

import type { PlaylistInfo } from '../../src/api/client';
import SubscriptionList from '../components/SubscriptionList';
import Screen from './Screen';

// Every subscription, behind 全部 on the home screen, which shows only the
// first few.
export default function SubscriptionsScreen({
  navigation,
}: {
  navigation: {
    navigate(name: 'Playlist', params: { info: PlaylistInfo }): void;
  };
}) {
  return (
    <Screen>
      <SubscriptionList
        onOpen={info => navigation.navigate('Playlist', { info })}
      />
    </Screen>
  );
}
