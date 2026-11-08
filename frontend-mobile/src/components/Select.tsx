import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, type } from '@/theme';

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  placeholder: string;
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** A field that opens a bottom sheet of options. */
export function Select({ placeholder, options, value, onChange, icon }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${placeholder}: ${current?.label ?? 'not selected'}`}
        style={styles.field}
      >
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} />}
        <Text style={[styles.fieldText, !current && { color: colors.textFaint }]} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />
          <Text style={[type.h3, { marginBottom: space.sm }]}>{placeholder}</Text>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.option, active && { backgroundColor: colors.greenSoft }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, active && { fontWeight: '600' }]}>{item.label}</Text>
                    {item.hint ? <Text style={type.small}>{item.hint}</Text> : null}
                  </View>
                  {active && <Ionicons name="checkmark" size={20} color={colors.greenDark} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 15,
  },
  fieldText: { flex: 1, fontSize: 16, color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: space.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
});
