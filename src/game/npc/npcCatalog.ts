export type NpcId = 'scout' | 'robot' | 'goblin'
export type NpcTone = 'adventure' | 'rational' | 'fun'

export type NpcDef = {
  id: NpcId
  name: string
  avatar: string
  shortTagline: string
  tone: NpcTone
}

export const NPC_CATALOG: Record<NpcId, NpcDef> = {
  scout: { id: 'scout', name: 'Le Scout', avatar: '🧭', shortTagline: 'Je repère la meilleure mission du jour.', tone: 'adventure' },
  robot: { id: 'robot', name: 'Le Robot Prof', avatar: '🤖', shortTagline: 'Je te propose un plan simple et efficace.', tone: 'rational' },
  goblin: { id: 'goblin', name: 'Le Gobelin Malin', avatar: '🧌', shortTagline: 'Je te lance des défis… mais je t’aide aussi.', tone: 'fun' },
}
