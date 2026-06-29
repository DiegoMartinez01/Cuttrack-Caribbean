import { colors } from '../../constants/colors';
import { gaps, radius, spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { buttonStyles } from '../styles/components/buttonStyles';
import { cardStyles } from '../styles/components/cardStyles';
import { globalStyles } from '../styles/globalStyles';

export const useGameStyles = () => {
  return {
    // Globales
    global: globalStyles,
    // Componentes
    cards: cardStyles,
    buttons: buttonStyles,
    // Constantes
    colors,
    typography,
    spacing,
    gaps,
    radius,
  };
};