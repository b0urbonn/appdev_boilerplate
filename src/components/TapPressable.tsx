import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { playTapSound } from './tapSound';

export function TapPressable({ disabled, onPressIn, ...props }: PressableProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPressIn={event => {
        if (!disabled) playTapSound();
        onPressIn?.(event);
      }}
    />
  );
}
