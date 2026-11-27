// The full-screen player. It slides up over the whole app, in the app's own
// window, so that the sheets and the toast can still show above it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Client from '../../src/api/client';
import {
  changePlayMode,
  nextTrack,
  openModalLite,
  prevTrack,
  toggleModal,
  togglePlay,
} from '../../src/redux/actions';
import { getPlayingSource } from '../../src/redux/player.reducer';
import { store } from '../../src/redux/store';
import { useSlide } from '../components/Sheet';
import { usePalette, type Palette } from '../theme';
import { useStore } from '../useStore';
import { seekTo, usePlaybackProgress } from './index';

const THUMB = 14;
// how long the bar stays where the finger left it, until the player reports
// the new position
const HOLD_MS = 1000;
// by play mode: loop, shuffle, repeat one
const MODE_ICONS = ['repeat', 'shuffle', 'repeat-one'] as const;

function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const minute = Math.floor(whole / 60);
  const second = whole % 60;

  return `${minute < 10 ? '0' : ''}${minute}:${second < 10 ? '0' : ''}${second}`;
}

// The position in the song, the bar to drag, and the length of the song.
function ProgressRow({ palette }: { palette: Palette }) {
  const { position, duration } = usePlaybackProgress();
  const [width, setWidth] = useState(0);
  // where the finger holds the bar, from 0 to 1
  const [dragged, setDragged] = useState<number | null>(null);
  const live = useRef({ width, duration });
  const start = useRef(0);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  live.current = { width, duration };

  useEffect(() => () => clearTimeout(hold.current), []);

  const responder = useMemo(() => {
    const canDrag = () => live.current.duration > 0 && live.current.width > 0;
    const at = (x: number) =>
      Math.min(1, Math.max(0, x / Math.max(1, live.current.width)));

    return PanResponder.create({
      onStartShouldSetPanResponder: canDrag,
      onMoveShouldSetPanResponder: canDrag,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: event => {
        clearTimeout(hold.current);
        start.current = event.nativeEvent.locationX;
        setDragged(at(start.current));
      },
      onPanResponderMove: (_event, gesture) => {
        setDragged(at(start.current + gesture.dx));
      },
      onPanResponderRelease: (_event, gesture) => {
        const to = at(start.current + gesture.dx);

        setDragged(to);
        seekTo(to * live.current.duration);
        hold.current = setTimeout(() => setDragged(null), HOLD_MS);
      },
      onPanResponderTerminate: () => setDragged(null),
    });
  }, []);

  const played =
    dragged ?? (duration > 0 ? Math.min(1, position / duration) : 0);
  const filled = played * Math.max(0, width - THUMB);

  return (
    <View style={styles.progress}>
      <Text style={[styles.time, { color: palette.secondaryColor }]}>
        {clock(dragged !== null ? dragged * duration : position)}
      </Text>
      <View
        style={styles.bar}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        {...responder.panHandlers}
      >
        <View style={styles.barInside}>
          <View
            style={[styles.rail, { backgroundColor: palette.thirdColor }]}
          />
          <View
            style={[
              styles.played,
              {
                backgroundColor: palette.accentColor,
                width: filled + THUMB / 2,
              },
            ]}
          />
          <View
            style={[
              styles.thumb,
              { backgroundColor: palette.accentColor, left: filled },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.time, { color: palette.secondaryColor }]}>
        {clock(duration)}
      </Text>
    </View>
  );
}

type IconName =
  | (typeof MODE_ICONS)[number]
  | 'keyboard-arrow-down'
  | 'more-horiz'
  | 'skip-previous'
  | 'skip-next'
  | 'pause-circle-outline'
  | 'play-circle-outline'
  | 'queue-music';

function IconButton({
  name,
  size,
  box,
  color,
  onPress,
}: {
  name: IconName;
  size: number;
  box: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.center, { height: box, width: box }]}
      onPress={onPress}
    >
      <MaterialIcons name={name} size={size} color={color} />
    </Pressable>
  );
}

function PlayerContent() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const track = useStore(state => state.playerState.nowplayingTrack);
  const playing = useStore(state => state.playerState.isPlaying);
  const playMode = useStore(state => state.playerState.playMode);
  const source = useStore(state => getPlayingSource(state.playerState));
  const hasTrack = track !== null && track !== undefined;
  const color = palette.primaryColor;
  const coverSize = Math.min(
    300,
    screen.width - insets.left - insets.right - 60
  );
  const coverStyle = {
    backgroundColor: palette.backgroundColor,
    height: coverSize,
    width: coverSize,
  };

  return (
    <ScrollView
      alwaysBounceVertical={false}
      style={{ backgroundColor: palette.windowColor }}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.nav}>
        <IconButton
          name="keyboard-arrow-down"
          size={30}
          box={50}
          color={color}
          onPress={() => store.dispatch(toggleModal())}
        />
        {track !== null && track !== undefined ? (
          <IconButton
            name="more-horiz"
            size={30}
            box={50}
            color={color}
            onPress={() =>
              store.dispatch(openModalLite({ type: 'track', item: track }))
            }
          />
        ) : null}
      </View>

      {hasTrack && track.img_url ? (
        <Image
          source={{ uri: track.img_url }}
          style={[styles.cover, coverStyle]}
        />
      ) : (
        <View style={[styles.cover, styles.center, coverStyle]}>
          <MaterialIcons
            name="music-note"
            size={80}
            color={palette.thirdColor}
          />
        </View>
      )}

      <View style={styles.info}>
        <Text numberOfLines={1} style={[styles.title, { color }]}>
          {hasTrack ? track.title : 'Listen 1'}
        </Text>
        {hasTrack ? (
          <Text
            numberOfLines={1}
            style={[styles.artist, { color: palette.secondaryColor }]}
          >
            {source !== ''
              ? `${track.artist} · 来自${Client.getProviderName(source)}`
              : track.artist}
          </Text>
        ) : null}
      </View>

      <ProgressRow palette={palette} />

      <View style={styles.controls}>
        <IconButton
          name={MODE_ICONS[playMode] ?? 'repeat'}
          size={30}
          box={70}
          color={color}
          onPress={() => store.dispatch(changePlayMode())}
        />
        <IconButton
          name="skip-previous"
          size={40}
          box={70}
          color={color}
          onPress={() => {
            if (hasTrack) {
              store.dispatch(prevTrack());
            }
          }}
        />
        <IconButton
          name={playing ? 'pause-circle-outline' : 'play-circle-outline'}
          size={70}
          box={80}
          color={color}
          onPress={() => {
            if (hasTrack) {
              store.dispatch(togglePlay());
            }
          }}
        />
        <IconButton
          name="skip-next"
          size={40}
          box={70}
          color={color}
          onPress={() => {
            if (hasTrack) {
              store.dispatch(nextTrack());
            }
          }}
        />
        <IconButton
          name="queue-music"
          size={30}
          box={70}
          color={color}
          onPress={() => store.dispatch(openModalLite({ type: 'nowplaying' }))}
        />
      </View>
    </ScrollView>
  );
}

// Mount once, above the navigation.
export default function PlayerPage() {
  const open = useStore(state => state.modalState.isOpen);
  const { mounted, shown } = useSlide(open);
  const { height } = useWindowDimensions();

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [
            {
              translateY: shown.interpolate({
                inputRange: [0, 1],
                outputRange: [height, 0],
              }),
            },
          ],
        },
      ]}
    >
      <PlayerContent />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  nav: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: 50,
    justifyContent: 'space-between',
  },
  cover: { borderRadius: 20 },
  info: {
    alignSelf: 'stretch',
    flexGrow: 1,
    marginHorizontal: 30,
    marginTop: 20,
    minHeight: 70,
  },
  title: { fontSize: 24, lineHeight: 40 },
  artist: { fontSize: 16 },
  progress: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: 40,
    paddingHorizontal: 10,
  },
  time: { fontSize: 14, textAlign: 'center', width: 50 },
  bar: { flex: 1, height: 40, justifyContent: 'center' },
  // touches land on the bar itself, so that their x is measured from its edge
  barInside: { height: THUMB, justifyContent: 'center', pointerEvents: 'none' },
  rail: { height: 2, left: 0, position: 'absolute', right: 0 },
  played: { height: 2, left: 0, position: 'absolute' },
  thumb: {
    borderRadius: THUMB / 2,
    height: THUMB,
    position: 'absolute',
    width: THUMB,
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 120,
    justifyContent: 'center',
  },
});
