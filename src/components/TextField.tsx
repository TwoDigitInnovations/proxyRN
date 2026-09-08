import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputFocusEvent, TextInputProps, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';
import { useKeyboardFocusReporter } from './KeyboardAwareScrollView';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** Show the reveal (eye) button on a secure field. Defaults to true. */
  showPasswordToggle?: boolean;
}

export function TextField({
  label,
  error,
  style,
  secureTextEntry,
  showPasswordToggle = true,
  onFocus,
  ...rest
}: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;
  const withToggle = isPassword && showPasswordToggle;
  const reportFocus = useKeyboardFocusReporter();

  function handleFocus(event: TextInputFocusEvent) {
    // Lets an enclosing KeyboardAwareScrollView lift this field above the keyboard.
    reportFocus?.();
    onFocus?.(event);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, withToggle && styles.inputWithToggle, style]}
          placeholderTextColor={colors.border}
          secureTextEntry={isPassword && !revealed}
          onFocus={handleFocus}
          {...rest}
        />
        {withToggle ? (
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setRevealed(prev => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button">
            <Icon name={revealed ? 'eye' : 'eye-off'} size={20} color={colors.border} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  label: { fontSize: 13, color: colors.gray, marginBottom: 6 },
  inputWrap: { justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.gray,
  },
  inputWithToggle: { paddingRight: 46 },
  toggle: {
    position: 'absolute',
    right: 14,
    padding: 2,
  },
  error: { fontSize: 13, color: 'red', marginTop: 5 },
});
