import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStyles } from '../../../hooks/useGameStyles';
import { GameButton } from './GameButton';

// 🔥 QRCode - necesitas instalarlo: npx expo install react-native-qrcode-svg
import QRCode from 'react-native-qrcode-svg';

interface InvitationModalProps {
  visible: boolean;
  onClose: () => void;
  codigoInvitacion: string;
  nombreNegocio: string;
}

export function InvitationModal({ visible, onClose, codigoInvitacion, nombreNegocio }: InvitationModalProps) {
  const { colors, spacing } = useGameStyles();

  const copiarCodigo = async () => {
    try {
      await Clipboard.setStringAsync(codigoInvitacion);
      // Puedes agregar un toast o feedback visual aquí
      // showToast('✅ Código copiado');
    } catch (error) {
      console.error('Error al copiar:', error);
    }
  };

  const compartirCodigo = async () => {
    try {
      await Share.share({
        message: `📌 ¡Únete a ${nombreNegocio} en CUTTRACK!\n\n🔑 Código de invitación: ${codigoInvitacion}\n\n📱 Descarga la app y regístrate con este código.`,
      });
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.gold }]}>📌 Código de invitación</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Comparte este código con tus clientes para que se registren en {nombreNegocio}
          </Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={codigoInvitacion}
              size={180}
              color={colors.primary}
              backgroundColor={colors.background}
            />
          </View>

          <View style={styles.codigoContainer}>
            <Text style={[styles.codigoLabel, { color: colors.textSecondary }]}>Código:</Text>
            <View style={[styles.codigoBox, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              <Text style={[styles.codigoText, { color: colors.primary }]}>{codigoInvitacion}</Text>
              <TouchableOpacity onPress={copiarCodigo} style={styles.copyButton}>
                <Feather name="copy" size={18} color={colors.gold} />
              </TouchableOpacity>
            </View>
          </View>

          <GameButton
            title="Compartir código"
            variant="primary"
            onPress={compartirCodigo}
            icon="share-2"
            style={{ marginTop: spacing.md }}
          />

          <GameButton
            title="Cerrar"
            variant="secondary"
            onPress={onClose}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  qrContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  codigoContainer: {
    width: '100%',
    marginBottom: 16,
  },
  codigoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  codigoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  codigoText: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 4,
  },
});