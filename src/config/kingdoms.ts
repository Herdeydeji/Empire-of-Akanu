import { KingdomConfig, KingdomId } from '../types/game';

export const KINGDOMS: Record<KingdomId, KingdomConfig> = {
  oru: {
    id: 'oru',
    name: 'Oru',
    title: 'Bastion of the Red Earth',
    specialisation: 'Infantry and Defence',
    description:
      'Renowned for disciplined shield-wall spearmen, bronze-plated royal wards, and monumental rammed-earth ramparts capable of breaking any siege.',
    culturalInspirationNote:
      'Fictional kingdom inspired by West African fortified earthworks, bronze-casting guilds, and courtyard palace traditions.',
    architecturalStyle: 'bastion_courtyard',
    primaryStrengths: [
      'Heavy Shield Infantry & Spearmen',
      'Fortified Courtyard Ramparts',
      'Territorial Garrison Resilience',
    ],
    uniqueCharacteristics: [
      'Reinforced earthen bastions and stepped watch-gates',
      'Superior defensive formation cohesion in home territory',
      'Bronze-forged heavy infantry shields and spearheads',
    ],
    startingResources: {
      food: 420,
      wood: 380,
      stone: 460,
      iron: 260,
      gold: 200,
    },
    recommendedRegion: 'golden_savannah',
    palette: {
      primary: '#b84a27',
      secondary: '#3c281e',
      accent: '#e0a94f',
      bannerCloth: '#9e3318',
      trimMetal: '#cd8c3c',
      masonryTint: '#b96e46',
      roofTint: '#6e472b',
    },
    modifiers: {
      infantryDefenseMultiplier: 1.15,
      cavalrySpeedMultiplier: 1.0,
      constructionEfficiencyMultiplier: 1.05,
      tradeYieldMultiplier: 1.0,
      archerReconMultiplier: 1.0,
    },
    futureUnitsPreview: [
      { name: 'Oru Shield-Bearer', role: 'Heavy Defensive Infantry', phase: 'Phase 3' },
      { name: 'Bronze Ward Spearman', role: 'Anti-Cavalry Phalanx', phase: 'Phase 3' },
      { name: 'Rampart Sentinel', role: 'Elite Palace Guard', phase: 'Phase 3' },
    ],
    futureBuildingsPreview: [
      { name: 'Earthen Bastion Wall', category: 'Defensive', effect: 'High-durability perimeter fortification', phase: 'Phase 2' },
      { name: 'Foundry of the Guild', category: 'Military', effect: 'Infantry armour & shield smithing', phase: 'Phase 2' },
    ],
  },
  zambara: {
    id: 'zambara',
    name: 'Zambara',
    title: 'Riders of the Golden Horizon',
    specialisation: 'Cavalry and Mobility',
    description:
      'Masters of swift savannah horsemanship, long-range reconnaissance, and decisive flanking charges across open plains and trade corridors.',
    culturalInspirationNote:
      'Fictional kingdom inspired by Sahelian equestrian traditions, timber-studded mud-brick citadels, and nomadic-settled confederacies.',
    architecturalStyle: 'sahelian_pavilion',
    primaryStrengths: [
      'Elite Light & Heavy Cavalry',
      'Rapid Battlefield Deployment',
      'Wide-Radius Frontier Scouting',
    ],
    uniqueCharacteristics: [
      'Open equestrian compounds and high-banner stables',
      'Accelerated mounted deployment and flanking momentum',
      'Extended line-of-sight across plains and savannah ridges',
    ],
    startingResources: {
      food: 480,
      wood: 380,
      stone: 320,
      iron: 280,
      gold: 260,
    },
    recommendedRegion: 'golden_savannah',
    palette: {
      primary: '#d99b26',
      secondary: '#4a1f1b',
      accent: '#f4cf72',
      bannerCloth: '#c9831a',
      trimMetal: '#e3b448',
      masonryTint: '#c9935b',
      roofTint: '#8c5d34',
    },
    modifiers: {
      infantryDefenseMultiplier: 1.0,
      cavalrySpeedMultiplier: 1.15,
      constructionEfficiencyMultiplier: 1.0,
      tradeYieldMultiplier: 1.05,
      archerReconMultiplier: 1.05,
    },
    futureUnitsPreview: [
      { name: 'Savannah Outrider', role: 'Fast Reconnaissance Cavalry', phase: 'Phase 3' },
      { name: 'Zambara Lancer', role: 'Shock Flanking Horseman', phase: 'Phase 3' },
      { name: 'Sun-Crest Cataphract', role: 'Quilted-Armour Heavy Cavalry', phase: 'Phase 3' },
    ],
    futureBuildingsPreview: [
      { name: 'Grand Equestrian Paddock', category: 'Military', effect: 'Mounted warrior training & breeding', phase: 'Phase 2' },
      { name: 'Horizon Beacon Tower', category: 'Defensive', effect: 'Early raid detection & frontier sight', phase: 'Phase 2' },
    ],
  },
  kemetra: {
    id: 'kemetra',
    name: 'Kemetra',
    title: 'Architects of Stone and Sun',
    specialisation: 'Engineering and Technology',
    description:
      'A scholarly and industrious realm celebrated for precision dressed-stone masonry, hydraulic irrigation, siege craft, and rapid scientific advancement.',
    culturalInspirationNote:
      'Fictional kingdom inspired by Nile Valley & Nubian monumental stone architecture, astronomy, and siege engineering.',
    architecturalStyle: 'monumental_pylon',
    primaryStrengths: [
      'Monumental Construction & Masonry',
      'Siege Engines & Fortification Breaching',
      'Accelerated Academy Research',
    ],
    uniqueCharacteristics: [
      'Battered stone pylons, obelisk markers, and colonnaded halls',
      'Higher structural efficiency and workshop output',
      'Advanced siege engineering unlocked in military tiers',
    ],
    startingResources: {
      food: 380,
      wood: 360,
      stone: 500,
      iron: 280,
      gold: 200,
    },
    recommendedRegion: 'northern_highlands',
    palette: {
      primary: '#27689b',
      secondary: '#262322',
      accent: '#e6b84c',
      bannerCloth: '#1b588c',
      trimMetal: '#e6ae38',
      masonryTint: '#b8925e',
      roofTint: '#2b587a',
    },
    modifiers: {
      infantryDefenseMultiplier: 1.0,
      cavalrySpeedMultiplier: 1.0,
      constructionEfficiencyMultiplier: 1.18,
      tradeYieldMultiplier: 1.0,
      archerReconMultiplier: 1.0,
    },
    futureUnitsPreview: [
      { name: 'Kemetran Sapper', role: 'Siege & Field Engineer', phase: 'Phase 3' },
      { name: 'Solar Torsion Catapult', role: 'Long-Range Anti-Structure Siege', phase: 'Phase 3' },
      { name: 'Pylon Halberdier', role: 'Garrison Workshop Guard', phase: 'Phase 3' },
    ],
    futureBuildingsPreview: [
      { name: 'House of Measures', category: 'Economic', effect: 'Unlocks advanced engineering & masonry research', phase: 'Phase 5' },
      { name: 'Artificer Siege Yard', category: 'Military', effect: 'Constructs rams, towers, and stone-throwers', phase: 'Phase 3' },
    ],
  },
  aseka: {
    id: 'aseka',
    name: 'Aseka',
    title: 'Sovereigns of the Golden Scales',
    specialisation: 'Trade and Economic Development',
    description:
      'Prosperous merchant princes whose bustling arcaded markets, goldsmith guilds, and diplomatic envoys turn commercial wealth into imperial power.',
    culturalInspirationNote:
      'Fictional kingdom inspired by Akan goldweights, Swahili & trans-regional merchant cities, and geometric textile artistry.',
    architecturalStyle: 'arcaded_compound',
    primaryStrengths: [
      'High-Yield Marketplaces & Caravans',
      'Superior Gold & Resource Reserves',
      'Economic Diplomacy & Tributary Pacts',
    ],
    uniqueCharacteristics: [
      'Shaded market arcades, multi-courtyard compounds, and gilded finials',
      'Enhanced caravan tariff efficiency and storage capacity',
      'Favourable diplomatic leverage in trade negotiations',
    ],
    startingResources: {
      food: 430,
      wood: 400,
      stone: 330,
      iron: 200,
      gold: 360,
    },
    recommendedRegion: 'riverlands',
    palette: {
      primary: '#1f7a55',
      secondary: '#2b2118',
      accent: '#f0be43',
      bannerCloth: '#196948',
      trimMetal: '#f2c144',
      masonryTint: '#c89b6e',
      roofTint: '#5c3c24',
    },
    modifiers: {
      infantryDefenseMultiplier: 1.0,
      cavalrySpeedMultiplier: 1.0,
      constructionEfficiencyMultiplier: 1.02,
      tradeYieldMultiplier: 1.2,
      archerReconMultiplier: 1.0,
    },
    futureUnitsPreview: [
      { name: 'Caravan Escort Spearman', role: 'Trade Route Protector', phase: 'Phase 3' },
      { name: 'Golden Stool Retainer', role: 'Well-Equipped Royal Mercenary', phase: 'Phase 3' },
      { name: 'Merchant Envoy', role: 'Diplomatic & Commercial Specialist', phase: 'Phase 5' },
    ],
    futureBuildingsPreview: [
      { name: 'Grand Goldweight Bazaar', category: 'Economic', effect: 'Generates gold tariffs & exchange rates', phase: 'Phase 2' },
      { name: 'Royal Treasury Vault', category: 'Royal', effect: 'Expands gold & iron storage reserves', phase: 'Phase 2' },
    ],
  },
  nambara: {
    id: 'nambara',
    name: 'Nambara',
    title: 'Wardens of the Emerald Canopy',
    specialisation: 'Archery and Wilderness Warfare',
    description:
      'Unmatched marksmen and woodland tacticians who blend settlements into living forests, striking unseen from elevated ridges and dense tree lines.',
    culturalInspirationNote:
      'Fictional kingdom inspired by Central & East African woodland kingdoms, carved timber halls, and master bowyers.',
    architecturalStyle: 'canopy_timber',
    primaryStrengths: [
      'Long-Range Precision Archers',
      'Forest Movement & Ambush Mastery',
      'Wilderness Foraging & Reconnaissance',
    ],
    uniqueCharacteristics: [
      'Steep woven-thatch timber halls, carved totems, and lookout decks',
      'Unhindered movement speed and concealment near woodland terrain',
      'Superior bow range and scouting awareness',
    ],
    startingResources: {
      food: 450,
      wood: 500,
      stone: 300,
      iron: 250,
      gold: 220,
    },
    recommendedRegion: 'great_forests',
    palette: {
      primary: '#3f7d32',
      secondary: '#241d15',
      accent: '#d99343',
      bannerCloth: '#336927',
      trimMetal: '#c97e38',
      masonryTint: '#8f6845',
      roofTint: '#4d3922',
    },
    modifiers: {
      infantryDefenseMultiplier: 1.0,
      cavalrySpeedMultiplier: 1.0,
      constructionEfficiencyMultiplier: 1.0,
      tradeYieldMultiplier: 1.0,
      archerReconMultiplier: 1.18,
    },
    futureUnitsPreview: [
      { name: 'Canopy Longbowman', role: 'Long-Range Woodland Archer', phase: 'Phase 3' },
      { name: 'Shadow-Trail Pathfinder', role: 'Stealth Ambush Scout', phase: 'Phase 3' },
      { name: 'Ironwood Marksman', role: 'Armour-Piercing Veteran', phase: 'Phase 3' },
    ],
    futureBuildingsPreview: [
      { name: 'Bowyer Timber Lodge', category: 'Military', effect: 'Trains elite archers & scouts', phase: 'Phase 2' },
      { name: 'Forester Gathering Post', category: 'Economic', effect: 'Sustainable high-yield wood & game harvest', phase: 'Phase 2' },
    ],
  },
};

export const KINGDOM_LIST: KingdomConfig[] = [
  KINGDOMS.oru,
  KINGDOMS.zambara,
  KINGDOMS.kemetra,
  KINGDOMS.aseka,
  KINGDOMS.nambara,
];
