import { Image, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

type Props = { compact?: boolean }

export function Brand({ compact = false }: Props) {
  return (
    <View style={styles.wrap} accessibilityLabel="Papaleguas">
      <Image
        source={require('../../assets/icon.png')}
        style={compact ? styles.compactImage : styles.image}
        resizeMode="contain"
      />
      {!compact && <Text style={styles.name}>PAPALEGUAS</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  image: { width: 48, height: 36 },
  compactImage: { width: 36, height: 30 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 0 },
})
