import { Feather } from '@expo/vector-icons';
import { MotiPressable } from 'moti/interactions';
import { useState } from 'react';
import { ActivityIndicator, StyleProp, Text, ViewStyle } from 'react-native';
import { useGameStyles } from '../../../hooks/useGameStyles';
import { buttonStyles } from '../buttonStyles';

interface GameButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'game' | 'edit' | 'activate' | 'deactivate' | 'delete' | 'archive' | 'restore';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: keyof typeof Feather.glyphMap;
  iconSize?: number;
  compact?: boolean;
}

export const GameButton = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  loading = false,
  disabled = false,
  style = {},
  icon,
  iconSize = 14,
  compact = false
}: GameButtonProps) => {
  const { colors } = useGameStyles();
  const [isPressed, setIsPressed] = useState(false);

  // 🔥 Obtener el color correspondiente a cada variante
  const getVariantColor = () => {
    switch (variant) {
      case 'primary': return colors.primary;
      case 'secondary': return colors.primary;
      case 'danger': return colors.error;
      case 'game': return colors.primary;
      case 'edit': return colors.gold;
      case 'activate': return colors.success;
      case 'deactivate': return colors.error;
      case 'delete': return colors.error;
      case 'archive': return colors.warning;
      case 'restore': return colors.success;
      default: return colors.primary;
    }
  };

  // 🔥 Obtener el color de fondo para el efecto glow
  const getGlowColor = () => {
    switch (variant) {
      case 'primary': return colors.primary;
      case 'secondary': return colors.primary;
      case 'danger': return colors.error;
      case 'game': return colors.primary;
      case 'edit': return colors.gold;
      case 'activate': return colors.success;
      case 'deactivate': return colors.error;
      case 'delete': return colors.error;
      case 'archive': return colors.warning;
      case 'restore': return colors.success;
      default: return colors.primary;
    }
  };

  const variantColor = getVariantColor();
  const glowColor = getGlowColor();

  // 🔥 Estilos base para todas las variantes (transparentes)
  const baseVariantStyle = {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    borderColor: variantColor,
  };

  // 🔥 Estilos para el texto (color del borde)
  const textColor = variantColor;

  return (
    <MotiPressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      animate={({ pressed }) => ({
        scale: pressed ? 0.97 : 1,
        opacity: disabled ? 0.5 : 1,
      })}
      transition={{ type: 'timing', duration: 80 }}
      style={[
        buttonStyles.base,
        compact && buttonStyles.compact,
        baseVariantStyle,
        isPressed && {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 10,
          elevation: 5,
          backgroundColor: `${glowColor}15`,
        },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && <Feather name={icon} size={iconSize} color={textColor} style={{ marginRight: title ? 6 : 0 }} />}
          {title && (
            <Text style={[
              buttonStyles.text,
              compact && buttonStyles.textCompact,
              { color: textColor, fontWeight: '600' }
            ]}>
              {title}
            </Text>
          )}
        </>
      )}
    </MotiPressable>
  );
};