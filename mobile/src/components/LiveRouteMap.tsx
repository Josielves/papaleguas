import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps'
import { LocateFixed } from 'lucide-react-native'
import { useLiveRoute } from '../hooks/useLiveRoute'
import { colors, radius, shadow } from '../theme'
import type { Coordinate, Route } from '../types'

type Props = {
  route: Route
  pickup?: Coordinate | null
  height?: number
}

function coordinate(lat: unknown, lng: unknown): Coordinate | null {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

function useSmoothedCoordinate(target: Coordinate | null) {
  const [displayed, setDisplayed] = useState<Coordinate | null>(target)
  const current = useRef<Coordinate | null>(target)

  useEffect(() => {
    if (!target) {
      current.current = null
      setDisplayed(null)
      return
    }
    if (!current.current) {
      current.current = target
      setDisplayed(target)
      return
    }

    const from = current.current
    const startedAt = Date.now()
    const duration = 700
    let frame = 0

    const animate = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      const next = {
        latitude: from.latitude + (target.latitude - from.latitude) * eased,
        longitude: from.longitude + (target.longitude - from.longitude) * eased,
      }
      current.current = next
      setDisplayed(next)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [target?.latitude, target?.longitude])

  return displayed
}

export function LiveRouteMap({ route, pickup, height = 260 }: Props) {
  const mapRef = useRef<MapView>(null)
  const fittedRoute = useRef<string | null>(null)
  const { location, stale, error } = useLiveRoute(route)
  const driver = useSmoothedCoordinate(location)
  const origin = useMemo(
    () => coordinate(route.origin_lat, route.origin_lng),
    [route.origin_lat, route.origin_lng],
  )
  const destination = useMemo(
    () => coordinate(route.destination_lat, route.destination_lng),
    [route.destination_lat, route.destination_lng],
  )
  const initial = driver ?? pickup ?? origin ?? destination ?? { latitude: -24.9555, longitude: -53.4552 }

  const allPoints = () => [driver, pickup, origin, destination].filter(Boolean) as LatLng[]
  const line = [driver ?? origin, pickup, destination].filter(Boolean) as LatLng[]

  const fit = (force = false) => {
    if (!force && fittedRoute.current === route.id) return
    const points = allPoints()
    if (points.length === 0) return
    fittedRoute.current = route.id
    if (points.length === 1) {
      mapRef.current?.animateToRegion({ ...points[0], latitudeDelta: 0.035, longitudeDelta: 0.035 }, 450)
      return
    }
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 54, right: 42, bottom: 54, left: 42 },
      animated: true,
    })
  }

  return (
    <View style={[styles.shell, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...initial, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
        onMapReady={() => fit()}
        onLayout={() => fit()}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor={colors.background}
        loadingIndicatorColor={colors.primary}
      >
        {line.length > 1 && <Polyline coordinates={line} strokeColor={colors.primary} strokeWidth={5} />}
        {origin && <Marker coordinate={origin} title="Origem" pinColor={colors.primary} />}
        {pickup && <Marker coordinate={pickup} title="Embarque" pinColor={colors.blue} />}
        {destination && <Marker coordinate={destination} title="Destino" pinColor={colors.coral} />}
        {driver && <Marker coordinate={driver} title="Motorista" pinColor={colors.amber} />}
      </MapView>

      <View style={styles.statusRow} pointerEvents="none">
        <View style={[styles.status, stale && styles.statusWarning]}>
          <View style={[styles.statusDot, stale && styles.statusDotWarning]} />
          <Text style={styles.statusText}>{stale ? 'Sinal desatualizado' : 'Mapa em tempo real'}</Text>
        </View>
      </View>

      <Pressable style={styles.recenter} onPress={() => fit(true)} accessibilityLabel="Reenquadrar mapa">
        <LocateFixed color={colors.text} size={20} />
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
  },
  statusRow: { position: 'absolute', top: 12, left: 12 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...shadow,
  },
  statusWarning: { backgroundColor: '#FFF7ED' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  statusDotWarning: { backgroundColor: colors.coral },
  statusText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  recenter: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow,
  },
  error: {
    position: 'absolute',
    left: 12,
    right: 62,
    bottom: 12,
    padding: 8,
    borderRadius: 6,
    color: '#9F1239',
    backgroundColor: '#FFF1F2',
    fontSize: 12,
  },
})
