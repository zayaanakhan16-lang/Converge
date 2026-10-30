import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Keyboard } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { useTheme } from '../../context/ThemeContext';
import { useMutation } from '../../hooks/useData';
import type { CommunitiesStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { radius, spacing } from '../../theme';
import { validateJoinCode } from '../../utils/validation';

type Props = NativeStackScreenProps<CommunitiesStackParamList, 'ScanCode'>;

/**
 * QR scanner for community and event codes.
 *
 * Only Converge-issued codes are accepted. Anything else is reported as
 * unrecognised rather than being treated as a link to open, which keeps the
 * scanner from becoming a route to arbitrary content.
 */
export function ScanCodeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);

  const join = useMutation(
    useCallback(async (value: string) => repository().joinByCode(value), []),
  );

  const handleScan = async (data: string) => {
    if (scanned) return;
    setScanned(data);
    const validation = validateJoinCode(data);
    if (validation) {
      setFieldError(
        'That code is not a Converge community code. Codes use letters, numbers and hyphens only.',
      );
      setScanned(null);
      return;
    }
    const community = await join.run(data);
    if (community) {
      navigation.replace('CommunityDetail', { communityId: community.id });
    } else {
      setScanned(null);
    }
  };

  const submitManual = async () => {
    const validation = validateJoinCode(manualCode);
    setFieldError(validation);
    if (validation) return;
    const community = await join.run(manualCode);
    if (community) navigation.replace('CommunityDetail', { communityId: community.id });
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Scan a community code</Text>
          <Text token="body" tone="secondary">
            Point the camera at a Converge QR poster. Only community codes are accepted — the
            scanner does not open links.
          </Text>
        </View>

        {!permission ? (
          <Text token="body" tone="muted">
            Checking camera permission…
          </Text>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <InlineMessage
              tone="info"
              message="Camera access is needed to scan a QR code. You can still type the code instead."
            />
            <Button label="Allow camera access" onPress={requestPermission} fullWidth />
          </View>
        ) : (
          <View
            style={[
              styles.viewfinder,
              { borderColor: theme.colors.borderStrong, backgroundColor: '#0B1420' },
            ]}
          >
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => void handleScan(data)}
            />
            <View style={styles.reticle} pointerEvents="none">
              <View style={[styles.corner, styles.topLeft, { borderColor: theme.colors.accent }]} />
              <View style={[styles.corner, styles.topRight, { borderColor: theme.colors.accent }]} />
              <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.colors.accent }]} />
              <View style={[styles.corner, styles.bottomRight, { borderColor: theme.colors.accent }]} />
            </View>
            <Text token="caption" color="#F7F4EF" style={styles.viewfinderLabel}>
              {scanned ? 'Checking code…' : 'Align the QR code inside the frame'}
            </Text>
          </View>
        )}

        {join.error ? <InlineMessage tone="error" message={join.error} /> : null}

        <View style={styles.manualSection}>
          <SectionHeader
            title="Type a code instead"
            subtitle="Useful when a poster is damaged or the camera is unavailable."
          />
          <TextField
            label="Community code"
            value={manualCode}
            onChangeText={(value) => {
              setManualCode(value.toUpperCase());
              if (fieldError) setFieldError(null);
            }}
            error={fieldError}
            placeholder="ENTER-CODE"
            autoCapitalize="characters"
            maxLength={24}
            onSubmitEditing={submitManual}
            returnKeyType="go"
          />
          <Button
            label="Join community"
            onPress={submitManual}
            loading={join.busy}
            fullWidth
            icon={<Keyboard size={16} color={theme.colors.onPrimary} strokeWidth={2} />}
            style={styles.manualButton}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  permissionBox: { gap: spacing.md },
  viewfinder: {
    height: 300,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  reticle: { position: 'absolute', top: 56, right: 56, bottom: 56, left: 56 },
  corner: { position: 'absolute', width: 34, height: 34, borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  viewfinderLabel: { padding: spacing.lg },
  manualSection: { gap: spacing.md },
  manualButton: { marginTop: spacing.sm },
});
