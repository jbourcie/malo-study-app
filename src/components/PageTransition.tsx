import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { NavAnchorIntent } from '../world/transitions/navAnchors'
import { computeCameraPan } from '../world/transitions/navAnchors'

type PageTransitionConfig = {
  variants: {
    initial: Record<string, any>
    animate: Record<string, any>
    exit: Record<string, any>
  }
  transition: {
    duration: number
    ease: string | number[]
  }
}

const BASE_DURATION = 0.4
const PAN_FACTOR = 0.12

export function buildPageTransitionConfig(
  reduceMotion: boolean,
  intent?: Pick<NavAnchorIntent, 'anchorPx' | 'mapSize'> | null,
  viewport?: { w: number; h: number } | null,
): PageTransitionConfig {
  const pan = reduceMotion
    ? { x: 0, y: 0 }
    : computeCameraPan({
        anchorPx: intent?.anchorPx || null,
        mapSize: intent?.mapSize || null,
        viewport: viewport || null,
        panFactor: PAN_FACTOR,
        maxPan: viewport && viewport.w && viewport.w < 860 ? 50 : 80,
      })
  const variants = {
    initial: {
      opacity: reduceMotion ? 1 : 0,
      scale: reduceMotion ? 1 : 0.975,
      filter: reduceMotion ? 'none' : 'blur(2px)',
      x: pan.x,
      y: pan.y,
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: reduceMotion ? 'none' : 'blur(0px)',
      x: 0,
      y: 0,
    },
    exit: {
      opacity: reduceMotion ? 1 : 0,
      scale: reduceMotion ? 1 : 1.01,
      filter: reduceMotion ? 'none' : 'blur(2px)',
      x: reduceMotion ? 0 : -pan.x * 0.35,
      y: reduceMotion ? 0 : -pan.y * 0.35,
    },
  }
  const transition = {
    duration: reduceMotion ? 0 : BASE_DURATION,
    ease: 'easeOut',
  }
  return { variants, transition }
}

export function PageTransition({
  children,
  routeKey,
  navContext,
}: {
  children: React.ReactNode
  routeKey: string
  navContext?: Pick<NavAnchorIntent, 'anchorPx' | 'mapSize'> | null
}) {
  const reduceMotion = useReducedMotion()
  const viewport = React.useMemo(() => {
    if (typeof window === 'undefined') return null
    return { w: window.innerWidth, h: window.innerHeight }
  }, [])
  const { variants, transition } = React.useMemo(
    () => buildPageTransitionConfig(!!reduceMotion, navContext || null, viewport),
    [reduceMotion, navContext, viewport],
  )

  return (
    <motion.div
      key={routeKey}
      variants={variants}
      transition={transition}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}
