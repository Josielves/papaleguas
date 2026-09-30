import { Image, StyleSheet, Text, View } from 'react-native'
import { colors, fonts } from '../theme'

type Props = { compact?: boolean }

export function Brand({ compact = false }: Props) {
  return (
    <View style={styles.wrap} accessibilityLabel="Papa-léguas">
      <Image
        source={require('../../assets/splash-icon.png')}
        style={compact ? styles.compactImage : styles.image}
        resizeMode="contain"
      />
      {!compact && <Text style={styles.name}>Papa-léguas</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  image: { width: 52, height: 38 },
  compactImage: { width: 39, height: 28 },
  name: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold, letterSpacing: 0 },
})
