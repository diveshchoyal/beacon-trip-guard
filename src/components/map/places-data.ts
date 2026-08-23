export type SafetyStatus = "safe" | "caution" | "restricted";

export interface TimeRule {
  /** Hour of the day in 24h format (e.g. 6 for 06:00, 5.5 for 05:30) */
  startHour: number;
  /** Hour of the day in 24h format (e.g. 20 for 20:00, 22.5 for 22:30) */
  endHour: number;
  status: SafetyStatus;
  reason: string;
}

export interface TouristPlace {
  id: string;
  name: string;
  category: "Temple" | "Beach" | "Hill Station" | "Heritage" | "Nature & Wildlife" | "Coastal";
  region: string;
  shortDescription: string;
  address: string;
  imageUrl: string;
  lat: number;
  lng: number;
  rules: TimeRule[];
}

export interface PlaceSafetyEvaluation {
  status: SafetyStatus;
  label: string;
  reason: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const riskColor: Record<string, string> = {
  restricted: "#C0483C",
  caution: "#D7A93F",
  safe: "#3F9E6E",
};

export const getPlaceImageUrl = (placeId: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(placeId)}/800/600`;

export const TAMIL_NADU_TOURIST_PLACES: TouristPlace[] = [
  // 1. Chennai - Marina Beach
  {
    id: "marina-beach",
    name: "Marina Beach",
    category: "Beach",
    region: "Chennai",
    shortDescription: "World's second longest natural urban beach along the Bay of Bengal.",
    address: "Marina Beach, Triplicane, Chennai, Tamil Nadu 600005",
    imageUrl:
      "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=700&q=80",
    lat: 13.05,
    lng: 80.2824,
    rules: [
      {
        startHour: 6,
        endHour: 20,
        status: "safe",
        reason:
          "Active daytime crowd, mounted police beach patrols, and functional coastal lifeguard towers along the promenade.",
      },
      {
        startHour: 20,
        endHour: 22,
        status: "caution",
        reason:
          "Beach shoreline access officially closes at 8 PM; poor sand lighting and rising high tide currents make the water edge risky.",
      },
      {
        startHour: 22,
        endHour: 6,
        status: "restricted",
        reason:
          "Increased reports of public intoxication and harassment after 10 PM; beach access is restricted and police patrol frequency drops significantly.",
      },
    ],
  },

  // 2. Chennai - Kapaleeshwarar Temple
  {
    id: "kapaleeshwarar-temple",
    name: "Kapaleeshwarar Temple",
    category: "Temple",
    region: "Chennai",
    shortDescription: "Iconic 7th-century Dravidian architectural temple dedicated to Lord Shiva.",
    address: "12, North Mada Street, Mylapore, Chennai, Tamil Nadu 600004",
    imageUrl:
      "https://images.unsplash.com/photo-1609766857041-ed402ea8069a?auto=format&fit=crop&w=700&q=80",
    lat: 13.0334,
    lng: 80.2699,
    rules: [
      {
        startHour: 5.5,
        endHour: 12.5,
        status: "safe",
        reason:
          "Sanctum open for morning pujas with active temple trust security, crowded heritage streets, and visible police presence.",
      },
      {
        startHour: 12.5,
        endHour: 16,
        status: "caution",
        reason:
          "Inner shrine closed for afternoon rituals; quiet perimeter mada streets experience isolated pockets and limited vendor activity.",
      },
      {
        startHour: 16,
        endHour: 21,
        status: "safe",
        reason:
          "Well-illuminated temple precinct, bustling evening cultural markets, and dedicated Mylapore traffic and tourist police posts.",
      },
      {
        startHour: 21,
        endHour: 5.5,
        status: "restricted",
        reason:
          "Temple gates and surrounding heritage tank walkways locked for the night; general access is prohibited and surrounding alleys become deserted.",
      },
    ],
  },

  // 3. Chennai - Fort St. George
  {
    id: "fort-st-george",
    name: "Fort St. George",
    category: "Heritage",
    region: "Chennai",
    shortDescription: "Historic 1644 fortress housing the state secretariat and colonial museum.",
    address: "Rajaji Salai, near Chief Secretariat, Chennai, Tamil Nadu 600009",
    imageUrl:
      "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=700&q=80",
    lat: 13.0797,
    lng: 80.2874,
    rules: [
      {
        startHour: 9,
        endHour: 17,
        status: "safe",
        reason:
          "ASI Museum and administrative complex operating under full CISF and Tamil Nadu police surveillance with mandatory security screening.",
      },
      {
        startHour: 17,
        endHour: 19,
        status: "caution",
        reason:
          "Museum galleries closed; government secretariat transition hour results in heavy official convoys and restricted perimeter movement.",
      },
      {
        startHour: 19,
        endHour: 9,
        status: "restricted",
        reason:
          "High-security government perimeter completely sealed to tourists with strict armed security checkpoints and no civilian entry permitted.",
      },
    ],
  },

  // 4. Chennai - Elliot's Beach
  {
    id: "elliots-beach",
    name: "Elliot's Beach (Besant Nagar)",
    category: "Beach",
    region: "Chennai",
    shortDescription: "Serene coastal promenade featuring the historic Schmidt Memorial and cafes.",
    address: "6th Avenue, Besant Nagar, Chennai, Tamil Nadu 600090",
    imageUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=80",
    lat: 13.0001,
    lng: 80.2707,
    rules: [
      {
        startHour: 6,
        endHour: 21,
        status: "safe",
        reason:
          "Family-friendly promenade with brightly lit beachfront cafes, wide pedestrian walkways, and stationary police booth at 6th Avenue.",
      },
      {
        startHour: 21,
        endHour: 23,
        status: "caution",
        reason:
          "Commercial dining spots begin closing; seawall access restricted due to unlit rocky patches and reduced foot traffic.",
      },
      {
        startHour: 23,
        endHour: 6,
        status: "restricted",
        reason:
          "Night curfew enforced on the beach sand; vehicle checkpoints active and reports of sporadic anti-social activity after midnight.",
      },
    ],
  },

  // 5. Chennai - Santhome Cathedral Basilica
  {
    id: "santhome-cathedral",
    name: "Santhome Cathedral Basilica",
    category: "Heritage",
    region: "Chennai",
    shortDescription: "Neo-Gothic 16th-century cathedral built over the tomb of St. Thomas the Apostle.",
    address: "38, Santhome High Road, Mylapore, Chennai, Tamil Nadu 600004",
    imageUrl:
      "https://images.unsplash.com/photo-1548625361-16eb477e3c15?auto=format&fit=crop&w=700&q=80",
    lat: 13.0337,
    lng: 80.2785,
    rules: [
      {
        startHour: 6,
        endHour: 20,
        status: "safe",
        reason:
          "Cathedral and underground tomb chapel open with church wardens, CCTV surveillance, and a steady stream of heritage visitors.",
      },
      {
        startHour: 20,
        endHour: 21.5,
        status: "caution",
        reason:
          "Evening mass concluded; church gates closing with dim perimeter lighting along Santhome High Road side lanes.",
      },
      {
        startHour: 21.5,
        endHour: 6,
        status: "restricted",
        reason:
          "Cathedral grounds locked overnight; unauthorized entry prohibited with zero lighting in rear cemetery grounds.",
      },
    ],
  },

  // 6. Chennai - Guindy National Park
  {
    id: "guindy-national-park",
    name: "Guindy National Park",
    category: "Nature & Wildlife",
    region: "Chennai",
    shortDescription: "Protected urban national park featuring spotted deer, blackbucks, and nature trails.",
    address: "Rangeguindy, Chennai, Tamil Nadu 600025",
    imageUrl:
      "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=700&q=80",
    lat: 13.0067,
    lng: 80.2206,
    rules: [
      {
        startHour: 9,
        endHour: 17.5,
        status: "safe",
        reason:
          "Park open under active Forest Department ranger monitoring, defined nature trails, and supervised wildlife enclosures.",
      },
      {
        startHour: 17.5,
        endHour: 19,
        status: "caution",
        reason:
          "Park gates closed to entry; dense forest canopy over perimeter roads reduces dusk visibility and pedestrian safety.",
      },
      {
        startHour: 19,
        endHour: 9,
        status: "restricted",
        reason:
          "Protected wildlife sanctuary locked overnight; strictly no unauthorized entry under Wildlife Protection Act enforcement.",
      },
    ],
  },

  // 7. Mahabalipuram - Shore Temple
  {
    id: "shore-temple",
    name: "Shore Temple",
    category: "Heritage",
    region: "Mahabalipuram",
    shortDescription: "8th-century monolithic rock-cut Pallava sanctuary overlooking the Bay of Bengal.",
    address: "Shore Temple Rd, Mahabalipuram, Tamil Nadu 603104",
    imageUrl:
      "https://images.unsplash.com/photo-1621847468516-1ed5d0df56fe?auto=format&fit=crop&w=700&q=80",
    lat: 12.616,
    lng: 80.1983,
    rules: [
      {
        startHour: 6,
        endHour: 18,
        status: "safe",
        reason:
          "ASI heritage monument open with ticketed security gates, registered tourist guides, and daytime coastal surveillance.",
      },
      {
        startHour: 18,
        endHour: 20,
        status: "caution",
        reason:
          "Monument closed to entry; unlit rocky coastline has powerful undertows and isolated beach stretches.",
      },
      {
        startHour: 20,
        endHour: 6,
        status: "restricted",
        reason:
          "Complete perimeter lockdown of heritage beach site; coastal police patrols strictly prohibit nighttime trespassing.",
      },
    ],
  },

  // 8. Madurai - Meenakshi Amman Temple
  {
    id: "meenakshi-temple",
    name: "Meenakshi Amman Temple",
    category: "Temple",
    region: "Madurai",
    shortDescription: "Historic 14-tower temple complex dedicated to Goddess Meenakshi and Lord Sundareswarar.",
    address: "Madurai Main, Madurai, Tamil Nadu 625001",
    imageUrl:
      "https://images.unsplash.com/photo-1600100397608-f010f4436a5a?auto=format&fit=crop&w=700&q=80",
    lat: 9.9195,
    lng: 78.1193,
    rules: [
      {
        startHour: 5,
        endHour: 12.5,
        status: "safe",
        reason:
          "Open for morning darshan with stringent electronic security frisking, metal detectors, and extensive police deployments.",
      },
      {
        startHour: 12.5,
        endHour: 16,
        status: "caution",
        reason:
          "Sanctum sanctorum doors closed for midday recess; temple corridor bazaars remain open with moderate crowd vigilance.",
      },
      {
        startHour: 16,
        endHour: 22,
        status: "safe",
        reason:
          "Illuminated evening procession, heavy local police presence, and vibrant Chithirai heritage market activity.",
      },
      {
        startHour: 22,
        endHour: 5,
        status: "restricted",
        reason:
          "All four monumental Gopuram towers locked for the night; surrounding streets empty and monitored by mobile police squads.",
      },
    ],
  },

  // 9. Thanjavur - Brihadeeswarar Temple (Big Temple)
  {
    id: "brihadeeswarar-temple",
    name: "Brihadeeswarar Temple",
    category: "Temple",
    region: "Thanjavur",
    shortDescription: "1010 CE UNESCO World Heritage Chola temple with a 66m granite Vimana tower.",
    address: "Membalam Rd, Balaganapathy Nagar, Thanjavur, Tamil Nadu 613007",
    imageUrl:
      "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=700&q=80",
    lat: 10.7828,
    lng: 79.1318,
    rules: [
      {
        startHour: 6,
        endHour: 12.5,
        status: "safe",
        reason:
          "ASI-protected heritage site open for morning visitors with extensive courtyards and dedicated tourist safety staff.",
      },
      {
        startHour: 12.5,
        endHour: 16,
        status: "caution",
        reason:
          "Sanctum closed during afternoon heat; large stone courtyards have minimal shade and reduced staff on grounds.",
      },
      {
        startHour: 16,
        endHour: 20.5,
        status: "safe",
        reason:
          "Floodlit temple grounds open for evening darshan with steady tourist footfall and temple trust security.",
      },
      {
        startHour: 20.5,
        endHour: 6,
        status: "restricted",
        reason:
          "Outer moat and granite fortress gates sealed overnight; no visitor entry permitted under ASI regulations.",
      },
    ],
  },

  // 10. Nilgiris - Ooty Botanical Gardens & Doddabetta
  {
    id: "ooty-botanical-garden",
    name: "Ooty Botanical Garden",
    category: "Hill Station",
    region: "Nilgiris",
    shortDescription: "Sprawling 55-acre terraced garden in the Nilgiri hills surrounded by tea estates.",
    address: "Vannarapettai, Ooty, Tamil Nadu 643002",
    imageUrl:
      "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=700&q=80",
    lat: 11.4172,
    lng: 76.7118,
    rules: [
      {
        startHour: 7,
        endHour: 17.5,
        status: "safe",
        reason:
          "Daylight park hours with horticulture wardens, well-marked walking paths, and steady family visitor flow.",
      },
      {
        startHour: 17.5,
        endHour: 19.5,
        status: "caution",
        reason:
          "Dense mountain mist and sudden drops in temperature; winding ghat roads require slow driving and fog headlights.",
      },
      {
        startHour: 19.5,
        endHour: 7,
        status: "restricted",
        reason:
          "High risk of wild elephant crossings and zero-visibility fog on forest fringes; outdoor mountain trekking prohibited.",
      },
    ],
  },

  // 11. Kodaikanal - Kodaikanal Lake & Coaker's Walk
  {
    id: "kodaikanal-lake",
    name: "Kodaikanal Lake",
    category: "Hill Station",
    region: "Kodaikanal",
    shortDescription: "Star-shaped mountain lake nestled amidst Palani Hills with scenic misty promenade.",
    address: "Kodaikanal Lake Road, Kodaikanal, Tamil Nadu 624101",
    imageUrl:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=80",
    lat: 10.2381,
    lng: 77.4892,
    rules: [
      {
        startHour: 6.5,
        endHour: 18,
        status: "safe",
        reason:
          "Boating club active with certified life jackets, bicycle rentals, and well-patrolled lakeside promenade paths.",
      },
      {
        startHour: 18,
        endHour: 20.5,
        status: "caution",
        reason:
          "Heavy mountain fog settles over lake perimeter; slippery damp pathways and reduced road visibility.",
      },
      {
        startHour: 20.5,
        endHour: 6.5,
        status: "restricted",
        reason:
          "Lake access closed; low ambient lighting, near-freezing temperatures, and steep mountain road hazards.",
      },
    ],
  },

  // 12. Rameswaram - Ramanathaswamy Temple & Dhanushkodi
  {
    id: "ramanathaswamy-temple",
    name: "Ramanathaswamy Temple",
    category: "Temple",
    region: "Rameswaram",
    shortDescription: "Famed island pilgrimage site featuring 22 sacred theerthams and the world's longest corridor.",
    address: "Rameswaram Island, Ramanathapuram, Tamil Nadu 623526",
    imageUrl:
      "https://images.unsplash.com/photo-1624461159935-c49b6b7a5996?auto=format&fit=crop&w=700&q=80",
    lat: 9.2881,
    lng: 79.3174,
    rules: [
      {
        startHour: 5,
        endHour: 13,
        status: "safe",
        reason:
          "Open for holy bath rituals and morning temple darshan with marine police and temple security on duty.",
      },
      {
        startHour: 13,
        endHour: 15.5,
        status: "caution",
        reason:
          "Main corridor resting period; high coastal midday heat and limited transport on the Pamban causeway.",
      },
      {
        startHour: 15.5,
        endHour: 21,
        status: "safe",
        reason:
          "Evening prayer rituals, active temple bazaar, and well-regulated pilgrim movement with floodlights.",
      },
      {
        startHour: 21,
        endHour: 5,
        status: "restricted",
        reason:
          "Dhanushkodi checkpost closed and temple gates locked; strong ocean cross-winds and coastal tides active.",
      },
    ],
  },

  // 13. Kanyakumari - Vivekananda Rock Memorial
  {
    id: "vivekananda-rock",
    name: "Vivekananda Rock Memorial",
    category: "Coastal",
    region: "Kanyakumari",
    shortDescription: "Sacred rock monument at the southernmost tip of mainland India where three oceans meet.",
    address: "Kanyakumari Island, Kanyakumari, Tamil Nadu 629702",
    imageUrl:
      "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=700&q=80",
    lat: 8.078,
    lng: 77.555,
    rules: [
      {
        startHour: 8,
        endHour: 16.5,
        status: "safe",
        reason:
          "Poompuhar ferry services operating with Coast Guard oversight and mandatory life vests on the island.",
      },
      {
        startHour: 16.5,
        endHour: 18.5,
        status: "caution",
        reason:
          "Last ferry returns; mainland sunset viewpoint gets densely packed along rocky shore wave barriers.",
      },
      {
        startHour: 18.5,
        endHour: 8,
        status: "restricted",
        reason:
          "Rock memorial closed overnight; high tidal swells and dangerous jagged wave-cut rocks along the shore.",
      },
    ],
  },

  // 14. Salem / Eastern Ghats - Yercaud Hill Station
  {
    id: "yercaud-hills",
    name: "Yercaud Hill Station",
    category: "Hill Station",
    region: "Shevaroy Hills",
    shortDescription: "Quiet jewel hill station in the Eastern Ghats known for coffee plantations and Lady's Seat.",
    address: "Yercaud Hills, Salem District, Tamil Nadu 636601",
    imageUrl:
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=700&q=80",
    lat: 11.7753,
    lng: 78.2093,
    rules: [
      {
        startHour: 7,
        endHour: 18,
        status: "safe",
        reason:
          "Scenic viewpoints and boat house open with local tourism wardens and steady daytime family visitors.",
      },
      {
        startHour: 18,
        endHour: 20,
        status: "caution",
        reason:
          "Dense ghat road fog reduces hairpin curve visibility; street lighting is sparse outside the central town.",
      },
      {
        startHour: 20,
        endHour: 7,
        status: "restricted",
        reason:
          "Viewpoints locked and ghat road transport restricted due to sudden mist and nocturnal wildlife movement.",
      },
    ],
  },

  // 15. Sivaganga - Chettinad Heritage Mansions
  {
    id: "chettinad-mansions",
    name: "Chettinad Heritage Mansions",
    category: "Heritage",
    region: "Karaikudi",
    shortDescription: "19th-century opulent merchant palatial mansions adorned with Burmese teak and Italian marble.",
    address: "Kanadukathan, Karaikudi, Sivaganga District, Tamil Nadu 630103",
    imageUrl:
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=700&q=80",
    lat: 10.0735,
    lng: 78.7845,
    rules: [
      {
        startHour: 8.5,
        endHour: 17.5,
        status: "safe",
        reason:
          "Heritage palace tours operating with registered cultural guides and open village pedestrian lanes.",
      },
      {
        startHour: 17.5,
        endHour: 19.5,
        status: "caution",
        reason:
          "Mansions closed for private access; quiet village lanes have limited public street lighting.",
      },
      {
        startHour: 19.5,
        endHour: 8.5,
        status: "restricted",
        reason:
          "Private heritage estates locked; non-resident entry strictly prohibited across private palace compounds.",
      },
    ],
  },

  // 16. Coimbatore - Marudamalai Murugan Temple
  {
    id: "marudamalai-temple",
    name: "Marudamalai Murugan Temple",
    category: "Temple",
    region: "Coimbatore",
    shortDescription: "12th-century hill shrine dedicated to Lord Murugan surrounded by Western Ghats medicinal forests.",
    address: "Marudamalai Road, Somayampalayam, Coimbatore, Tamil Nadu 641046",
    imageUrl:
      "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=700&q=80",
    lat: 11.0456,
    lng: 76.8517,
    rules: [
      {
        startHour: 6,
        endHour: 13,
        status: "safe",
        reason:
          "Temple devasthanam transport active, queue complexes well-regulated, and security staff on all steps.",
      },
      {
        startHour: 13,
        endHour: 16,
        status: "caution",
        reason:
          "Midday temple break; hill steps get hot and perimeter forest paths have isolated stretches.",
      },
      {
        startHour: 16,
        endHour: 20.5,
        status: "safe",
        reason:
          "Evening pujas with illuminated hill road and police checkposts at the base foothills.",
      },
      {
        startHour: 20.5,
        endHour: 6,
        status: "restricted",
        reason:
          "Hill entry gate locked at base due to nocturnal wild elephant and leopard activity from adjoining reserve forest.",
      },
    ],
  },
].map((place) => ({
  ...place,
  imageUrl: getPlaceImageUrl(place.id),
}));

/** Alias for backward compatibility */
export const CHENNAI_TOURIST_PLACES = TAMIL_NADU_TOURIST_PLACES;

/**
 * Dynamically computes the current safety status, label, color, and reason
 * for a tourist place based on the time of day.
 */
export function evaluatePlaceSafety(
  place: TouristPlace,
  date: Date = new Date(),
): PlaceSafetyEvaluation {
  const currentHour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  const matchedRule = place.rules.find((rule) => {
    if (rule.startHour < rule.endHour) {
      return currentHour >= rule.startHour && currentHour < rule.endHour;
    } else {
      // Midnight crossing, e.g. 22:00 to 06:00
      return currentHour >= rule.startHour || currentHour < rule.endHour;
    }
  });

  const status: SafetyStatus = matchedRule ? matchedRule.status : "safe";
  const reason = matchedRule
    ? matchedRule.reason
    : "Standard safety protocols active. Exercise normal situational awareness.";

  const statusConfig: Record<
    SafetyStatus,
    { label: string; color: string; bgColor: string; borderColor: string; textColor: string }
  > = {
    safe: {
      label: "Safe to Visit",
      color: "#3F9E6E",
      bgColor: "rgba(63, 158, 110, 0.15)",
      borderColor: "rgba(63, 158, 110, 0.35)",
      textColor: "#1f6e43",
    },
    caution: {
      label: "Caution Advised",
      color: "#D7A93F",
      bgColor: "rgba(215, 169, 63, 0.18)",
      borderColor: "rgba(215, 169, 63, 0.4)",
      textColor: "#92680a",
    },
    restricted: {
      label: "Restricted Zone",
      color: "#C0483C",
      bgColor: "rgba(192, 72, 60, 0.18)",
      borderColor: "rgba(192, 72, 60, 0.4)",
      textColor: "#9e2a1f",
    },
  };

  return {
    status,
    reason,
    ...statusConfig[status],
  };
}
