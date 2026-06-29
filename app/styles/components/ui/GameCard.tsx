import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { cardStyles } from '../../../styles/components/cardStyles';

type Variant = keyof typeof cardStyles;

interface GameCardProps {
  children?: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}

export const GameCard: React.FC<GameCardProps> = ({
  children,
  variant = 'base',
  style,
}) => {
  const variantStyle = cardStyles[variant];

  return (
    <View style={[variantStyle, style]}>
      {children}
    </View>
  );
};