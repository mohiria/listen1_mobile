// A list whose rows can be dragged into another order by their handle, and
// ticked and deleted.
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import { usePalette, type Palette } from '../theme';
import ListStatus from './ListStatus';

const ROW_HEIGHT = 50;

// Where the rows move to when the one at `from` is put at `to`.
export function moved<T>(items: T[], from: number, to: number): T[] {
  const rest = items.slice();
  const [item] = rest.splice(from, 1);

  rest.splice(to, 0, item);

  return rest;
}

type Drag = { from: number; to: number };

function Row({
  title,
  index,
  count,
  ticked,
  drag,
  palette,
  onTick,
  onDrag,
  onDrop,
}: {
  title: string;
  index: number;
  count: number;
  ticked: boolean;
  // the drag in progress, of this row or of another
  drag: Drag | null;
  palette: Palette;
  onTick: (index: number) => void;
  onDrag: (drag: Drag) => void;
  // to: where the row is let go; null when the drag is called off
  onDrop: (from: number, to: number | null) => void;
}) {
  // how far the finger has carried this row
  const carried = useRef(new Animated.Value(0)).current;
  const live = useRef({ index, count, onDrag, onDrop });

  live.current = { index, count, onDrag, onDrop };

  const responder = useMemo(() => {
    const target = (dy: number) =>
      Math.min(
        live.current.count - 1,
        Math.max(0, live.current.index + Math.round(dy / ROW_HEIGHT))
      );

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        live.current.onDrag({
          from: live.current.index,
          to: live.current.index,
        });
      },
      onPanResponderMove: (_event, gesture) => {
        carried.setValue(gesture.dy);
        live.current.onDrag({
          from: live.current.index,
          to: target(gesture.dy),
        });
      },
      onPanResponderRelease: (_event, gesture) => {
        carried.setValue(0);
        live.current.onDrop(live.current.index, target(gesture.dy));
      },
      onPanResponderTerminate: () => {
        carried.setValue(0);
        live.current.onDrop(live.current.index, null);
      },
    });
  }, [carried]);

  const dragged = drag !== null && drag.from === index;
  // the rows between where the dragged one was and where it is now make room
  let shift = 0;

  if (drag !== null && !dragged) {
    if (drag.from < index && index <= drag.to) {
      shift = -ROW_HEIGHT;
    } else if (drag.to <= index && index < drag.from) {
      shift = ROW_HEIGHT;
    }
  }

  return (
    <Animated.View
      style={[
        styles.row,
        { borderBottomColor: palette.borderColor },
        dragged
          ? [
              styles.dragged,
              {
                backgroundColor: palette.windowColor,
                transform: [{ translateY: carried }],
              },
            ]
          : { transform: [{ translateY: shift }] },
      ]}
    >
      <Pressable style={styles.tick} onPress={() => onTick(index)}>
        <MaterialIcons
          name={ticked ? 'check-box' : 'check-box-outline-blank'}
          size={26}
          color={ticked ? palette.primaryColor : palette.thirdColor}
        />
        <Text
          numberOfLines={1}
          style={[styles.title, { color: palette.primaryColor }]}
        >
          {title}
        </Text>
      </Pressable>
      <View style={styles.handle} {...responder.panHandlers}>
        <MaterialIcons name="reorder" size={26} color={palette.thirdColor} />
      </View>
    </Animated.View>
  );
}

// items: what the list starts with. onChange is called with the whole list
// each time a row has been moved or rows have been deleted.
export default function ListEditor<T extends { id: string; title: string }>({
  items: initial,
  onChange,
}: {
  items: T[];
  onChange: (items: T[]) => void;
}) {
  const palette = usePalette();
  const [items, setItems] = useState(initial);
  const [ticked, setTicked] = useState<T[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);

  const change = (next: T[]) => {
    setItems(next);
    onChange(next);
  };

  const tick = (index: number) => {
    const item = items[index];

    setTicked(
      ticked.includes(item)
        ? ticked.filter(one => one !== item)
        : [...ticked, item]
    );
  };

  const drop = (from: number, to: number | null) => {
    setDrag(null);
    if (to !== null && to !== from) {
      change(moved(items, from, to));
    }
  };

  const dragTo = (next: Drag) =>
    setDrag(previous =>
      previous !== null &&
      previous.from === next.from &&
      previous.to === next.to
        ? previous
        : next
    );

  return (
    <View style={styles.fill}>
      <ScrollView style={styles.fill} scrollEnabled={drag === null}>
        {items.length === 0 ? <ListStatus message="没有可编辑的内容" /> : null}
        {items.map((item, index) => (
          <Row
            // by place: the same id can be in a list twice
            key={index}
            title={item.title}
            index={index}
            count={items.length}
            ticked={ticked.includes(item)}
            drag={drag}
            palette={palette}
            onTick={tick}
            onDrag={dragTo}
            onDrop={drop}
          />
        ))}
      </ScrollView>
      <Pressable
        style={[styles.remove, { borderTopColor: palette.borderColor }]}
        onPress={() => {
          if (ticked.length > 0) {
            change(items.filter(item => !ticked.includes(item)));
            setTicked([]);
          }
        }}
      >
        <MaterialIcons
          name="delete-forever"
          size={26}
          color={ticked.length > 0 ? palette.primaryColor : palette.thirdColor}
        />
        <Text
          style={[
            styles.removeText,
            {
              color:
                ticked.length > 0 ? palette.primaryColor : palette.thirdColor,
            },
          ]}
        >
          {ticked.length > 0 ? `删除(${ticked.length})` : '删除'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: ROW_HEIGHT,
  },
  dragged: { opacity: 0.9, zIndex: 1 },
  tick: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    paddingLeft: 15,
  },
  title: { flex: 1, fontSize: 14, marginLeft: 10 },
  handle: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: 60,
  },
  remove: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 50,
    justifyContent: 'center',
  },
  removeText: { fontSize: 14, marginLeft: 6 },
});
