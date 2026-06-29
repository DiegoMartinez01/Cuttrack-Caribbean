import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { uploadToImgBB } from '../../../../services/supabase/imgbb/uploadImage';
import { useGameStyles } from '../../../hooks/useGameStyles';
import { CustomModal } from './CustomModal';

interface Props {
  onImageUploaded: (url: string) => void;
  onImageDeleted?: () => void;
  currentImage?: string | null;
  aspect?: [number, number];
}

export function ImageUploader({ 
  onImageUploaded, 
  onImageDeleted,
  currentImage, 
  aspect = [1, 1],
}: Props) {
  const { colors, spacing, radius } = useGameStyles();
  const [imageUri, setImageUri] = useState<string | null>(currentImage || null);
  const [uploading, setUploading] = useState(false);

  // Estado del modal personalizado
  const [modal, setModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm',
    onConfirm: null as (() => void) | null,
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'confirm', onConfirm?: () => void) => {
    setModal({ visible: true, title, message, type, onConfirm: onConfirm || null });
  };

  const hideModal = () => {
    setModal((prev) => ({ ...prev, visible: false }));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: aspect,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0].uri) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setUploading(true);
      
      try {
        console.log('📡 [1/3] Comprimiendo imagen...');
        
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1024 } }],
          {
            compress: 0.7,
            base64: true,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        
        const base64Size = Math.round((manipulatedImage.base64?.length ?? 0) / 1024);
        console.log(`📡 [2/3] Imagen comprimida: ${base64Size} KB`);
        
        const publicUrl = await uploadToImgBB(manipulatedImage.base64 || '');
        
        if (publicUrl) {
          setImageUri(publicUrl);
          onImageUploaded(publicUrl);
          showModal('✅ Éxito', 'Imagen subida correctamente', 'success');
        } else {
          showModal('Error', 'No se pudo subir la imagen', 'error');
        }
      } catch (error) {
        console.error('Error procesando imagen:', error);
        showModal('Error', 'No se pudo procesar la imagen', 'error');
      } finally {
        setUploading(false);
      }
    }
  };

  // 🔥 Eliminar con confirmación usando CustomModal
  const handleLongPress = () => {
    if (!imageUri) return;
    
    showModal(
      'Eliminar imagen',
      '¿Estás seguro de eliminar esta imagen?',
      'confirm',
      () => {
        setImageUri(null);
        if (onImageDeleted) {
          onImageDeleted();
        } else {
          onImageUploaded('');
        }
        showModal('✅ Imagen eliminada', 'La imagen se eliminó correctamente', 'success');
        hideModal();
      }
    );
  };

  return (
    <>
      <TouchableOpacity 
        onPress={pickImage} 
        onLongPress={handleLongPress}
        activeOpacity={0.8} 
        disabled={uploading}
        delayLongPress={500}
      >
        {uploading ? (
          <View style={{ 
            width: 100, 
            height: 100, 
            borderRadius: radius.full,
            backgroundColor: colors.glass,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: spacing.xs }}>
              Subiendo...
            </Text>
          </View>
        ) : imageUri ? (
          <Image 
            source={{ uri: imageUri }} 
            style={{ 
              width: 100, 
              height: 100, 
              borderRadius: radius.full,
              borderWidth: 2,
              borderColor: colors.primary,
            }}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={{ 
            width: 100, 
            height: 100, 
            borderRadius: radius.full,
            backgroundColor: colors.glass,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderStyle: 'dashed',
          }}>
            <Feather name="camera" size={32} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: spacing.xs }}>
              Tap para subir
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 8, marginTop: 2 }}>
              Mantén para eliminar
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal personalizado */}
      <CustomModal
        visible={modal.visible}
        onClose={hideModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm || undefined}
        confirmText={modal.type === 'confirm' ? 'Continuar' : 'Aceptar'}
        cancelText="Cancelar"
      />
    </>
  );
}