// components/ui/CustomModal.tsx
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStyles } from '../../../hooks/useGameStyles';

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

export function CustomModal({
  visible,
  onClose,
  title,
  message,
  type = 'confirm',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
}: CustomModalProps) {
  const { colors } = useGameStyles();

  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'check-circle', color: colors.success };
      case 'error': return { name: 'alert-circle', color: colors.error };
      case 'warning': return { name: 'alert-triangle', color: colors.warning };
      default: return { name: 'help-circle', color: colors.gold };
    }
  };

  const icon = getIcon();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer]}>
          {/* Cabecera decorativa con gradiente */}
          <LinearGradient
            colors={[colors.primary, colors.primary + 'cc']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Feather name={icon.name as any} size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.headerTitle}>{title}</Text>
            </View>
          </LinearGradient>

          {/* Cuerpo del modal */}
          <View style={[styles.modalBody, { backgroundColor: colors.card }]}>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

            <View style={styles.buttons}>
              {type === 'confirm' && (
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.error }]}
                  onPress={onClose}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.error }]}>{cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                onPress={onConfirm || onClose}
              >
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Botón cerrar flotante */}
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.error }]} onPress={onClose}>
            <Feather name="x" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  headerGradient: {
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  modalBody: {
    padding: 24,
    paddingTop: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});