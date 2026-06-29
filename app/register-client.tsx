import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
// 🔥 CAMBIO IMPORTANTE: Importar CameraView y useCameraPermissions
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase/client';
import { storage } from '../services/supabase/storage';
import { useBusinessDictionary } from './hooks/useBusinessDictionary';
import { useGameStyles } from './hooks/useGameStyles';
import { GameButton } from './styles/components/ui/GameButton';
import { GameCard } from './styles/components/ui/GameCard';

export default function RegisterClient() {
  const { colors, global, spacing } = useGameStyles();
  
  const { 
    getIcon, 
    employeePlural, 
    employeeName, 
    appointmentName,
    serviceName
  } = useBusinessDictionary();
  
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [codigoBarberia, setCodigoBarberia] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState(1);
  const [codigoVerificacion, setCodigoVerificacion] = useState('');
  const [clienteTemp, setClienteTemp] = useState<any>(null);

  // 🔥 Estado para el escáner QR
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  
  // 🔥 CORRECCIÓN: usar CameraView ref
  const cameraRef = useRef<CameraView>(null);

  const generarCodigo = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // 🔥 Función para abrir el escáner QR
  const abrirScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert(
          '📷 Permiso denegado',
          'Necesitamos acceso a la cámara para escanear el código QR de la barbería.'
        );
        return;
      }
    }
    setScannerVisible(true);
  };

  // 🔥 Función que se ejecuta cuando se escanea un QR
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setCodigoBarberia(data.toUpperCase().trim());
    setScannerVisible(false);
    Alert.alert('✅ Código escaneado', `Código: ${data}`);
  };

  // 🔥 Cambiar entre cámara frontal y trasera
  const toggleCameraType = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
  };

  const validarBarberia = async () => {
    if (!nombre.trim()) {
      Alert.alert('Error', 'Ingresa tu nombre completo');
      return;
    }
    if (!telefono.trim()) {
      Alert.alert('Error', 'Ingresa tu número de teléfono');
      return;
    }
    if (telefono.replace(/[^0-9]/g, '').length < 10) {
      Alert.alert('Error', 'Ingresa un número de teléfono válido (10 dígitos)');
      return;
    }
    if (!codigoBarberia.trim()) {
      Alert.alert('Error', 'Ingresa el código de la barbería');
      return;
    }

    setLoading(true);

    try {
      const codigoBuscar = codigoBarberia.toUpperCase().trim();
      const { data: barbershop, error: barbershopError } = await supabase
        .from('barbershops')
        .select('id, nombre, codigo_unico')
        .eq('codigo_unico', codigoBuscar)
        .maybeSingle();

      if (barbershopError || !barbershop) {
        Alert.alert('Error', `❌ Código de ${(employeePlural || 'barbería').toLowerCase()} inválido`);
        setLoading(false);
        return;
      }

      const { data: clienteExistente } = await supabase
        .from('clients')
        .select('id, verificado')
        .eq('telefono', telefono.trim())
        .eq('barbershop_id', barbershop.id)
        .maybeSingle();

      if (clienteExistente && clienteExistente.verificado) {
        Alert.alert('Error', `Este número ya está registrado en ${barbershop.nombre}`);
        setLoading(false);
        return;
      }

      const codigo = generarCodigo();
      const expiracion = new Date();
      expiracion.setMinutes(expiracion.getMinutes() + 5);

      setClienteTemp({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        barbershop_id: barbershop.id,
        barbershop_nombre: barbershop.nombre,
        codigo: codigo,
        expiracion: expiracion,
        clienteExistenteId: clienteExistente?.id || null,
      });

      console.log('📱 ===== CÓDIGO DE VERIFICACIÓN =====');
      console.log(`Número: ${telefono}`);
      console.log(`Código: ${codigo}`);
      console.log(`Expira: ${expiracion.toLocaleTimeString()}`);
      console.log('=====================================\n');

      Alert.alert(
        '📱 Código enviado',
        `Hemos enviado un código de verificación al ${telefono}\n\nCódigo: ${codigo}`,
        [{ text: 'OK', onPress: () => setPaso(2) }]
      );

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const verificarCodigo = async () => {
    if (!codigoVerificacion) {
      Alert.alert('Error', 'Ingresa el código de verificación');
      return;
    }

    if (!clienteTemp) {
      Alert.alert('Error', 'Sesión expirada, vuelve a empezar');
      setPaso(1);
      return;
    }

    if (new Date() > new Date(clienteTemp.expiracion)) {
      Alert.alert('Error', 'El código expiró. Vuelve a intentarlo');
      setPaso(1);
      setClienteTemp(null);
      return;
    }

    if (codigoVerificacion !== clienteTemp.codigo) {
      Alert.alert('Error', 'Código incorrecto');
      return;
    }

    setLoading(true);

    try {
      let clienteId;

      if (clienteTemp.clienteExistenteId) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            nombre: clienteTemp.nombre,
            verificado: true,
            codigo_verificacion: null,
            codigo_expiracion: null,
          })
          .eq('id', clienteTemp.clienteExistenteId);
        
        if (updateError) throw updateError;
        clienteId = clienteTemp.clienteExistenteId;
      } else {
        const { data: nuevoCliente, error: insertError } = await supabase
          .from('clients')
          .insert({
            barbershop_id: clienteTemp.barbershop_id,
            nombre: clienteTemp.nombre,
            telefono: clienteTemp.telefono,
            verificado: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        clienteId = nuevoCliente.id;
      }

      await storage.setItem('cliente_id', clienteId);
      await storage.setItem('cliente_nombre', clienteTemp.nombre);
      await storage.setItem('cliente_telefono', clienteTemp.telefono);
      await storage.setItem('cliente_barbershop_id', clienteTemp.barbershop_id);
      await storage.setItem('user_rol', 'client');

      console.log('📱 ===== MENSAJE DE BIENVENIDA =====');
      console.log(`Número: ${clienteTemp.telefono}`);
      console.log('==================================\n');

      Alert.alert(
        '✅ Registro exitoso',
        `Te has registrado en ${clienteTemp.barbershop_nombre}\n\nAhora puedes agendar ${(appointmentName || 'citas').toLowerCase()} con tu número de teléfono.`,
        [{ text: 'OK', onPress: () => router.replace('/(cliente)') }]
      );

    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error.message || 'Error al registrar cliente');
    } finally {
      setLoading(false);
    }
  };

  const reiniciarRegistro = () => {
    setPaso(1);
    setClienteTemp(null);
    setCodigoVerificacion('');
  };

  if (paso === 2) {
    return (
      <LinearGradient
        colors={[colors.background, colors.card]}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(255,107,53,0.1)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: 'rgba(255,107,53,0.3)',
            }}>
              <Feather name="smartphone" size={40} color={colors.primary} />
            </View>
            <Text style={[global.headerTitle, { fontSize: 24, letterSpacing: 1 }]}>Verificar código</Text>
            <Text style={[global.text, { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' }]}>
              Enviamos un código al {clienteTemp?.telefono}
            </Text>
          </View>

          <View style={{
            backgroundColor: colors.glass,
            borderRadius: 24,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
          }}>
            <TextInput
              style={[global.input, { fontSize: 24, fontWeight: 'bold', letterSpacing: 8, textAlign: 'center', backgroundColor: colors.card }]}
              placeholder="Código"
              placeholderTextColor={colors.textMuted}
              value={codigoVerificacion}
              onChangeText={setCodigoVerificacion}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <GameButton 
            title="Verificar"
            variant="primary"
            onPress={verificarCodigo}
            loading={loading}
            style={{ marginBottom: spacing.md }}
            icon="check"
          />

          <GameButton 
            title="Volver al inicio"
            variant="secondary"
            onPress={reiniciarRegistro}
            icon="arrow-left"
          />
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.background, colors.card]}
      style={{ flex: 1 }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(255,107,53,0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: 'rgba(255,107,53,0.3)',
          }}>
            <Feather name="user-plus" size={40} color={colors.primary} />
          </View>
          <Text style={[global.headerTitle, { fontSize: 28, letterSpacing: 2 }]}>CUTTRACK</Text>
          <Text style={[global.text, { color: colors.textMuted, fontSize: 12, marginTop: 4 }]}>
            Regístrate con tu número
          </Text>
        </View>

        <View style={{
          backgroundColor: colors.glass,
          borderRadius: 24,
          padding: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.glassBorder,
        }}>
          <TextInput
            style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
            placeholder="Nombre completo *"
            placeholderTextColor={colors.textMuted}
            value={nombre}
            onChangeText={setNombre}
          />

          <TextInput
            style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
            placeholder="Teléfono * (ej: 3016669455)"
            placeholderTextColor={colors.textMuted}
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
          />

          {/* 🔥 CAMPO DE CÓDIGO CON BOTÓN QR */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.md,
          }}>
            <TextInput
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 16,
                paddingVertical: spacing.md,
                paddingRight: spacing.sm,
              }}
              placeholder={`Código de la ${(employeePlural || 'barbería').toLowerCase()} *`}
              placeholderTextColor={colors.textMuted}
              value={codigoBarberia}
              onChangeText={setCodigoBarberia}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            
            <TouchableOpacity
              onPress={abrirScanner}
              style={{
                padding: spacing.sm,
                borderRadius: 8,
                backgroundColor: 'rgba(255,107,53,0.1)',
              }}
            >
              <Feather name="camera" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <GameCard variant="game" style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
              <Feather name="key" size={12} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 12 }}>El código te lo da el dueño</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
              <Feather name="message-circle" size={12} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 12 }}>Recibirás un código por WhatsApp</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Feather name="shield" size={12} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 12 }}>Sin emails, sin contraseñas</Text>
            </View>
          </GameCard>
        </View>

        <GameButton 
          title="Enviar código"
          variant="primary"
          onPress={validarBarberia}
          loading={loading}
          style={{ marginBottom: spacing.md }}
          icon="send"
        />

        <GameButton 
          title="¿Ya tienes cuenta? Inicia sesión"
          variant="secondary"
          onPress={() => router.replace('/client/login')}
          icon="log-in"
        />
      </ScrollView>

      {/* 🔥 MODAL DEL ESCÁNER QR - CON CameraView */}
      <Modal visible={scannerVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={cameraType}
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          >
            {/* Marco guía para el QR */}
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'transparent',
            }}>
              <View style={{
                width: 280,
                height: 280,
                borderWidth: 2,
                borderColor: colors.gold,
                borderRadius: 16,
                backgroundColor: 'transparent',
              }} />
            </View>

            {/* Botón para cerrar el escáner */}
            <TouchableOpacity 
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                padding: 12,
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 30,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
              }}
              onPress={() => setScannerVisible(false)}
            >
              <Feather name="x" size={28} color="white" />
            </TouchableOpacity>

            {/* Botón para cambiar cámara */}
            <TouchableOpacity 
              style={{
                position: 'absolute',
                bottom: 140,
                right: 20,
                padding: 12,
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 30,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
              }}
              onPress={toggleCameraType}
            >
              <Feather name="refresh-cw" size={24} color="white" />
            </TouchableOpacity>

            <Text style={{
              position: 'absolute',
              bottom: 80,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: 'white',
              fontSize: 14,
              backgroundColor: 'rgba(0,0,0,0.6)',
              paddingVertical: 12,
              paddingHorizontal: 20,
              marginHorizontal: 30,
              borderRadius: 12,
            }}>
              Coloca el código QR dentro del marco
            </Text>
          </CameraView>
        </View>
      </Modal>
    </LinearGradient>
  );
}