import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Armchair, CarFront } from 'lucide-react-native'
import { colors, radius } from '../theme'
import type { Seat } from '../types'

type Props = {
  seats: Seat[]
  selected: number | null
  onSelect: (seatNumber: number) => void
}

export function SeatMap({ seats, selected, onSelect }: Props) {
  return (
    <View>
      <View style={styles.vehicle}>
        <View style={styles.windshield}>
          <CarFront size={22} color={colors.primary} />
          <Text style={styles.vehicleLabel}>VISÃO DO VEÍCULO</Text>
        </View>
        <View style={styles.aisle} />
        <View style={styles.grid}>
          {seats.map((seat) => {
            const occupied = seat.status !== 'available'
            const active = selected === seat.seat_number
            return (
              <Pressable
                key={seat.id}
                disabled={occupied}
                onPress={() => onSelect(seat.seat_number)}
                accessibilityLabel={`Assento ${seat.seat_number}, ${occupied ? 'ocupado' : active ? 'selecionado' : 'disponível'}`}
                style={[styles.seat, occupied && styles.seatOccupied, active && styles.seatSelected]}
              >
                <Armchair size={21} color={occupied || active ? '#FFFFFF' : colors.primary} />
                <Text style={[styles.seatNumber, (occupied || active) && styles.seatNumberActive]}>{seat.seat_number}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <View style={styles.legend}>
        <Legend color={colors.primary} label="Disponível" />
        <Legend color={colors.blue} label="Selecionado" />
        <Legend color={colors.occupied} label="Ocupado" />
      </View>
    </View>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  vehicle: {
    alignSelf: 'center',
    width: 230,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 42,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 26,
    backgroundColor: colors.surfaceMuted,
  },
  windshield: { alignItems: 'center', gap: 5, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: colors.line },
  vehicleLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0 },
  aisle: { position: 'absolute', top: 82, bottom: 22, left: '50%', width: 1, backgroundColor: colors.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, marginTop: 18 },
  seat: {
    width: 66,
    height: 48,
    borderRadius: radius.medium,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  seatSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  seatOccupied: { backgroundColor: colors.occupied, borderColor: colors.occupied },
  seatNumber: { color: colors.primary, fontWeight: '900' },
  seatNumberActive: { color: '#FFFFFF' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textMuted },
})
